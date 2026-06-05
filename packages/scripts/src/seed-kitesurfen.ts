import {
  withDatabase,
  withSupabaseClient,
  withTransaction,
} from "@nawadi/core";
import "dotenv/config";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { scaffoldKitesurfen } from "./seed/curriculum/kitesurfen/scaffold.js";

const { read, utils } = pkg;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Bundled brondbestand next to the kitesurfen seed modules. */
export const DEFAULT_XLSX_PATH = path.join(
  SCRIPT_DIR,
  "seed/curriculum/kitesurfen/kitesurfen diplomalijn 202606.xlsx",
);

function resolveXlsxPath(input: string): string {
  const candidates = [
    path.resolve(input),
    path.resolve(process.cwd(), input),
    path.resolve(process.cwd(), "..", "..", input),
    path.resolve(SCRIPT_DIR, input),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(input);
}

function parseArgs(argv: string[]): { xlsxPath: string; dryRun: boolean } {
  const args = argv.slice(2);
  let xlsxPath = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--") {
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--xlsx") {
      const next = args[i + 1];
      if (!next) {
        throw new Error("--xlsx requires a file path");
      }
      xlsxPath = next;
      i++;
      continue;
    }
    if (arg && !arg.startsWith("--") && !xlsxPath) {
      xlsxPath = arg;
    }
  }

  if (!xlsxPath) {
    xlsxPath = DEFAULT_XLSX_PATH;
  }

  return { xlsxPath: resolveXlsxPath(xlsxPath), dryRun };
}

function loadRows(xlsxPath: string): ReturnType<typeof parseWideMatrix> {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(
      `XLSX file not found: ${xlsxPath}\n` +
        `Tip: pnpm runs from packages/scripts — use a path relative to that folder, e.g.\n` +
        `  src/seed/curriculum/kitesurfen/kitesurfen diplomalijn 202606.xlsx\n` +
        `Or omit --xlsx to use the bundled file.`,
    );
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
): Promise<void> {
  resetDedupeCache();
  resetProcessRowState();

  const { programIds } = await scaffoldKitesurfen();
  console.log("Scaffold ready (discipline, course, programs).");

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
  const { xlsxPath, dryRun } = parseArgs(process.argv);
  const rows = loadRows(xlsxPath);
  const counts = summarizeRows(rows);

  console.log(`Parsed ${rows.length} eisen from ${path.basename(xlsxPath)}`);
  console.log("Per niveau:", counts);

  if (dryRun) {
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
            await importToDatabase(rows);
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
