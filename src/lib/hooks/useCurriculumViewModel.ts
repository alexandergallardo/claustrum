import { useMemo } from "react";

import type { StudyPlanDetail, StudentCourseStatusMap, Course, StudyPeriod } from "@/lib/types";

import { normalizeCourseName, getLevelLabel } from "@/lib/utils/course-utils";

interface CourseRelations {
  prerequisites: number[];
  corequisites: number[];
  equivalents?: number[];
}

export function useCurriculumViewModel(
  planDetail: StudyPlanDetail | null,
  statusMap: StudentCourseStatusMap | undefined,
) {
  const semesters = useMemo(() => {
    if (!planDetail) return [];

    return planDetail.periods.map((period: StudyPeriod) => {
      const courses = period.courses.map((course) => {
        const courseIdStr = String(course.courseId);
        const relations: CourseRelations = (planDetail.courseRelations.get(
          course.courseId,
        ) as CourseRelations) || { prerequisites: [], corequisites: [] };
        const status = statusMap?.get(course.courseId) || "not_taken";

        return {
          id: courseIdStr,
          code: course.courseCode,
          name: normalizeCourseName(course.courseName),
          credits: course.credits,
          hours: course.weeklyHours,
          semester: course.levelNumber ?? 0,
          status,
          prerequisites: relations.prerequisites?.map(String) || [],
          corequisites: relations.corequisites?.map(String) || [],
          equivalents: relations.equivalents?.map(String) || [],
        } satisfies Course;
      });

      return {
        levelNumber: period.levelNumber ?? 0,
        levelLabel: getLevelLabel(period.levelNumber, period.levelLabel),
        courses,
      };
    });
  }, [planDetail, statusMap]);

  const courses = useMemo(() => semesters.flatMap((s) => s.courses), [semesters]);

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const levelLabelsMap = useMemo(
    () => new Map(semesters.map((s) => [s.levelNumber, s.levelLabel])),
    [semesters],
  );

  return {
    semesters,
    courses,
    courseById,
    levelLabelsMap,
  };
}
