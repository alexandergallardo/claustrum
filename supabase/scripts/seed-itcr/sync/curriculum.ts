/**
 * Syncs curriculum data from ITCR Curriculum API into Supabase.
 *
 * This function:
 * 1. Fetches programs from the Curriculum API for each campus
 * 2. Fetches study plans for each program
 * 3. Fetches detailed curriculum information (courses, levels, requirements)
 * 4. Creates/updates study plans, levels, courses, and course relations
 *
 * The Curriculum API is campus-scoped: plans are fetched per campus, but plan details
 * are cached and reused across campuses since they are identical.
 */

import type { CurriculumPlanDetails } from "../types";
import {
  logSection,
  logProgress,
  logSuccess,
  logInfo,
} from "../logging";
import {
  fetchProgramCareersFromCurriculumApi,
  fetchPlansByProgramFromCurriculumApi,
  fetchPlanDetailsFromCurriculumApi,
} from "../fetchers";
import { SupabaseRestClient } from "../supabase-client";
import {
  safeNumber,
  chunk,
  requireAcademicModalityIdByCode,
  normalizeModalityToCode,
  normalizeCourseName,
  isValidCourseCode,
  keyStudyPlan,
} from "../utils";

const PRIMARY_CAMPUSES = ["AL", "CA", "LM", "SC", "SJ"];

export interface SyncCurriculumPlansParams {
  supabase: SupabaseRestClient;
  dryRun: boolean;
  campusCodes?: string[];
  maxCampuses?: number;
  maxPlansPerProgram?: number;
}

interface IngestMaps {
  campusIdByCode: Map<string, number>;
  academicUnitIdByCode: Map<string, number>;
  academicModalityIdByCode: Map<string, number>;
  academicTermIdByExternalKey: Map<string, number>;
  courseIdByCode: Map<string, number>;
  studyPlanIdByUnitCodeAndExternalPlanId: Map<string, number>;
}

async function buildIngestMaps(params: {
  supabase: SupabaseRestClient;
}): Promise<IngestMaps> {
  const [campuses, units, modalities, terms, courses, studyPlans] =
    await Promise.all([
      params.supabase.select<{ id: number; code: string }>({
        table: "campus",
        columns: "id,code",
        limit: 50_000,
      }),
      params.supabase.select<{ id: number; code: string }>({
        table: "academic_unit",
        columns: "id,code",
        limit: 50_000,
      }),
      params.supabase.select<{ id: number; code: string }>({
        table: "academic_modality",
        columns: "id,code",
        limit: 50_000,
      }),
      params.supabase.select<{ id: number; external_key: string }>({
        table: "academic_term",
        columns: "id,external_key",
        limit: 50_000,
      }),
      params.supabase.select<{ id: number; code: string }>({
        table: "course",
        columns: "id,code",
        limit: 200_000,
      }),
      params.supabase.select<{
        id: number;
        external_plan_id: number;
        academic_unit_id: number;
      }>({
        table: "study_plan",
        columns: "id,external_plan_id,academic_unit_id",
        limit: 100_000,
      }),
    ]);

  const campusIdByCode = new Map<string, number>();
  for (const c of campuses) campusIdByCode.set(c.code, c.id);

  const academicUnitIdByCode = new Map<string, number>();
  for (const u of units) academicUnitIdByCode.set(u.code, u.id);

  const academicModalityIdByCode = new Map<string, number>();
  for (const m of modalities) academicModalityIdByCode.set(m.code, m.id);

  const academicTermIdByExternalKey = new Map<string, number>();
  for (const t of terms) academicTermIdByExternalKey.set(t.external_key, t.id);

  const courseIdByCode = new Map<string, number>();
  for (const c of courses) courseIdByCode.set(c.code, c.id);

  const unitCodeById = new Map<number, string>();
  for (const u of units) unitCodeById.set(u.id, u.code);

  const studyPlanIdByUnitCodeAndExternalPlanId = new Map<string, number>();
  for (const sp of studyPlans) {
    const unitCode = unitCodeById.get(sp.academic_unit_id);
    if (!unitCode) continue;
    studyPlanIdByUnitCodeAndExternalPlanId.set(
      keyStudyPlan(unitCode, safeNumber(sp.external_plan_id, 0)),
      sp.id,
    );
  }

  return {
    campusIdByCode,
    academicUnitIdByCode,
    academicModalityIdByCode,
    academicTermIdByExternalKey,
    courseIdByCode,
    studyPlanIdByUnitCodeAndExternalPlanId,
  };
}

