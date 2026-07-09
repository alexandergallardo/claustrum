import fs from "node:fs/promises";

async function main() {
  const data = JSON.parse(await fs.readFile("extracted.json", "utf-8"));
  
  const periodsMap = new Map();
  for (const course of data.coursesData) {
    if (!periodsMap.has(course.level_number)) {
      periodsMap.set(course.level_number, {
        levelNumber: course.level_number,
        levelLabel: course.level_label,
        courses: []
      });
    }
    periodsMap.get(course.level_number).courses.push({
      courseId: course.course_id,
      levelNumber: course.level_number,
      credits: course.credits,
      weeklyHours: course.weekly_hours,
      sortOrder: course.sort_order,
      courseCode: course.course_code,
      courseName: course.course_name,
      courseDefaultCredits: course.default_credits,
      courseDefaultWeeklyHours: course.default_weekly_hours
    });
  }
  
  const periods = Array.from(periodsMap.values()).sort((a, b) => a.levelNumber - b.levelNumber);

  const relationsMap = new Map();
  for (const rel of data.relationsData) {
    const to = rel.to_course_id;
    if (!relationsMap.has(to)) {
      relationsMap.set(to, { prerequisites: [], corequisites: [], equivalents: [] });
    }
    
    if (rel.relation_type === "PREREQUISITE") {
      relationsMap.get(to).prerequisites.push(rel.from_course_id);
    } else if (rel.relation_type === "COREQUISITE") {
      relationsMap.get(to).corequisites.push(rel.from_course_id);
    } else if (rel.relation_type === "EQUIVALENT") {
      relationsMap.get(to).equivalents.push(rel.from_course_id);
    }
  }

  const relationsEntries = Array.from(relationsMap.entries()).map(([k, v]) => `    [${k}, ${JSON.stringify(v)}]`);

  const tsCode = `import type { StudyPlanDetail } from "@/lib/types";

export const demoStudyPlanDetail: StudyPlanDetail = {
  plan: {
    id: 48,
    academic_unit_id: 10,
    external_plan_id: 412,
    name: "INGENIERÍA EN COMPUTACIÓN",
    academic_degree: "LICENCIATURA",
    modality_name: "SEMESTRAL",
  },
  periods: ${JSON.stringify(periods, null, 4).replace(/"/g, '"')},
  courseRelations: new Map([
${relationsEntries.join(",\n")}
  ]),
};
`;

  await fs.writeFile("src/routes/home/-data.ts", tsCode);
}

main();
