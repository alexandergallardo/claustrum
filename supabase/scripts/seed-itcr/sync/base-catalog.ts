/**
 * Base catalog seeding for the ITCR seed script.
 * Seeds foundational lookup tables (country) required by other sync steps.
 * 
 * NOTE: academic_modality is seeded by syncModalities from the Guia Horarios API
 * to ensure we have the correct modalities that actually exist in the system.
 */

import type { SupabaseRestClient } from "../types";
import { setStep } from "../logging";

export interface SeedBaseCatalogParams {
  supabase: SupabaseRestClient;
  dryRun: boolean;
}

/**
 * Seeds the base catalog tables (country) in Supabase.
 * Country is a foundational lookup table that must be seeded before
 * running any dependent sync steps.
 *
 * @param params - Seeding parameters
 * @param params.supabase - Supabase REST client instance
 * @param params.dryRun - When true, simulates the operation without database changes
 */
export async function seedBaseCatalog(params: SeedBaseCatalogParams): Promise<void> {
  setStep("base-catalog");

  await params.supabase.upsertMany({
    table: "country",
    rows: [
      { name: "Costa Rica", iso2_code: "CR" },
      { name: "United States", iso2_code: "US" },
      { name: "Mexico", iso2_code: "MX" },
      { name: "Colombia", iso2_code: "CO" },
      { name: "Panama", iso2_code: "PA" },
    ],
    onConflict: "iso2_code",
    dryRun: params.dryRun,
    showProgress: true,
  });
}