/**
 * Syncs curriculum plans, levels, courses, and relations from the ITCR Curriculum API.
 *
 * @param params - Sync parameters
 * @param params.supabase - Supabase REST client instance
 * @param params.dryRun - When true, simulates the operation without database changes
 * @param params.campusCodes - Optional specific campus codes to filter by
 * @param params.maxCampuses - Optional maximum number of campuses to process
 * @param params.maxPlansPerProgram - Optional maximum number of plans per program to process
 */
export async function syncCurriculumPlans(
  params: SyncCurriculumPlansParams,
): Promise<void> {
  logSection("Sync: curriculum (study plans, levels, courses, relations)");

  const campuses = await params.supabase.select<{ code: string }>({
    table: "campus",
    columns: "code",
    limit: 1000,
  });

  let campusCodes = params.campusCodes ?? campuses.map((c) => c.code);

  const primaryCampusSet = new Set(PRIMARY_CAMPUSES);
  if (!params.campusCodes) {
    campusCodes = campusCodes.filter((code) => primaryCampusSet.has(code));
  }

  if (params.maxCampuses && params.maxCampuses > 0) {
    campusCodes = campusCodes.slice(0, params.maxCampuses);
  }

  if (campusCodes.length === 0) {
    logInfo("No campuses to process");
    return;
  }

  logInfo(
    `  • Syncing curriculum for primary campuses only: ${campusCodes.join(", ")}`,
  );

  const programsByCampus = new Map<
    string,
    Array<{ code: string; name: string }>
  >();
  const programToCampuses = new Map<string, Set<string>>();
  const programCodes = new Set<string>();

  logProgress(`Fetching programs from ${campusCodes.length} campuses...`);
  for (let i = 0; i < campusCodes.length; i++) {
    const campusCode = campusCodes[i]!;
    logProgress(
      `  [${i + 1}/${campusCodes.length}] Fetching programs for campus ${campusCode}...`,
    );

    const careers = await fetchProgramCareersFromCurriculumApi(
      campusCode,
    ).catch(() => []);

    programsByCampus.set(campusCode, careers);

    for (const p of careers) {
      programCodes.add(p.code);
      if (!programToCampuses.has(p.code))
        programToCampuses.set(p.code, new Set());
      programToCampuses.get(p.code)!.add(campusCode);
    }
  }
  logSuccess(`Found ${programCodes.size} unique programs across all campuses`);

  const maps = await buildIngestMaps({ supabase: params.supabase });

  const fetchedPlanDetailsByExternalPlanId = new Map<
    number,
    CurriculumPlanDetails
  >();

  const planHeaders: Array<{
    academic_unit_id: number;
    academic_modality_id: number;
    external_plan_id: number;
    name: string;
    academic_degree: string | null;
    first_level_number: number;
  }> = [];

  const planCampusPairs: Array<{
    study_plan_key: string;
    campus_code: string;
  }> = [];
  const planLevels: Array<{
    study_plan_key: string;
    level_number: number;
    level_label: string;
  }> = [];
  const planLevelCourses: Array<{
    study_plan_key: string;
    level_number: number;
    course_code: string;
    credits: number;
    weekly_hours: number;
    sort_order: number;
  }> = [];
  const planRelations: Array<{
    study_plan_key: string;
    from_course_code: string;
    to_course_code: string;
    relation_type: "PREREQUISITE" | "COREQUISITE" | "EQUIVALENT";
  }> = [];

  const courseUpserts = new Map<
    string,
    {
      code: string;
      name: string;
      credits: number;
      hours: number;
    }
  >();

  logProgress(
    `Processing curriculum details for ${campusCodes.length} campuses (plan availability per campus; details cached per plan)...`,
  );

  let campusIdx = 0;
  for (const campusCode of campusCodes) {
    campusIdx++;
    const careers = programsByCampus.get(campusCode) ?? [];
    logProgress(
      `  [${campusIdx}/${campusCodes.length}] Campus ${campusCode}: processing ${careers.length} programs...`,
    );

    let programIdx = 0;
    for (const program of careers) {
      programIdx++;
      const programCode = program.code;
      const academic_unit_id = maps.academicUnitIdByCode.get(programCode);
      if (!academic_unit_id) continue;

      logProgress(
        `    [${programIdx}/${careers.length}] Program ${programCode}: fetching study plans (campus-scoped list)...`,
      );

      let plans = await fetchPlansByProgramFromCurriculumApi({
        campusCode,
        programCode,
      }).catch(() => []);

      if (params.maxPlansPerProgram && params.maxPlansPerProgram > 0) {
        plans = plans.slice(0, params.maxPlansPerProgram);
      }

      let planIdx = 0;
      for (const p of plans) {
        planIdx++;

        let details = fetchedPlanDetailsByExternalPlanId.get(p.externalPlanId);

        if (!details) {
          logProgress(
            `      [${planIdx}/${plans.length}] Plan ${p.externalPlanId}: fetching details...`,
          );

          details =
            (await fetchPlanDetailsFromCurriculumApi(p.externalPlanId).catch(
              () => null,
            )) ?? undefined;

          if (!details) {
            logInfo(
              `      ⚠ Plan ${p.externalPlanId}: could not fetch details, skipping`,
            );
            continue;
          }

          fetchedPlanDetailsByExternalPlanId.set(p.externalPlanId, details);
        }

        const modalityCode = normalizeModalityToCode(
          String(details.modality ?? ""),
        );
        if (!modalityCode) continue;

        const academic_modality_id = await requireAcademicModalityIdByCode({
          supabase: params.supabase,
          code: modalityCode,
          context: `syncCurriculumPlans -> plan ${p.externalPlanId}`,
        });

        const external_plan_id = safeNumber(
          details.id_curriculum ?? p.externalPlanId,
          0,
        );
        if (external_plan_id <= 0) continue;

        const spKey = keyStudyPlan(programCode, external_plan_id);

        planHeaders.push({
          academic_unit_id,
          academic_modality_id,
          external_plan_id,
          name:
            String(details.dsc_curriculum ?? p.name).trim() ||
            String(p.name).trim(),
          academic_degree: details.academic_degree
            ? String(details.academic_degree).trim()
            : null,
          first_level_number: safeNumber(details.first_level, 0),
        });

        planCampusPairs.push({
          study_plan_key: spKey,
          campus_code: campusCode,
        });

        for (let li = 0; li < details.levels.length; li++) {
          const level = details.levels[li]!;
          const label = String(level.id ?? "").trim();
          const levelNumMatch = /(\d+)/.exec(label);
          const level_number = levelNumMatch
            ? safeNumber(levelNumMatch[1], li)
            : li;

          planLevels.push({
            study_plan_key: spKey,
            level_number,
            level_label: label || `Nivel ${level_number}`,
          });

          for (let ci = 0; ci < level.courses.length; ci++) {
            const c = level.courses[ci]!;
            const course_code = String(c.id_course ?? "")
              .trim()
              .toUpperCase();
            if (!course_code) continue;

            let courseName = String(c.name ?? "").trim();
            if (courseName.toUpperCase() === course_code) {
              courseName = "";
            } else if (courseName) {
              courseName = normalizeCourseName(courseName);
            }

            courseUpserts.set(course_code, {
              code: course_code,
              name: courseName,
              credits: safeNumber(c.credits, 0),
              hours: safeNumber(c.hours, 0),
            });

            planLevelCourses.push({
              study_plan_key: spKey,
              level_number,
              course_code,
              credits: safeNumber(c.credits, 0),
              weekly_hours: safeNumber(c.hours, 0),
              sort_order: ci * 10,
            });

            for (const r of c.requirements ?? []) {
              const req = String(r.id ?? "")
                .trim()
                .toUpperCase();
              if (!req || !isValidCourseCode(req)) continue;

              planRelations.push({
                study_plan_key: spKey,
                from_course_code: course_code,
                to_course_code: req,
                relation_type: "PREREQUISITE",
              });

              if (!courseUpserts.has(req)) {
                courseUpserts.set(req, {
                  code: req,
                  name: "",
                  credits: 0,
                  hours: 0,
                });
              }
            }

            for (const r of c.co_requirements ?? []) {
              const req = String(r.id ?? "")
                .trim()
                .toUpperCase();
              if (!req || !isValidCourseCode(req)) continue;

              planRelations.push({
                study_plan_key: spKey,
                from_course_code: course_code,
                to_course_code: req,
                relation_type: "COREQUISITE",
              });

              if (!courseUpserts.has(req)) {
                courseUpserts.set(req, {
                  code: req,
                  name: "",
                  credits: 0,
                  hours: 0,
                });
              }
            }

            for (const eq of c.equivalent ?? []) {
              const eq_code = String(eq.id ?? "")
                .trim()
                .toUpperCase();
              if (!eq_code || !isValidCourseCode(eq_code)) continue;

              planRelations.push({
                study_plan_key: spKey,
                from_course_code: course_code,
                to_course_code: eq_code,
                relation_type: "EQUIVALENT",
              });

              if (!courseUpserts.has(eq_code)) {
                courseUpserts.set(eq_code, {
                  code: eq_code,
                  name: "",
                  credits: 0,
                  hours: 0,
                });
              }
            }
          }
        }
      }
    }
  }

  logProgress(`Processing ${courseUpserts.size} courses...`);
  const courseRows = Array.from(courseUpserts.values()).map((c) => {
    return {
      code: c.code,
      name: c.name,
      default_credits: c.credits,
      default_weekly_hours: c.hours,
    };
  });

  const batches = chunk(courseRows, 5000);
  logInfo(
    `Upserting courses in ${batches.length} batches of up to 5000 rows each`,
  );
  let batchIdx = 0;
  for (const batch of batches) {
    batchIdx++;
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "course",
      rows: batch,
      onConflict: "code",
      dryRun: params.dryRun,
      showProgress: false,
    });
    logProgress(
      `  Course batch ${batchIdx}/${batches.length}: ${batch.length} rows upserted`,
    );
  }
  logSuccess(`All ${courseRows.length} courses processed`);

  logProgress(`Processing ${planHeaders.length} study plan headers...`);

  const uniquePlanHeaders = Array.from(
    new Map(
      planHeaders.map((h) => [
        `${h.academic_unit_id}-${h.external_plan_id}`,
        h,
      ]),
    ).values(),
  );

  if (uniquePlanHeaders.length !== planHeaders.length) {
    logInfo(
      `Deduplicated ${planHeaders.length} plans to ${uniquePlanHeaders.length} unique plans`,
    );
  }

  const planBatches = chunk(uniquePlanHeaders, 1000);
  logInfo(
    `Upserting study plans in ${planBatches.length} batches of up to 1000 rows each`,
  );
  let planBatchIdx = 0;
  for (const batch of planBatches) {
    planBatchIdx++;
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "study_plan",
      rows: batch,
      onConflict: "academic_unit_id,external_plan_id",
      dryRun: params.dryRun,
      showProgress: false,
    });
    logProgress(
      `  Study plan batch ${planBatchIdx}/${planBatches.length}: ${batch.length} rows upserted`,
    );
  }
  logSuccess(`All ${uniquePlanHeaders.length} study plans processed`);

  const maps3 = await buildIngestMaps({ supabase: params.supabase });

  logProgress(
    `Processing ${planCampusPairs.length} study plan-campus associations...`,
  );
  const spCampusRows: Array<{
    study_plan_id: number;
    campus_id: number;
    valid_from: Date | null;
    valid_to: Date | null;
  }> = [];
  for (const spc of planCampusPairs) {
    const [unitCode, externalPlanIdStr] = spc.study_plan_key.split("::");
    const study_plan_id = maps3.studyPlanIdByUnitCodeAndExternalPlanId.get(
      keyStudyPlan(unitCode!, safeNumber(externalPlanIdStr, 0)),
    );
    const campus_id = maps.campusIdByCode.get(spc.campus_code);
    if (!study_plan_id || !campus_id) continue;
    spCampusRows.push({
      study_plan_id,
      campus_id,
      valid_from: null,
      valid_to: null,
    });
  }
  const spCampusBatches = chunk(spCampusRows, 2000);
  for (const batch of spCampusBatches) {
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "study_plan_campus",
      rows: batch,
      onConflict: "study_plan_id,campus_id",
      dryRun: params.dryRun,
      showProgress: false,
    });
  }
  logSuccess(`${spCampusRows.length} study plan-campus associations processed`);

  logProgress(`Processing ${planLevels.length} study plan levels...`);

  const levelMap = new Map<
    string,
    {
      study_plan_key: string;
      level_number: number;
      level_label: string;
    }
  >();
  for (const l of planLevels) {
    const key = `${l.study_plan_key}::${l.level_number}`;
    if (!levelMap.has(key)) {
      levelMap.set(key, l);
    }
  }

  const levelRows: Array<{
    study_plan_id: number;
    level_number: number;
    level_label: string;
  }> = [];
  for (const l of levelMap.values()) {
    const [unitCode, externalPlanIdStr] = l.study_plan_key.split("::");
    const study_plan_id = maps3.studyPlanIdByUnitCodeAndExternalPlanId.get(
      keyStudyPlan(unitCode!, safeNumber(externalPlanIdStr, 0)),
    );
    if (!study_plan_id) continue;
    levelRows.push({
      study_plan_id,
      level_number: l.level_number,
      level_label: l.level_label,
    });
  }
  const levelBatches = chunk(levelRows, 2000);
  for (const batch of levelBatches) {
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "study_plan_level",
      rows: batch,
      onConflict: "study_plan_id,level_number",
      dryRun: params.dryRun,
      showProgress: false,
    });
  }
  logSuccess(`${levelRows.length} study plan levels processed`);

  logProgress("Building level ID mappings...");
  const levels = await params.supabase.select<{
    id: number;
    study_plan_id: number;
    level_number: number;
  }>({
    table: "study_plan_level",
    columns: "id,study_plan_id,level_number",
    limit: 200_000,
  });
  const levelIdByPlanIdAndNumber = new Map<string, number>();
  for (const l of levels) {
    levelIdByPlanIdAndNumber.set(`${l.study_plan_id}::${l.level_number}`, l.id);
  }

  logProgress(
    `Processing ${planLevelCourses.length} level-course associations...`,
  );

  const plcMap = new Map<
    string,
    {
      study_plan_key: string;
      level_number: number;
      course_code: string;
      credits: number;
      weekly_hours: number;
      sort_order: number;
    }
  >();
  for (const plc of planLevelCourses) {
    const key = `${plc.study_plan_key}::${plc.level_number}::${plc.course_code}`;
    if (!plcMap.has(key)) {
      plcMap.set(key, plc);
    }
  }

  const plcRows: Array<{
    study_plan_level_id: number;
    course_id: number;
    credits: number;
    weekly_hours: number;
    sort_order: number;
  }> = [];
  for (const plc of plcMap.values()) {
    const [unitCode, externalPlanIdStr] = plc.study_plan_key.split("::");
    const study_plan_id = maps3.studyPlanIdByUnitCodeAndExternalPlanId.get(
      keyStudyPlan(unitCode!, safeNumber(externalPlanIdStr, 0)),
    );
    if (!study_plan_id) continue;
    const level_id = levelIdByPlanIdAndNumber.get(
      `${study_plan_id}::${plc.level_number}`,
    );
    const course_id = maps3.courseIdByCode.get(plc.course_code);
    if (!level_id || !course_id) continue;
    plcRows.push({
      study_plan_level_id: level_id,
      course_id,
      credits: plc.credits,
      weekly_hours: plc.weekly_hours,
      sort_order: plc.sort_order,
    });
  }
  const plcBatches = chunk(plcRows, 2000);
  for (const batch of plcBatches) {
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "study_plan_level_course",
      rows: batch,
      onConflict: "study_plan_level_id,course_id",
      dryRun: params.dryRun,
      showProgress: false,
    });
  }
  logSuccess(`${plcRows.length} level-course associations processed`);

  logProgress(`Processing ${planRelations.length} course relations...`);

  const relMap = new Map<string, (typeof planRelations)[0]>();
  for (const r of planRelations) {
    const key = `${r.study_plan_key}::${r.from_course_code}::${r.to_course_code}::${r.relation_type}`;
    if (!relMap.has(key)) {
      relMap.set(key, r);
    }
  }

  const relRows: Array<{
    study_plan_id: number;
    from_course_id: number;
    to_course_id: number;
    relation_type: string;
  }> = [];
  for (const r of relMap.values()) {
    const [unitCode, externalPlanIdStr] = r.study_plan_key.split("::");
    const study_plan_id = maps3.studyPlanIdByUnitCodeAndExternalPlanId.get(
      keyStudyPlan(unitCode!, safeNumber(externalPlanIdStr, 0)),
    );
    if (!study_plan_id) continue;

    const from_course_id = maps3.courseIdByCode.get(r.from_course_code);
    const to_course_id = maps3.courseIdByCode.get(r.to_course_code);
    if (!from_course_id || !to_course_id) continue;

    relRows.push({
      study_plan_id,
      from_course_id,
      to_course_id,
      relation_type: r.relation_type,
    });
  }
  const relBatches = chunk(relRows, 2000);
  for (const batch of relBatches) {
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "course_relation",
      rows: batch,
      onConflict: "study_plan_id,from_course_id,to_course_id,relation_type",
      dryRun: params.dryRun,
      showProgress: false,
    });
  }
  logSuccess(`${relRows.length} course relations processed`);
}
