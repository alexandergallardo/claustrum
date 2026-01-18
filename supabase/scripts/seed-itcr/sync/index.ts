import type { SupabaseRestClient } from "../types";

export interface IngestMaps {
  campusIdByCode: Map<string, number>;
  academicUnitIdByCode: Map<string, number>;
  academicModalityIdByCode: Map<string, number>;
  academicTermIdByExternalKey: Map<string, number>;
  courseIdByCode: Map<string, number>;
  studyPlanIdByUnitCodeAndExternalPlanId: Map<string, number>;
}

export async function buildIngestMaps(params: {
  supabase: SupabaseRestClient;
}): Promise<IngestMaps> {
  const [campuses, units, modalities, terms, courses, studyPlans] =
    await Promise.all([
      params.supabase.select({
        table: "campus",
        columns: "id,code",
        limit: 50_000,
      }) as Promise<{ id: number; code: string }[]>,
      params.supabase.select({
        table: "academic_unit",
        columns: "id,code",
        limit: 50_000,
      }) as Promise<{ id: number; code: string }[]>,
      params.supabase.select({
        table: "academic_modality",
        columns: "id,code",
        limit: 50_000,
      }) as Promise<{ id: number; code: string }[]>,
      params.supabase.select({
        table: "academic_term",
        columns: "id,external_key",
        limit: 50_000,
      }) as Promise<{ id: number; external_key: string }[]>,
      params.supabase.select({
        table: "course",
        columns: "id,code",
        limit: 200_000,
      }) as Promise<{ id: number; code: string }[]>,
      params.supabase.select({
        table: "study_plan",
        columns: "id,external_plan_id,academic_unit_id",
        limit: 100_000,
      }) as Promise<{
        id: number;
        external_plan_id: number;
        academic_unit_id: number;
      }[]>,
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
      `${unitCode}::${sp.external_plan_id}`,
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

export * from './base-catalog';
export * from './campuses';
export * from './terms';
export * from './academic-units';
export * from './modalities';
export * from './programs';
export * from './curriculum';
export * from './schedule';
