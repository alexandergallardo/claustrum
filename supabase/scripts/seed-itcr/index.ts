/**
 * Main entry point for the ITCR seed script.
 * Orchestrates the complete seeding process by coordinating modules for
 * configuration, data fetching, database syncing, and logging.
 */

import {
  parseArgs,
  env,
  normalizeSupabaseUrl,
} from "./config";
import { setStep, printTopLevelFailureReport } from "./logging";
import { SupabaseRestClient } from "./supabase-client";
import { acquireGuiaHorariosAlteonpCookie } from "./fetchers";
import {
  seedBaseCatalog,
  syncCampuses,
  syncTerms,
  syncModalities,
  syncAcademicUnits,
  syncProgramsAndCampusAvailability,
  syncCurriculumPlans,
  syncSchedule,
} from "./sync";

/**
 * Main entry point for the ITCR seed script.
 * Parses arguments, initializes the Supabase client, and orchestrates the seeding process.
 * @returns Promise that resolves when seeding is complete
 */
export async function run(): Promise<void> {
  const args = parseArgs(process.argv);

  const supabaseUrl = normalizeSupabaseUrl(env("VITE_SUPABASE_URL"));
  const secretKey = env("SUPABASE_SECRET_KEY");

  const supabase = new SupabaseRestClient({ supabaseUrl, secretKey });

  const universityResult = await supabase.ensureItcrUniversity({
    countryIso2: "CR",
    universityName: "Instituto Tecnológico de Costa Rica",
    universityShortName: "ITCR",
    dryRun: args.dryRun,
  });

  if (!universityResult) {
    throw new Error("Failed to create/find ITCR university in database");
  }

  const { universityId } = universityResult;
  const alteonp = await acquireGuiaHorariosAlteonpCookie();

  type SyncStep = { name: string; fn: () => Promise<void> };

  const syncSteps: SyncStep[] = [
    { name: "base-catalog", fn: () => seedBaseCatalog({ supabase, dryRun: args.dryRun }) },
    { name: "campuses", fn: () => syncCampuses({ supabase, universityId, dryRun: args.dryRun, maxCampuses: args.maxCampuses, campusCodes: args.campusCodes }) },
    { name: "modalities", fn: () => syncModalities({ supabase, alteonp, dryRun: args.dryRun }) },
    { name: "terms", fn: () => syncTerms({ supabase, dryRun: args.dryRun, maxTerms: args.maxTerms, termKeys: args.termKeys }) },
    { name: "academic-units", fn: () => syncAcademicUnits({ supabase, universityId, alteonp, dryRun: args.dryRun }) },
    { name: "programs", fn: () => syncProgramsAndCampusAvailability({ supabase, universityId, dryRun: args.dryRun, campusCodes: args.campusCodes, maxCampuses: args.maxCampuses }) },
    { name: "curriculum", fn: () => syncCurriculumPlans({ supabase, dryRun: args.dryRun, campusCodes: args.campusCodes, maxCampuses: args.maxCampuses, maxPlansPerProgram: args.maxPlansPerProgram }) },
    { name: "schedule", fn: () => syncSchedule({ supabase, dryRun: args.dryRun, campusCodes: args.campusCodes, maxCampuses: args.maxCampuses, termKeys: args.termKeys, maxTerms: args.maxTerms, alteonp }) },
  ];

  const shouldRunStep = (stepName: string): boolean => {
    if (args.only.size === 0) return true;
    return args.only.has(stepName);
  };

  for (const step of syncSteps) {
    if (shouldRunStep(step.name)) {
      await step.fn();
    }
  }

  setStep("seeding complete");
}

run().catch(printTopLevelFailureReport);

export {};
