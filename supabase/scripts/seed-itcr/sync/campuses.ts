/**
 * Campus synchronization for the ITCR seed script.
 * Syncs campus data from multiple external sources into the Supabase database.
 */

import type { SyncCampusesParams } from "../types";
import { logSection } from "../logging";
import {
  fetchCampusesFromCurriculumApi,
  fetchCampusesFromStudentRecordsHtml,
} from "../fetchers";
import { SupabaseRestClient } from "../supabase-client";

export type { SyncCampusesParams };

/**
 * Synchronizes campus records from the Curriculum API and Student Records HTML endpoints.
 * Fetches campuses from both sources, merges them by code (avoiding duplicates),
 * filters by optional campus codes or max count, and upserts them to the database.
 *
 * @param params - Synchronization parameters
 * @param params.supabase - Supabase REST client instance
 * @param params.universityId - Parent university ID to associate campuses with
 * @param params.dryRun - When true, simulates the operation without database changes
 * @param params.maxCampuses - Optional maximum number of campuses to process
 * @param params.campusCodes - Optional specific campus codes to filter by
 */
export async function syncCampuses(params: {
  supabase: SupabaseRestClient;
  universityId: number;
  dryRun: boolean;
  maxCampuses?: number;
  campusCodes?: string[];
}): Promise<void> {
  logSection("Sync: campuses");
  const [hist, active] = await Promise.all([
    fetchCampusesFromCurriculumApi(),
    fetchCampusesFromStudentRecordsHtml(),
  ]);

  const byCode = new Map<string, { code: string; name: string }>();
  for (const c of hist) byCode.set(c.code, c);
  for (const c of active) byCode.set(c.code, c);

  let campuses = Array.from(byCode.values()).sort((a, b) =>
    a.code.localeCompare(b.code, "en"),
  );

  if (params.campusCodes && params.campusCodes.length > 0) {
    const allow = new Set(params.campusCodes.map((x) => x.toUpperCase()));
    campuses = campuses.filter((c) => allow.has(c.code.toUpperCase()));
  }

  if (params.maxCampuses && params.maxCampuses > 0) {
    campuses = campuses.slice(0, params.maxCampuses);
  }

  const rows = campuses.map((c) => ({
    university_id: params.universityId,
    code: c.code,
    name: c.name,
    is_active: true,
  }));

  await params.supabase.upsertMany({
    table: "campus",
    rows,
    onConflict: "code",
    dryRun: params.dryRun,
  });
}
