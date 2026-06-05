# Kitesurfen diplomalijn import

Imports the Kitesurfen discipline, course, programs, and curriculum (modules, competencies, eisen) from the wide-matrix XLSX brondbestand.

Based on [`backfill-program-info.txt`](../../backfill-program-info.txt).

## Prerequisites

- Local or remote Postgres with NWD schema migrated
- `volwassenen` category must exist (from `pnpm db:seed` or production data)
- Environment variables:
  - `PGURI`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Run

```sh
# Dry run (uses bundled XLSX in this folder by default)
pnpm --filter @nawadi/scripts seed-kitesurfen -- --dry-run

# Dry run with explicit path (relative to packages/scripts)
pnpm --filter @nawadi/scripts seed-kitesurfen -- --xlsx "src/seed/curriculum/kitesurfen/kitesurfen diplomalijn 202606.xlsx" --dry-run

# Import
pnpm --filter @nawadi/scripts seed-kitesurfen
```

## What gets created

| Entity | Handle |
|--------|--------|
| Discipline | `kitesurfen` |
| Course | `kitesurfen-volwassenen` |
| Programs | `kitesurfen-volwassenen-1` … `-4`, `-a`, `-b` |
| Degrees | `niveau-1` … `niveau-4` (existing), `niveau-a`, `niveau-b` (created if missing) |
| Curriculum revision | `202506` |

## XLSX format

Single sheet, wide matrix: pairs of columns per niveau (title | description). Module rows have a title but no description. See `parse-xlsx.ts` for details.

## Production

1. Run `--dry-run` first and verify eisen counts per niveau
2. Take a database backup
3. Run import with production env vars
4. Link the discipline to vaarlocaties separately (not part of this script)
