import { Course, Curriculum } from "@nawadi/core";
import slugify from "@sindresorhus/slugify";
import { REVISION } from "./constants.js";
import { asEntity, getOrCreateCachedItem } from "./get-or-create.js";
import type { NormalizedRow } from "./parse-xlsx.js";

const curriculumCache = new Map<string, Promise<string>>();
const moduleWeightByProgram = new Map<string, number>();
const competencyWeightByProgram = new Map<string, number>();

async function getOrCreateCurriculum(programId: string): Promise<string> {
  let promise = curriculumCache.get(programId);
  if (!promise) {
    promise = Curriculum.list({ filter: { programId } }).then(async (curricula) => {
      const existing = curricula.find((c) => c.revision === REVISION);

      if (existing) {
        return existing.id;
      }

      const created = await Curriculum.create({
        programId,
        revision: REVISION,
      });

      return created.id;
    });
    curriculumCache.set(programId, promise);
  }

  return promise;
}

function nextModuleWeight(programId: string, moduleHandle: string): number {
  const key = `${programId}:${moduleHandle}`;
  const current = moduleWeightByProgram.get(key) ?? 0;
  const next = current + 1;
  moduleWeightByProgram.set(key, next);
  return next;
}

function nextCompetencyWeight(programId: string, competencyHandle: string): number {
  const key = `${programId}:${competencyHandle}`;
  const current = competencyWeightByProgram.get(key) ?? 0;
  const next = current + 1;
  competencyWeightByProgram.set(key, next);
  return next;
}

function getOrCreateModule(
  moduleTitle: string,
  programId: string,
): Promise<string> {
  const moduleHandle = slugify(moduleTitle);

  return getOrCreateCachedItem(
    asEntity(Course.Module),
    moduleHandle,
    moduleTitle,
    `module-${moduleHandle}`,
    () => ({ weight: nextModuleWeight(programId, moduleHandle) }),
  );
}

function getOrCreateCompetency(
  competentieTitle: string,
  moduleTitle: string,
  programId: string,
): Promise<string> {
  const competencyHandle = slugify(competentieTitle);

  return getOrCreateCachedItem(
    asEntity(Course.Competency),
    competencyHandle,
    competentieTitle,
    `competency-${competencyHandle}`,
    () => ({
      type: moduleTitle.startsWith("Theorie") ? "knowledge" : "skill",
      weight: nextCompetencyWeight(programId, competencyHandle),
    }),
  );
}

export async function processRow(
  row: NormalizedRow,
  programIds: Record<string, string>,
): Promise<void> {
  const programId = programIds[row.niveau];
  if (!programId) {
    throw new Error(`No program id for niveau "${row.niveau}"`);
  }

  const [moduleId, competencyId, curriculumId] = await Promise.all([
    getOrCreateModule(row.module, programId),
    getOrCreateCompetency(row.competentie, row.module, programId),
    getOrCreateCurriculum(programId),
  ]);

  await Curriculum.linkModule({
    curriculumId,
    moduleId,
  });

  const existing = await Curriculum.Competency.list({
    filter: {
      curriculumId,
      moduleId,
      competencyId,
    },
  });

  if (existing.length > 0) {
    return;
  }

  await Curriculum.Competency.create({
    curriculumId,
    moduleId,
    competencyId,
    isRequired: row.type === "Verplicht",
    requirement: row.eis,
  });
}

export function resetProcessRowState(): void {
  curriculumCache.clear();
  moduleWeightByProgram.clear();
  competencyWeightByProgram.clear();
}
