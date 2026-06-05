import { Course } from "@nawadi/core";
import {
  CATEGORY_HANDLE,
  COURSE_HANDLE,
  COURSE_TITLE,
  DEGREE_CONFIG,
  DISCIPLINE_HANDLE,
  DISCIPLINE_TITLE,
  NIVEAU_SUFFIXES,
  programHandle,
  programTitle,
} from "./constants.js";
import { getOrCreateCachedItem, type GetOrCreateEntity } from "./get-or-create.js";

function asEntity(entity: object): GetOrCreateEntity {
  return entity as GetOrCreateEntity;
}

export async function scaffoldKitesurfen(): Promise<{
  disciplineId: string;
  courseId: string;
  programIds: Record<string, string>;
}> {
  const disciplineId = await getOrCreateCachedItem(
    asEntity(Course.Discipline),
    DISCIPLINE_HANDLE,
    DISCIPLINE_TITLE,
    `discipline-${DISCIPLINE_HANDLE}`,
  );

  const volwassenenCategory = await Course.Category.fromHandle(CATEGORY_HANDLE);
  if (!volwassenenCategory) {
    throw new Error(
      `Category "${CATEGORY_HANDLE}" not found. Run pnpm db:seed first or create the category.`,
    );
  }

  let course = await Course.findOne({ handle: COURSE_HANDLE });
  if (!course) {
    const created = await Course.create({
      handle: COURSE_HANDLE,
      title: COURSE_TITLE,
      disciplineId,
      categories: [volwassenenCategory.id],
    });
    course = await Course.findOne({ id: created.id });
  }

  if (!course) {
    throw new Error(`Failed to create course "${COURSE_HANDLE}"`);
  }

  const programIds: Record<string, string> = {};

  for (const niveau of NIVEAU_SUFFIXES) {
    const degreeConfig = DEGREE_CONFIG[niveau];
    const degreeId = await getOrCreateCachedItem(
      asEntity(Course.Degree),
      degreeConfig.handle,
      degreeConfig.title,
      `degree-${degreeConfig.handle}`,
      { rang: degreeConfig.rang },
    );

    const handle = programHandle(niveau);
    let program = await Course.Program.fromHandle(handle);

    if (!program) {
      const created = await Course.Program.create({
        handle,
        title: programTitle(niveau),
        courseId: course.id,
        degreeId,
      });
      program = await Course.Program.fromHandle(handle);
      if (!program) {
        throw new Error(`Failed to create program "${handle}" (id: ${created.id})`);
      }
    }

    programIds[niveau] = program.id;
  }

  return { disciplineId, courseId: course.id, programIds };
}
