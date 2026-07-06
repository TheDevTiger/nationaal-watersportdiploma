export const DISCIPLINE_HANDLE = "kitesurfen";
export const DISCIPLINE_TITLE = "Kitesurfen";

export const COURSE_HANDLE = "kitesurfen-volwassenen";
export const COURSE_TITLE = "Kitesurfen Volwassenen";

export const CATEGORY_HANDLE = "volwassenen";

export const REVISION = "202606";

export const NIVEAU_SUFFIXES = ["1", "2", "3", "4", "a", "b"] as const;
export type NiveauSuffix = (typeof NIVEAU_SUFFIXES)[number];

export const DEGREE_CONFIG: Record<
  NiveauSuffix,
  { handle: string; title: string; rang: number }
> = {
  "1": { handle: "niveau-1", title: "1", rang: 1 },
  "2": { handle: "niveau-2", title: "2", rang: 2 },
  "3": { handle: "niveau-3", title: "3", rang: 3 },
  "4": { handle: "niveau-4", title: "4", rang: 4 },
  a: { handle: "niveau-a", title: "A", rang: 5 },
  b: { handle: "niveau-b", title: "B", rang: 6 },
};

export const COLUMN_BLOCKS: {
  niveau: NiveauSuffix;
  titleCol: number;
  descCol: number;
}[] = [
  { niveau: "1", titleCol: 0, descCol: 1 },
  { niveau: "2", titleCol: 2, descCol: 3 },
  { niveau: "3", titleCol: 4, descCol: 5 },
  { niveau: "4", titleCol: 6, descCol: 7 },
  { niveau: "a", titleCol: 8, descCol: 9 },
  { niveau: "b", titleCol: 10, descCol: 11 },
];

export const PARSE_START_ROW = 3;

export function programHandle(niveau: NiveauSuffix): string {
  return `${COURSE_HANDLE}-${niveau}`;
}

export function programTitle(niveau: NiveauSuffix): string {
  const suffix = DEGREE_CONFIG[niveau].title;
  return `${COURSE_TITLE} ${suffix}`;
}
