/**
 * ITCR Data Seeder - Modular Entry Point
 * 
 * This file re-exports all functionality from the modular seed-itcr module.
 * The main implementation has been refactored into separate modules for better
 * maintainability and readability.
 * 
 * Original monolithic file has been divided into:
 * - config.ts: Configuration and constants
 * - types.ts: TypeScript interfaces and types
 * - logging.ts: Logging and progress tracking
 * - http-client.ts: HTTP utilities and HTML parsing
 * - supabase-client.ts: Supabase PostgREST client
 * - normalizers/: Data normalization functions
 * - utils/: Utility functions
 * - fetchers/: External API fetchers
 * - sync/: Database synchronization functions
 */

export * from './seed-itcr/index';

// Re-export commonly used items for backwards compatibility
export { PRIMARY_CAMPUSES, URLS, parseArgs, env } from './seed-itcr/config';
export { SupabaseRestClient } from './seed-itcr/supabase-client';
export { 
  seedBaseCatalog, 
  syncCampuses, 
  syncTerms, 
  syncAcademicUnits, 
  syncModalities,
  syncProgramsAndCampusAvailability,
  syncCurriculumPlans,
  syncSchedule 
} from './seed-itcr/sync';
