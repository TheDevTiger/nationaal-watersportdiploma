import {
  withDatabase,
  withSupabaseClient,
  withTransaction,
} from "@nawadi/core";
import "dotenv/config";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import pkg from "xlsx";
import { resetDedupeCache } from "./seed/curriculum/kitesurfen/get-or-create.js";
import {
  parseWideMatrix,
  summarizeRows,
} from "./seed/curriculum/kitesurfen/parse-xlsx.js";
import {
  processRow,
  resetProcessRowState,
} from "./seed/curriculum/kitesurfen/process-row.js";
import { replaceKitesurfenRevision } from "./seed/curriculum/kitesurfen/replace-revision.js";
import { scaffoldKitesurfen } from "./seed/curriculum/kitesurfen/scaffold.js";

const { read, utils } = pkg;

const USAGE =
  "Usage: seed-kitesurfen <path-to-file.xlsx> [--dry-run] [--replace-revision]\n" +
  "Example: pnpm --filter @nawadi/scripts seed-kitesurfen -- \"C:\\path\\kitesurfen.xlsx\" --replace-revision";

function normalizePathInput(input: string): string {
  return input.trim().replace(/^["']|["']$/g, "");
}

function resolveXlsxPath(input: string): string {
  const normalized = normalizePathInput(input);
  const candidates = [
    path.resolve(normalized),
    path.resolve(process.cwd(), normalized),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(normalized);
}

function parseArgs(argv: string[]): {
  xlsxPath: string;
  dryRun: boolean;
  replaceRevision: boolean;
} {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  let xlsxPath: string | null = null;
  let dryRun = false;
  let replaceRevision = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--replace-revision") {
      replaceRevision = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}\n${USAGE}`);
    }
    if (!xlsxPath) {
      xlsxPath = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}\n${USAGE}`);
  }

  if (!xlsxPath) {
    throw new Error(USAGE);
  }

  if (!xlsxPath.toLowerCase().endsWith(".xlsx")) {
    throw new Error("File must be an .xlsx file");
  }

  return { xlsxPath: resolveXlsxPath(xlsxPath), dryRun, replaceRevision };
}

function loadRows(xlsxPath: string): ReturnType<typeof parseWideMatrix> {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`XLSX file not found: ${xlsxPath}`);
  }

  const workbook = read(fs.readFileSync(xlsxPath), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  assert(sheetName, "No sheets found in the XLSX file");

  const worksheet = workbook.Sheets[sheetName];
  assert(worksheet, `Worksheet "${sheetName}" is missing`);

  const rawRows = utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    defval: "",
  });

  return parseWideMatrix(rawRows);
}

async function importToDatabase(
  rows: ReturnType<typeof parseWideMatrix>,
  replaceRevision: boolean,
): Promise<void> {
  resetDedupeCache();
  resetProcessRowState();

  const { programIds } = await scaffoldKitesurfen();
  console.log("Scaffold ready (discipline, course, programs).");

  if (replaceRevision) {
    const cleared = await replaceKitesurfenRevision(programIds);
    console.log(
      `Cleared revision ${cleared.curriculumCount} curriculum(s): ` +
        `${cleared.competenciesRemoved} eisen, ${cleared.modulesRemoved} module links removed.`,
    );
  }

  for (const [index, row] of rows.entries()) {
    try {
      await processRow(row, programIds);
    } catch (error) {
      console.error(`Failed at row ${index + 1}:`, row);
      throw error;
    }
  }

  console.log(`Imported ${rows.length} curriculum competencies.`);
}

async function run(): Promise<void> {
  const { xlsxPath, dryRun, replaceRevision } = parseArgs(process.argv);

  const rows = loadRows(xlsxPath);
  const counts = summarizeRows(rows);

  console.log(`Parsed ${rows.length} eisen from ${xlsxPath}`);
  console.log("Per niveau:", counts);

  if (dryRun) {
    if (replaceRevision) {
      console.log(
        "Note: --replace-revision is ignored in dry-run mode (no database changes).",
      );
    }
    console.log("Dry run — no database changes.");
    return;
  }

  const pgUri = process.env.PGURI;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  assert(pgUri, "PGURI environment variable is required");
  assert(
    supabaseUrl,
    "NEXT_PUBLIC_SUPABASE_URL environment variable is required",
  );
  assert(
    supabaseKey,
    "SUPABASE_SERVICE_ROLE_KEY environment variable is required",
  );

  await withSupabaseClient(
    {
      url: supabaseUrl,
      serviceRoleKey: supabaseKey,
    },
    () =>
      withDatabase(
        {
          connectionString: pgUri,
        },
        async () => {
          await withTransaction(async () => {
            await importToDatabase(rows, replaceRevision);
          });
        },
      ),
  );
}

run()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
