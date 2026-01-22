/**
 * Syncs academic terms from Student Records API into Supabase.
 *
 * Fetches academic term data (year, period, modality, display name) from the
 * ITCR Student Records (Expediente Estudiantil) API and upserts them into
 * the academic_term table.
 */

import type { SupabaseRestClient } from "../types";
import { logSection } from "../logging";
import { fetchTermsFromStudentRecordsApi } from "../fetchers";
import { requireAcademicModalityIdByCode } from "../utils";

interface SyncTermsParams {
  supabase: SupabaseRestClient;
  dryRun: boolean;
  maxTerms?: number;
  termKeys?: string[];
}

/**
 * Syncs academic terms from the Student Records API into the database.
 *
 * This function fetches academic term definitions from the Student Records API endpoint
 * and upserts them into the academic_term table. Terms are validated against existing
 * modalities to ensure referential integrity before insertion.
 *
 * @param params - Parameters for the sync operation
 * @param params.supabase - Supabase REST client for database operations
 * @param params.dryRun - When true, simulates the operation without database changes
 * @param params.maxTerms - Optional limit on the number of terms to process
 * @param params.termKeys - Optional array of specific term keys to sync
 */
export async function syncTerms(params: SyncTermsParams): Promise<void> {
  logSection("Sync: academic terms");
  let terms = await fetchTermsFromStudentRecordsApi();

  if (params.termKeys && params.termKeys.length > 0) {
    const allow = new Set(params.termKeys);
    terms = terms.filter((t) => allow.has(t.external_key));
  }

  if (params.maxTerms && params.maxTerms > 0) {
    terms = terms.slice(0, params.maxTerms);
  }

  const modalityCodes = Array.from(
    new Set(terms.map((t) => t.modality_code)),
  ).sort();

  if (modalityCodes.length > 0) {
    for (const code of modalityCodes) {
      await requireAcademicModalityIdByCode({
        supabase: params.supabase,
        code,
        context: "syncTerms -> validate modalities",
      });
    }
  }

  const modalities = await params.supabase.select(
    {
      table: "academic_modality",
      columns: "id,code",
      limit: 10_000,
    },
  );
  const modalityIdByCode = new Map<string, number>();
  for (const m of modalities) modalityIdByCode.set(m.code, m.id);

  const rows = terms
    .map((t) => {
      const modalityId = modalityIdByCode.get(t.modality_code);
      if (!modalityId) return null;
      return {
        academic_modality_id: modalityId,
        year: t.year,
        period_number: t.period_number,
        external_key: t.external_key,
        display_name: t.display_name,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  await params.supabase.upsertMany({
    table: "academic_term",
    rows,
    onConflict: "external_key",
    dryRun: params.dryRun,
  });
}
