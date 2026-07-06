# Kitesurfen diplomalijn import

Imports the Kitesurfen discipline, course, programs, and curriculum (modules, competencies, eisen) from the wide-matrix XLSX brondbestand.

Based on [`backfill-program-info.txt`](../../backfill-program-info.txt).

The brondbestand is **not** stored in git — pass the path as the first argument.

## Prerequisites

- Local or remote Postgres with NWD schema migrated
- `volwassenen` category must exist (from `pnpm db:seed` or production data)
- Environment variables (import only, not dry-run):
  - `PGURI`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Run

```sh
# Dry run
pnpm --filter @nawadi/scripts seed-kitesurfen -- "C:\path\to\kitesurfen diplomalijn 202606.xlsx" --dry-run

# Import
pnpm --filter @nawadi/scripts seed-kitesurfen -- "C:\path\to\kitesurfen diplomalijn 202606.xlsx"

# Re-import after Excel changes (clears revision 202606 eisen + module links, then imports fresh)
pnpm --filter @nawadi/scripts seed-kitesurfen -- "C:\path\to\kitesurfen diplomalijn 202606.xlsx" --replace-revision
```

`--replace-revision` deletes all `curriculum_competency` and `curriculum_module` rows for Kitesurfen programs with revision `202606`, then imports from the XLSX again. Use this when you changed existing eisen text. It does **not** remove the discipline, course, programs, or global module/competency catalog entries.

**Warning:** if students already have progress linked to these eisen, the delete step may fail due to foreign keys. Use on test/local first.

Use quotes when the path contains spaces. The `--` after `seed-kitesurfen` is required so pnpm forwards the path to the script.

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

1. Run with `--dry-run` first and verify eisen counts per niveau
2. Take a database backup
3. Run import with production env vars
4. Link the discipline to vaarlocaties separately (not part of this script)
