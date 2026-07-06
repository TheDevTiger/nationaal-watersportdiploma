import { useQuery } from "@nawadi/core";
import { schema as s } from "@nawadi/db";
import { and, eq, inArray } from "drizzle-orm";
import { REVISION } from "./constants.js";

export async function replaceKitesurfenRevision(
  programIds: Record<string, string>,
): Promise<{
  curriculumCount: number;
  competenciesRemoved: number;
  modulesRemoved: number;
}> {
  const query = useQuery();
  const programIdList = Object.values(programIds);

  if (programIdList.length === 0) {
    return { curriculumCount: 0, competenciesRemoved: 0, modulesRemoved: 0 };
  }

  const curricula = await query
    .select({ id: s.curriculum.id })
    .from(s.curriculum)
    .where(
      and(
        inArray(s.curriculum.programId, programIdList),
        eq(s.curriculum.revision, REVISION),
      ),
    );

  const curriculumIds = curricula.map((row) => row.id);

  if (curriculumIds.length === 0) {
    return { curriculumCount: 0, competenciesRemoved: 0, modulesRemoved: 0 };
  }

  const removedCompetencies = await query
    .delete(s.curriculumCompetency)
    .where(inArray(s.curriculumCompetency.curriculumId, curriculumIds))
    .returning({ id: s.curriculumCompetency.id });

  const removedModules = await query
    .delete(s.curriculumModule)
    .where(inArray(s.curriculumModule.curriculumId, curriculumIds))
    .returning({
      curriculumId: s.curriculumModule.curriculumId,
      moduleId: s.curriculumModule.moduleId,
    });

  return {
    curriculumCount: curriculumIds.length,
    competenciesRemoved: removedCompetencies.length,
    modulesRemoved: removedModules.length,
  };
}
