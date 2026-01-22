/**
 * Syncs academic modalities from Guía Horarios into Supabase.
 *
 * Fetches modality data (code, name, periods_per_year) from the Guía Horarios API
 * and upserts them into the academic_modality table.
 */

import type { SupabaseRestClient } from "../types";
import { logSection } from "../logging";
import { fetchModalitiesFromGuiaHorarios } from "../fetchers";

interface SyncModalitiesParams {
  supabase: SupabaseRestClient;
  alteonp: string;
  dryRun: boolean;
}

/**
 * Syncs academic modalities from Guía Horarios into the database.
 *
 * This function fetches modality definitions from the Guía Horarios API endpoint
 * (cargaModalidadPeriodos) and upserts them into the academic_modality table.
 * Modalities are identified by their code and upserted to preserve existing data.
 *
 * @param params - Parameters for the sync operation
 * @param params.supabase - Supabase REST client for database operations
 * @param params.alteonp - AlteonP cookie value for Guía Horarios authentication
 * @param params.dryRun - When true, simulates the operation without database changes
 */
export async function syncModalities(params: SyncModalitiesParams): Promise<void> {
  logSection("Sync: academic modalities");
  const mods = await fetchModalitiesFromGuiaHorarios(params.alteonp);

  const rows = mods.map((m) => ({
    code: m.code,
    name: m.name,
    periods_per_year: m.periods_per_year,
  }));

  await params.supabase.upsertMany({
    table: "academic_modality",
    rows,
    onConflict: "code",
    dryRun: params.dryRun,
  });
}
