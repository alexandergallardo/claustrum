/**
 * Syncs career programs and their campus availability from ITCR endpoints.
 * Fetches programs from both the Curriculum API and Student Records HTML,
 * then creates academic_unit_campus relationships in Supabase.
 */

import type { SupabaseRestClient } from "../types";
import { logSection, logSuccess, logInfo } from "../logging";
import {
  fetchProgramCareersFromCurriculumApi,
  fetchProgramsByCampusFromStudentRecordsHtml,
} from "../fetchers";
import { chunk } from "../utils";
import { buildIngestMaps } from "./index";

export interface SyncProgramsAndCampusAvailabilityParams {
  supabase: SupabaseRestClient;
  universityId: number;
  dryRun: boolean;
  campusCodes?: string[];
  maxCampuses?: number;
}

export interface Program {
  code: string;
  name: string;
}

export interface CampusProgramPair {
  campus_code: string;
  program_code: string;
  program_name: string;
}

export interface AcademicUnitCampus {
  academic_unit_id: number;
  campus_id: number;
}

export interface Campus {
  id: number;
  code: string;
}

/**
 * Syncs career programs from ITCR endpoints and creates academic_unit_campus relationships.
 * 
 * This function:
 * 1. Fetches all campuses from Supabase
 * 2. For each campus, fetches programs from both the Curriculum API and Student Records HTML
 * 3. Deduplicates programs and creates academic_unit_campus relationships
 * 4. Upserts the relationships into Supabase
 * 
 * Programs are synced for ALL campuses to maintain a complete catalog, but the campus
 * filtering options allow limiting which campuses are processed for the relationships.
 *
 * @param params - Sync parameters
 * @param params.supabase - Supabase REST client instance
 * @param params.universityId - Parent university ID (used for reference, not directly in this function)
 * @param params.dryRun - When true, simulates the operation without database changes
 * @param params.campusCodes - Optional specific campus codes to filter by
 * @param params.maxCampuses - Optional maximum number of campuses to process
 */
interface CampusRow {
  id: number;
  code: string;
}

export async function syncProgramsAndCampusAvailability(
  params: SyncProgramsAndCampusAvailabilityParams,
): Promise<void> {
  logSection("Sync: career programs + career_campus");
  const campuses: CampusRow[] = await params.supabase.select({
    table: "campus",
    columns: "id,code",
    limit: 50_000,
  });

  let campusCodes: string[] = campuses
    .map((c) => c.code)
    .sort((a, b) => a.localeCompare(b, "en"));

  logInfo(
    `Syncing programs for ALL ${campusCodes.length} campuses (catalog completeness)`,
  );

  if (params.campusCodes && params.campusCodes.length > 0) {
    const allow = new Set(params.campusCodes.map((x) => x.toUpperCase()));
    campusCodes = campusCodes.filter((c) => allow.has(c.toUpperCase()));
  }
  if (params.maxCampuses && params.maxCampuses > 0) {
    campusCodes = campusCodes.slice(0, params.maxCampuses);
  }

  const allPrograms: Map<string, Program> = new Map<string, Program>();
  const campusProgramPairs: CampusProgramPair[] = [];

  for (const campusCode of campusCodes) {
    const [programsJson, programsHtml] = await Promise.all([
      fetchProgramCareersFromCurriculumApi(campusCode).catch(() => []),
      fetchProgramsByCampusFromStudentRecordsHtml(campusCode).catch(() => []),
    ]);

    for (const p of [...programsJson, ...programsHtml]) {
      if (!p.code) continue;
      allPrograms.set(p.code, { code: p.code, name: p.name });
      campusProgramPairs.push({
        campus_code: campusCode,
        program_code: p.code,
        program_name: p.name,
      });
    }
  }

  const maps = await buildIngestMaps({ supabase: params.supabase });

  const academicUnitCampusRows: Array<{
    academic_unit_id: number;
    campus_id: number;
  }> = [];

  const seenAcademicUnitCampusPairs = new Set<string>();

  for (const pair of campusProgramPairs) {
    const campus_id = maps.campusIdByCode.get(pair.campus_code);
    const academic_unit_id = maps.academicUnitIdByCode.get(
      pair.program_code,
    );
    if (!campus_id || !academic_unit_id) continue;

    const key = `${academic_unit_id}:${campus_id}`;
    if (seenAcademicUnitCampusPairs.has(key)) continue;
    seenAcademicUnitCampusPairs.add(key);

    academicUnitCampusRows.push({ academic_unit_id, campus_id });
  }

  for (const batch of chunk(academicUnitCampusRows, 5000) as typeof academicUnitCampusRows[]) {
    await params.supabase.upsertMany({
      table: "academic_unit_campus",
      rows: batch,
      onConflict: "academic_unit_id,campus_id",
      dryRun: params.dryRun,
    });
  }

  logSuccess(
    `Synced ${allPrograms.size} programs across ${campusCodes.length} campuses`,
  );
}
