import type { NiveauSuffix } from "./constants.js";
import { COLUMN_BLOCKS, PARSE_START_ROW } from "./constants.js";

export type NormalizedRow = {
  niveau: NiveauSuffix;
  module: string;
  type: "Verplicht" | "Optioneel";
  competentie: string;
  eis: string;
};

type SheetRow = (string | number | boolean | null | undefined)[];

function cellValue(row: SheetRow, index: number): string {
  const value = row[index];
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function isKeuzemodule(text: string): boolean {
  return text.toLowerCase().startsWith("keuzemodule");
}

export function parseWideMatrix(rows: SheetRow[]): NormalizedRow[] {
  const normalized: NormalizedRow[] = [];
  const currentModule = new Map<NiveauSuffix, string>();

  for (let rowIndex = PARSE_START_ROW; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row) {
      continue;
    }

    for (const block of COLUMN_BLOCKS) {
      const title = cellValue(row, block.titleCol);
      const description = cellValue(row, block.descCol);

      if (!title && !description) {
        continue;
      }

      if (title && !description) {
        currentModule.set(block.niveau, title);
        continue;
      }

      if (!title || !description) {
        continue;
      }

      const module =
        currentModule.get(block.niveau) ??
        (isKeuzemodule(title) ? title : "Algemeen");

      const type: NormalizedRow["type"] =
        isKeuzemodule(module) || isKeuzemodule(title)
          ? "Optioneel"
          : "Verplicht";

      normalized.push({
        niveau: block.niveau,
        module,
        type,
        competentie: title,
        eis: description,
      });
    }
  }

  return normalized;
}

export function summarizeRows(rows: NormalizedRow[]): Record<NiveauSuffix, number> {
  const counts: Record<NiveauSuffix, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    a: 0,
    b: 0,
  };

  for (const row of rows) {
    counts[row.niveau]++;
  }

  return counts;
}
