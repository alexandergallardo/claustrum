/**
 * Configuration module for the ITCR seed script.
 * Contains constants, environment utilities, and argument parsing.
 */

export const PRIMARY_CAMPUSES = ["AL", "CA", "LM", "SC", "SJ"];

export const URLS = {
  curriculum: {
    base: "https://tecdigital.tec.ac.cr/tds-curriculum-exp",
    campusesJson:
      "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_sedes_json",
    careersByCampus:
      "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_carreras_json",
    plansByProgram:
      "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_planes_json",
    planDetails:
      "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/json_draw_angular",
  },
  studentRecords: {
    base: "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil",
    periods:
      "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_periodos_tds_lib",
    campusesHtml:
      "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_sedes_tds_lib",
    programsByCampusHtml:
      "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_carreras_tds_lib",
    scheduleGuide:
      "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/tabla_guia_horario",
  },
  guiaHorarios: {
    base: "https://tec-appsext.itcr.ac.cr/guiahorarios",
    cargaEscuelas:
      "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaEscuelas",
    cargaModalidadPeriodos:
      "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaModalidadPeriodos",
    getdatosEscuelaAno:
      "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/getdatosEscuelaAno",
    escuelaAspx: "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx",
  },
} as const;

interface Args {
  dryRun: boolean;
  only: Set<string>;
  maxCampuses?: number;
  maxPlansPerProgram?: number;
  maxTerms?: number;
  campusCodes?: string[];
  termKeys?: string[];
}

/**
 * Parse command line arguments for the seed script.
 * @param argv - Command line arguments array
 * @returns Parsed arguments object
 */
export function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, only: new Set() };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (a === "--only") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --only");
      for (const part of v.split(",")) {
        const name = part.trim();
        if (name) args.only.add(name);
      }
      continue;
    }
    if (a === "--max-campuses") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --max-campuses");
      args.maxCampuses = Number(v);
      continue;
    }
    if (a === "--max-plans-per-program") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --max-plans-per-program");
      args.maxPlansPerProgram = Number(v);
      continue;
    }
    if (a === "--max-terms") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --max-terms");
      args.maxTerms = Number(v);
      continue;
    }
    if (a === "--campuses") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --campuses");
      args.campusCodes = v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      continue;
    }
    if (a === "--terms") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --terms");
      args.termKeys = v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      continue;
    }
  }

  return args;
}

/**
 * Get a required environment variable.
 * @param name - Environment variable name
 * @returns The environment variable value
 * @throws Error if the variable is not set or empty
 */
export function env(name: string): string {
  const v = process.env[name];
  if (v == null || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

/**
 * Get a boolean environment variable.
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set (default: false)
 * @returns True if the value is "1", "true", "yes", or "on"
 */
export function envBool(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v == null || v === "") return defaultValue;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * Normalize a Supabase URL by removing trailing slashes.
 * @param url - The Supabase URL to normalize
 * @returns The normalized URL
 */
export function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Get the PostgREST base URL for a Supabase project.
 * @param supabaseUrl - The Supabase project URL
 * @returns The PostgREST API base URL
 */
export function postgrestBaseUrl(supabaseUrl: string): string {
  return `${normalizeSupabaseUrl(supabaseUrl)}/rest/v1`;
}
