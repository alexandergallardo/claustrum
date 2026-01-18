/**
 * Academic units sync for the ITCR seed script.
 * Syncs academic units (escuelas) from Guía Horarios into Supabase.
 */

import type { SupabaseRestClient } from "../types";
import {
  logSection,
  logSuccess,
  logInfo,
} from "../logging";
import { fetchAcademicUnitsFromGuiaHorarios } from "../fetchers/guia-horarios";

export interface SyncAcademicUnitsParams {
  supabase: SupabaseRestClient;
  universityId: number;
  alteonp: string;
  dryRun: boolean;
}

/**
 * Syncs academic units from Guía Horarios into the academic_unit table.
 * Academic units represent schools/departments within the university.
 *
 * @param params - Sync parameters
 */
export async function syncAcademicUnits(
  params: SyncAcademicUnitsParams,
): Promise<void> {
  logSection("Sync: academic units");
  const units = await fetchAcademicUnitsFromGuiaHorarios(params.alteonp);
  logInfo(`Found ${units.length} academic units from Guía Horarios`);

  const rows = units.map((u) => ({
    university_id: params.universityId,
    code: u.code,
    name: u.name,
  }));

  await params.supabase.upsertMany({
    table: "academic_unit",
    rows,
    onConflict: "code",
    dryRun: params.dryRun,
  });

  logSuccess(`Synced ${rows.length} academic units`);
}
