/**
 * Ingests catalog and schedule data from ITCR public endpoints into Supabase via PostgREST.
 *
 * Data sources are merged as follows:
 * - Student Records HTML provides course groups with classroom, capacity, and reserved seats.
 * - Guía Horarios provides meeting times and reservation targeting by campus/unit/study plan.
 * - Meetings fall back to HTML-extracted schedule text when Guía Horarios has no match.
 *
 * Catalog values (academic_modality, country, university) are seeded with full metadata
 * and must never be overwritten with placeholders.
 *
 * Set SEED_INSECURE_HTTPS=1 to skip TLS verification for ITCR HTTPS endpoints only.
 */

const PRIMARY_CAMPUSES = ["AL", "CA", "LM", "SC", "SJ"];

interface Args {
  dryRun: boolean;
  only: Set<string>;
  maxCampuses?: number;
  maxPlansPerProgram?: number;
  maxTerms?: number;
  campusCodes?: string[];
  termKeys?: string[];
}

function parseArgs(argv: string[]): Args {
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

function env(name: string): string {
  const v = process.env[name];
  if (v == null || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

async function requireAcademicModalityIdByCode(params: {
  supabase: SupabaseRestClient;
  code: string;
  context: string;
}): Promise<number> {
  const code = String(params.code ?? "")
    .trim()
    .toUpperCase();
  if (!code) {
    throw new Error(`Missing modality code (${params.context})`);
  }

  const modality = await params.supabase.selectOne<{
    id: number;
    name: string;
  }>({
    table: "academic_modality",
    columns: "id,name",
    filter: `code=eq.${encodeURIComponent(code)}`,
  });

  if (!modality) {
    throw new Error(
      [
        `Missing academic_modality for code="${code}" (${params.context}).`,
        "This seeder does not create placeholder modalities.",
        "Ensure modalities are seeded with full metadata (name, periods_per_year) before running dependent steps.",
      ].join("\n"),
    );
  }

  // Extra guard: if a placeholder somehow exists, fail fast instead of spreading bad data.
  if (
    String(modality.name ?? "")
      .trim()
      .toUpperCase() === code
  ) {
    throw new Error(
      [
        `Detected placeholder academic_modality row for code="${code}" (name="${modality.name}").`,
        "This must be fixed by re-seeding academic_modality with real names and periods_per_year.",
      ].join("\n"),
    );
  }

  return modality.id;
}

let __lastStep: string | null = null;
function setStep(step: string): void {
  __lastStep = step;
}
function getLastStep(): string {
  return __lastStep ?? "(unknown)";
}

// Progress tracking utilities
function logSection(title: string): void {
  console.log(`\n${title}`);
}

function logProgress(message: string): void {
  console.log(`  ⋯ ${message}`);
}

function logSuccess(message: string): void {
  console.log(`  ✓ ${message}`);
}

function logInfo(message: string): void {
  console.log(`  • ${message}`);
}

function printTopLevelFailureReport(err: unknown): void {
  const insecure = envBool("SEED_INSECURE_HTTPS", false);

  const e = err instanceof Error ? err : new Error(String(err));
  const stack = e.stack ?? "";
  const message = e.message ?? String(err);

  // Best-effort categorization.
  const isItcr =
    message.includes("tec-appsext.itcr.ac.cr") ||
    stack.includes("tec-appsext.itcr.ac.cr");
  const isSupabaseRest =
    message.includes("/rest/v1") || stack.includes("/rest/v1");

  const lines: string[] = [];
  lines.push("");
  lines.push("========================================");
  lines.push("ITCR seeder failed");
  lines.push("========================================");
  lines.push(`Last step: ${getLastStep()}`);
  lines.push(`SEED_INSECURE_HTTPS: ${insecure ? "enabled" : "disabled"}`);
  lines.push(
    `Likely source: ${isSupabaseRest ? "Supabase REST (/rest/v1)" : isItcr ? "ITCR HTTPS endpoints" : "unknown"}`,
  );
  lines.push("");
  lines.push("Error message:");
  lines.push(message);
  lines.push("========================================");
  lines.push("");

  console.error(lines.join("\n"));
}

function envBool(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v == null || v === "") return defaultValue;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function isItcrHttpsUrl(url: string): boolean {
  // Only allow insecure TLS bypass for the external ITCR domains used by this script
  // and only for HTTPS URLs.
  if (!url.startsWith("https://")) return false;

  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  return host === "tec-appsext.itcr.ac.cr" || host.endsWith(".itcr.ac.cr");
}

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function postgrestBaseUrl(supabaseUrl: string): string {
  return `${normalizeSupabaseUrl(supabaseUrl)}/rest/v1`;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function httpJson<T>(
  method: HttpMethod,
  url: string,
  opts?: {
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
  },
): Promise<T> {
  setStep(`httpJson ${method} ${url}`);
  const ac = new AbortController();
  const timer =
    opts?.timeoutMs != null
      ? setTimeout(() => ac.abort(), opts.timeoutMs)
      : null;

  // Skip TLS verification for ITCR endpoints when SEED_INSECURE_HTTPS is set.
  const insecureHttps = envBool("SEED_INSECURE_HTTPS", false);
  const shouldBypassTls = insecureHttps && isItcrHttpsUrl(url);
  const prevRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  try {
    if (shouldBypassTls) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const res = await fetch(url, {
      method,
      headers: {
        ...(opts?.body ? { "Content-Type": "application/json" } : {}),
        ...(opts?.headers ?? {}),
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      signal: ac.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        [
          `HTTP ${res.status} ${res.statusText}`,
          `url: ${url}`,
          "response:",
          text,
        ].join("\n"),
      );
    }

    return text ? (JSON.parse(text) as T) : (null as T);
  } finally {
    if (timer) clearTimeout(timer);

    if (shouldBypassTls) {
      if (prevRejectUnauthorized == null) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevRejectUnauthorized;
      }
    }
  }
}

async function httpText(
  method: HttpMethod,
  url: string,
  opts?: {
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  },
): Promise<{ text: string; headers: Headers }> {
  setStep(`httpText ${method} ${url}`);
  const ac = new AbortController();
  const timer =
    opts?.timeoutMs != null
      ? setTimeout(() => ac.abort(), opts.timeoutMs)
      : null;

  // Skip TLS verification for ITCR endpoints when SEED_INSECURE_HTTPS is set.
  const insecureHttps = envBool("SEED_INSECURE_HTTPS", false);
  const shouldBypassTls = insecureHttps && isItcrHttpsUrl(url);
  const prevRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  try {
    if (shouldBypassTls) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const res = await fetch(url, {
      method,
      headers: {
        ...(opts?.headers ?? {}),
      },
      body: opts?.body,
      signal: ac.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        [
          `HTTP ${res.status} ${res.statusText}`,
          `url: ${url}`,
          "response:",
          text,
        ].join("\n"),
      );
    }

    return { text, headers: res.headers };
  } finally {
    if (timer) clearTimeout(timer);

    if (shouldBypassTls) {
      if (prevRejectUnauthorized == null) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevRejectUnauthorized;
      }
    }
  }
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseHtmlSpans(html: string): Array<{ value: string; text: string }> {
  const out: Array<{ value: string; text: string }> = [];
  const re = /<span\s+[^>]*value=['"]([^'"]+)['"][^>]*>(.*?)<\/span>/gi;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(html)) !== null) {
    const value = String(m[1] ?? "").trim();
    const text = String(m[2] ?? "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (value) out.push({ value, text });
  }
  return out;
}

function parseScheduleGuideTable(html: string): Array<{
  courseCode: string;
  courseName: string;
  groupCode: string;
  credits: number;
  scheduleText: string;
  classroom: string | null;
  professorName: string | null;
  capacity: number;
  courseType: string | null;
  groupType: string | null;
  reserved: number;
}> {
  const rows: Array<{
    courseCode: string;
    courseName: string;
    groupCode: string;
    credits: number;
    scheduleText: string;
    classroom: string | null;
    professorName: string | null;
    capacity: number;
    courseType: string | null;
    groupType: string | null;
    reserved: number;
  }> = [];

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let tr: RegExpExecArray | null = null;
  while ((tr = trRe.exec(html)) !== null) {
    const trHtml = tr[1] ?? "";
    const tds: string[] = [];
    let td: RegExpExecArray | null = null;
    while ((td = tdRe.exec(trHtml)) !== null) {
      const raw = String(td[1] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      tds.push(raw);
    }

    if (tds.length < 11) continue;

    const courseCode = tds[0] ?? "";
    const courseName = tds[1] ?? "";
    const groupCode = tds[2] ?? "";
    const credits = safeNumber(tds[3], 0);
    const scheduleText = tds[4] ?? "";
    const classroomRaw = tds[5] ?? "";
    const professorRaw = tds[6] ?? "";
    const capacity = safeNumber(tds[7], 0);
    const courseType = tds[8] ?? null;
    const groupType = tds[9] ?? null;
    const reserved = safeNumber(tds[10], 0);

    if (!courseCode || !groupCode) continue;

    rows.push({
      courseCode,
      courseName,
      groupCode,
      credits,
      scheduleText,
      classroom:
        classroomRaw && classroomRaw.toLowerCase() !== "no disponible"
          ? classroomRaw
          : null,
      professorName: professorRaw ? professorRaw : null,
      capacity,
      courseType: courseType || null,
      groupType: groupType || null,
      reserved,
    });
  }

  return rows;
}

function weekdayFromSpanish(day: string): number | null {
  const d = day.trim().toLowerCase();
  if (d.startsWith("lunes")) return 1;
  if (d.startsWith("martes")) return 2;
  if (d.startsWith("miércoles") || d.startsWith("miercoles")) return 3;
  if (d.startsWith("jueves")) return 4;
  if (d.startsWith("viernes")) return 5;
  if (d.startsWith("sábado") || d.startsWith("sabado")) return 6;
  if (d.startsWith("domingo")) return 7;
  return null;
}

function parseScheduleTextToMeetings(
  scheduleText: string,
): Array<{ weekday: number; startsAt: string; endsAt: string }> {
  // Expected examples: "Martes - 7:30:9:20"
  const s = scheduleText.replace(/\s+/g, " ").trim();
  const m =
    /^([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s*-\s*(\d{1,2}:\d{2})\s*:\s*(\d{1,2}:\d{2})$/.exec(
      s,
    );
  if (!m) return [];
  const wd = weekdayFromSpanish(m[1] ?? "");
  if (!wd) return [];
  const startsAt = m[2]!;
  const endsAt = m[3]!;
  return [{ weekday: wd, startsAt, endsAt }];
}

/**
 * Supabase PostgREST helper.
 */
class SupabaseRestClient {
  private baseUrl: string;
  private apikey: string;

  constructor(opts: { supabaseUrl: string; secretKey: string }) {
    this.baseUrl = postgrestBaseUrl(opts.supabaseUrl);
    this.apikey = opts.secretKey;
  }

  async upsertOne<T extends object>(params: {
    table: string;
    row: T;
    onConflict: string;
    dryRun: boolean;
    showProgress?: boolean;
  }): Promise<void> {
    return this.upsertMany<T>({
      table: params.table,
      rows: [params.row],
      onConflict: params.onConflict,
      dryRun: params.dryRun,
      showProgress: params.showProgress,
    });
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      apikey: this.apikey,
      ...(extra ?? {}),
    };
  }

  async upsertMany<T extends object>(params: {
    table: string;
    rows: T[];
    onConflict: string;
    dryRun: boolean;
    showProgress?: boolean;
  }): Promise<void> {
    const { table, rows, onConflict, dryRun, showProgress = true } = params;

    if (rows.length === 0) {
      if (showProgress) console.log(`  ✓ ${table}: no rows to upsert`);
      return;
    }

    if (showProgress)
      console.log(`  ⋯ ${table}: upserting ${rows.length} rows...`);

    if (dryRun) {
      if (showProgress) console.log(`  ✓ ${table}: dry-run complete`);
      return;
    }

    const url = `${this.baseUrl}/${encodeURIComponent(table)}?on_conflict=${encodeURIComponent(
      onConflict,
    )}`;

    await httpJson(methodForUpsert(), url, {
      headers: this.headers({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: rows,
      timeoutMs: 120_000,
    });

    if (showProgress) console.log(`  ✓ ${table}: ${rows.length} rows upserted`);
  }

  async insertMany<T extends object>(params: {
    table: string;
    rows: T[];
    dryRun: boolean;
    showProgress?: boolean;
  }): Promise<void> {
    const { table, rows, dryRun, showProgress = true } = params;

    if (rows.length === 0) return;

    if (showProgress) logProgress(`${table}: inserting ${rows.length} rows...`);

    if (dryRun) {
      if (showProgress)
        logSuccess(`${table}: dry-run complete (${rows.length} rows)`);
      return;
    }

    const url = `${this.baseUrl}/${encodeURIComponent(table)}`;

    await httpJson("POST", url, {
      headers: this.headers({
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: rows,
      timeoutMs: 60_000,
    });

    if (showProgress) logSuccess(`${table}: ${rows.length} rows inserted`);
  }

  async select<T>(params: {
    table: string;
    columns: string;
    filter?: string;
    limit?: number;
  }): Promise<T[]> {
    const limit = params.limit ?? 10_000;
    const qs = [
      `select=${encodeURIComponent(params.columns)}`,
      `limit=${encodeURIComponent(String(limit))}`,
      params.filter ? params.filter : null,
    ].filter(Boolean);
    const url = `${this.baseUrl}/${encodeURIComponent(params.table)}?${qs.join("&")}`;
    return httpJson<T[]>("GET", url, {
      headers: this.headers({ Accept: "application/json" }),
      timeoutMs: 60_000,
    });
  }

  async selectOne<T>(params: {
    table: string;
    columns: string;
    filter: string;
  }): Promise<T | null> {
    const rows = await this.select<T>({
      table: params.table,
      columns: params.columns,
      filter: params.filter,
      limit: 1,
    });
    return rows[0] ?? null;
  }

  async deleteWhere(params: {
    table: string;
    filter: string;
    dryRun: boolean;
  }): Promise<void> {
    console.log(`- ${params.table}: deleteWhere(${params.filter})`);
    if (params.dryRun) return;
    const url = `${this.baseUrl}/${encodeURIComponent(params.table)}?${params.filter}`;
    await httpJson("DELETE", url, {
      headers: this.headers({ Prefer: "return=minimal" }),
      timeoutMs: 120_000,
    });
  }

  async ensureItcrUniversity(params: {
    countryIso2: string;
    universityName: string;
    universityShortName: string;
    dryRun: boolean;
  }): Promise<{ countryId: number; universityId: number } | null> {
    const COUNTRY_NAME_BY_ISO2: Record<string, string> = {
      CR: "Costa Rica",
      US: "United States",
      MX: "Mexico",
      CO: "Colombia",
      PA: "Panama",
    };

    const countryName =
      COUNTRY_NAME_BY_ISO2[params.countryIso2] ?? params.countryIso2;

    await this.upsertMany({
      table: "country",
      rows: [
        {
          name: countryName,
          iso2_code: params.countryIso2,
        },
      ],
      onConflict: "iso2_code",
      dryRun: params.dryRun,
      showProgress: true,
    });

    const country = await this.selectOne<{ id: number }>({
      table: "country",
      columns: "id",
      filter: `iso2_code=eq.${encodeURIComponent(params.countryIso2)}`,
    });

    if (!country) return null;
    const uni = await this.selectOne<{ id: number }>({
      table: "university",
      columns: "id",
      filter: `short_name=eq.${encodeURIComponent(params.universityShortName)}`,
    });

    if (!uni) {
      await this.insertMany({
        table: "university",
        rows: [
          {
            country_id: country.id,
            name: params.universityName,
            short_name: params.universityShortName,
          },
        ],
        dryRun: params.dryRun,
      });
    } else if (!params.dryRun) {
      const url = `${this.baseUrl}/university?id=eq.${uni.id}`;
      await httpJson("PATCH", url, {
        headers: this.headers({
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        }),
        body: {
          country_id: country.id,
          name: params.universityName,
          short_name: params.universityShortName,
        },
        timeoutMs: 60_000,
      });
    }

    const uni2 = await this.selectOne<{ id: number }>({
      table: "university",
      columns: "id",
      filter: `short_name=eq.${encodeURIComponent(params.universityShortName)}`,
    });

    if (!uni2) return null;
    return { countryId: country.id, universityId: uni2.id };
  }
}

function methodForUpsert(): HttpMethod {
  return "POST";
}

async function seedBaseCatalog(params: {
  supabase: SupabaseRestClient;
  dryRun: boolean;
}): Promise<void> {
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

  await params.supabase.upsertMany({
    table: "academic_modality",
    rows: [
      { code: "S", name: "SEMESTRE", periods_per_year: 2 },
      { code: "V", name: "VERANO", periods_per_year: 1 },
      { code: "B", name: "BIMESTRE", periods_per_year: 7 },
      { code: "C", name: "CUATRIMESTRE", periods_per_year: 3 },
      { code: "T", name: "TRIMESTRE", periods_per_year: 4 },
      { code: "A", name: "ANUAL", periods_per_year: 1 },
      { code: "H", name: "CENTROS FORMACION HUMANISTICA", periods_per_year: 6 },
      { code: "M", name: "MENSUAL", periods_per_year: 12 },
      { code: "I", name: "INTENSIVO", periods_per_year: 2 },
      { code: "N", name: "BIANUAL", periods_per_year: 1 },
    ],
    onConflict: "code",
    dryRun: params.dryRun,
    showProgress: true,
  });
}

const URLS = {
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

type CurriculumCampusesResponse = {
  sedes: Array<{ key: string; data: string }>;
};

type CurriculumCareersResponse = {
  carreras: Array<{ key: string; data: string }>;
};

type CurriculumPlansResponse = {
  planes: Array<{ key: number; data: string }>;
};

interface CurriculumPlanDetails {
  dsc_curriculum: string;
  id_curriculum: number;
  modality: string;
  academic_degree?: string;
  first_level?: number;
  levels: Array<{
    id: string;
    courses: Array<{
      id_course: string;
      name: string;
      trucatedName?: string;
      credits: number;
      hours: number;
      requirements?: Array<{ id: string }>;
      co_requirements?: Array<{ id: string }>;
      equivalent?: Array<{ id: string }>;
      tEquiv?: string;
    }>;
  }>;
}

async function fetchCampusesFromCurriculumApi(): Promise<
  Array<{ code: string; name: string }>
> {
  const data = await httpJson<CurriculumCampusesResponse>(
    "GET",
    URLS.curriculum.campusesJson,
    {
      headers: { Accept: "application/json" },
      timeoutMs: 30_000,
    },
  );

  const seen = new Set<string>();
  const rows: Array<{ code: string; name: string }> = [];

  for (const s of data.sedes ?? []) {
    const code = String(s.key ?? "").trim();
    const name = String(s.data ?? "").trim();
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    rows.push({ code, name });
  }

  return rows;
}

async function fetchCampusesFromStudentRecordsHtml(): Promise<
  Array<{ code: string; name: string }>
> {
  const { text } = await httpText("POST", URLS.studentRecords.campusesHtml, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    timeoutMs: 30_000,
  });

  const spans = parseHtmlSpans(text);
  const rows: Array<{ code: string; name: string }> = [];
  const seen = new Set<string>();
  for (const s of spans) {
    const code = s.value.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rows.push({ code, name: s.text.trim() });
  }
  return rows;
}

async function fetchProgramsByCampusFromStudentRecordsHtml(
  campusCode: string,
): Promise<Array<{ code: string; name: string }>> {
  const body = `id_sede=${encodeURIComponent(campusCode)}`;
  const { text } = await httpText(
    "POST",
    URLS.studentRecords.programsByCampusHtml,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
      },
      body,
      timeoutMs: 30_000,
    },
  );

  const spans = parseHtmlSpans(text);
  const rows: Array<{ code: string; name: string }> = [];
  const seen = new Set<string>();
  for (const s of spans) {
    const code = s.value.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rows.push({ code, name: s.text.trim() });
  }
  return rows;
}

async function fetchProgramCareersFromCurriculumApi(
  campusCode: string,
): Promise<Array<{ code: string; name: string }>> {
  const url = `${URLS.curriculum.careersByCampus}?id_sede=${encodeURIComponent(campusCode)}`;
  const data = await httpJson<CurriculumCareersResponse>("GET", url, {
    headers: { Accept: "application/json" },
    timeoutMs: 30_000,
  });

  const rows: Array<{ code: string; name: string }> = [];
  const seen = new Set<string>();
  for (const c of data.carreras ?? []) {
    const code = String(c.key ?? "").trim();
    const name = String(c.data ?? "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rows.push({ code, name });
  }
  return rows;
}

async function fetchPlansByProgramFromCurriculumApi(params: {
  campusCode: string;
  programCode: string;
}): Promise<Array<{ externalPlanId: number; name: string }>> {
  const url = `${URLS.curriculum.plansByProgram}?id_sede=${encodeURIComponent(params.campusCode)}&id_depto=${encodeURIComponent(params.programCode)}`;
  const data = await httpJson<CurriculumPlansResponse>("GET", url, {
    headers: { Accept: "application/json" },
    timeoutMs: 30_000,
  });

  const rows: Array<{ externalPlanId: number; name: string }> = [];
  for (const p of data.planes ?? []) {
    rows.push({
      externalPlanId: safeNumber(p.key, 0),
      name: String(p.data ?? "").trim(),
    });
  }
  return rows.filter((r) => r.externalPlanId > 0);
}

function normalizeModalityToCode(modalityName: string): string | null {
  const m = modalityName.trim().toLowerCase();
  if (m.startsWith("semestre")) return "S";
  if (m.startsWith("verano")) return "V";
  if (m.startsWith("bimestre")) return "B";
  if (m.startsWith("cuatrimestre")) return "C";
  if (m.startsWith("trimestre")) return "T";
  if (m.startsWith("anual")) return "A";
  if (m.startsWith("mensual")) return "M";
  if (m.startsWith("intensivo")) return "I";
  if (m.startsWith("bianual")) return "N";
  if (m.startsWith("centros formacion humanistica")) return "H";
  return null;
}

/**
 * Normalize course names to a consistent format.
 * Examples:
 *   "examen diagnóstico" -> "Examen Diagnóstico"
 *   "Bases de datos Ii" -> "Bases de Datos II"
 *   "PROGRAMACION ORIENTADA A OBJETOS" -> "Programación Orientada a Objetos"
 */
function normalizeCourseName(name: string): string {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "";
  
  // Split by spaces and process each word
  const words = trimmed.split(/\s+/);
  const normalized = words.map((word) => {
    // Check if the entire word is a Roman numeral or abbreviation (all caps, short)
    if (/^[IVX]+$/.test(word) && word.length <= 3) {
      return word.toUpperCase(); // I, II, III, IV, V, VI, VII, VIII, IX, X
    }
    
    // Check for ordinal suffixes
    if (/^(\d+)(st|nd|rd|th)$/i.test(word)) {
      return word.toLowerCase();
    }
    
    // Regular word: capitalize first letter, lowercase rest
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  return normalized.join(" ");
}

async function fetchPlanDetailsFromCurriculumApi(
  externalPlanId: number,
): Promise<CurriculumPlanDetails> {
  const url = `${URLS.curriculum.planDetails}?id_plan=${encodeURIComponent(String(externalPlanId))}`;
  return httpJson<CurriculumPlanDetails>("GET", url, {
    headers: { Accept: "application/json" },
    timeoutMs: 60_000,
  });
}

type PeriodRow = { key: string; data: string };

function parseAcademicTermKey(
  key: string,
): { year: number; modalityCode: string; periodNumber: number } | null {
  const m = /^(\d{4})_([A-Z])_(\d+)$/.exec(key.trim());
  if (!m) return null;
  return { year: Number(m[1]), modalityCode: m[2], periodNumber: Number(m[3]) };
}

async function fetchTermsFromStudentRecordsApi(): Promise<
  Array<{
    external_key: string;
    display_name: string;
    year: number;
    modality_code: string;
    period_number: number;
  }>
> {
  const rows = await httpJson<PeriodRow[]>(
    "POST",
    URLS.studentRecords.periods,
    {
      headers: {
        Accept: "application/json",
      },
      timeoutMs: 30_000,
    },
  );

  const out: Array<{
    external_key: string;
    display_name: string;
    year: number;
    modality_code: string;
    period_number: number;
  }> = [];
  const seen = new Set<string>();

  for (const r of rows ?? []) {
    const key = String(r.key ?? "").trim();
    const data = String(r.data ?? "").trim();
    if (!key || seen.has(key)) continue;

    const parsed = parseAcademicTermKey(key);
    if (!parsed) continue;

    seen.add(key);
    out.push({
      external_key: key,
      display_name: data || key,
      year: parsed.year,
      modality_code: parsed.modalityCode,
      period_number: parsed.periodNumber,
    });
  }

  return out;
}

type GuiaHorariosEnvelope = { d: string };

type GuiaEscuelaRow = {
  IDE_DEPTO: string;
  DSC_DEPTO: string;
};

type GuiaModalityRow = {
  IDE_MODALIDAD: string;
  NOMBRE: string;
  CANT_PERIODOS: number;
};

interface GuiaOfertaEscuelaAnoRow {
  DSC_SEDE: string;
  IDE_MATERIA: string;
  DSC_MATERIA: string;
  IDE_GRUPO: number;
  DSC_DEPTO: string;
  CAN_CREDITOS: number;
  HORAS: number;
  NOM_DIA: string;
  IDE_MODALIDAD: string;
  IDE_PER_MOD: number;
  NUM_ANO: number;
  DSC_MODALIDAD: string;
  TIPO_CURSO: string;
  HINICIO: string;
  HFIN: string;
  NOM_PROFESOR: string;
  RESERVA_SEDE: string;
  RESERVA_DEPTO: string;
  RESERVA_PLAN: string;
}

function extractAlteonpFromSetCookie(setCookie: string): string | null {
  const m = /(?:^|;\s*)AlteonP=([^;]+)/i.exec(setCookie);
  return m?.[1] ?? null;
}

async function acquireGuiaHorariosAlteonpCookie(): Promise<string> {
  const { headers } = await httpText("GET", URLS.guiaHorarios.escuelaAspx, {
    headers: {
      Accept: "text/html",
      "User-Agent": "horarios-seed-script",
    },
    timeoutMs: 30_000,
  });

  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie;
  const allSetCookie =
    typeof getSetCookie === "function" ? getSetCookie.call(headers) : [];
  for (const sc of allSetCookie) {
    const v = extractAlteonpFromSetCookie(sc);
    if (v) return v;
  }

  const legacy = headers.get("set-cookie");
  if (legacy) {
    const v = extractAlteonpFromSetCookie(legacy);
    if (v) return v;
  }

  throw new Error("Unable to acquire AlteonP cookie from guiahorarios");
}

function guiaHeaders(alteonp: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: `AlteonP=${alteonp}`,
  };
}

function normalizeCampusNameForMatch(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n");
}

function normalizeAcademicUnitNameForMatch(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n");
}

function reservationPlanKeyToExternalPlanId(planKey: string): number | null {
  // Upstream often uses things like "412" or "412.Ingenieria..." or empty string.
  const s = String(planKey ?? "").trim();
  if (!s) return null;
  const m = /^(\d+)/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface IngestUuids {
  campusIdByCode: Map<string, number>;
  academicUnitIdByCode: Map<string, number>;
  academicModalityIdByCode: Map<string, number>;
  academicTermIdByExternalKey: Map<string, number>;
  courseIdByCode: Map<string, number>;
  studyPlanIdByUnitCodeAndExternalPlanId: Map<string, number>;
}

function keyStudyPlan(programCode: string, externalPlanId: number): string {
  return `${programCode}::${externalPlanId}`;
}

async function fetchOfferingsByAcademicUnitAndYearFromGuiaHorarios(params: {
  alteonp: string;
  academicUnitCode: string; // escuela
  year: number; // ano
}): Promise<GuiaOfertaEscuelaAnoRow[]> {
  const envl = await httpJson<GuiaHorariosEnvelope>(
    "POST",
    URLS.guiaHorarios.getdatosEscuelaAno,
    {
      headers: guiaHeaders(params.alteonp),
      body: { escuela: params.academicUnitCode, ano: String(params.year) },
      timeoutMs: 90_000,
    },
  );

  // `d` is a JSON string
  const raw = JSON.parse(envl.d) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw as GuiaOfertaEscuelaAnoRow[];
}

async function buildIngestMaps(params: {
  supabase: SupabaseRestClient;
}): Promise<IngestUuids> {
  const [campuses, units, modalities, terms, courses, studyPlans] =
    await Promise.all([
      params.supabase.select<{ id: number; code: string }>({
        table: "campus",
        columns: "id,code",
        limit: 50_000,
      }),
      params.supabase.select<{ id: number; code: string }>({
        table: "academic_unit",
        columns: "id,code",
        limit: 50_000,
      }),
      params.supabase.select<{ id: number; code: string }>({
        table: "academic_modality",
        columns: "id,code",
        limit: 50_000,
      }),
      params.supabase.select<{ id: number; external_key: string }>({
        table: "academic_term",
        columns: "id,external_key",
        limit: 50_000,
      }),
      params.supabase.select<{ id: number; code: string }>({
        table: "course",
        columns: "id,code",
        limit: 200_000,
      }),
      params.supabase.select<{
        id: number;
        external_plan_id: number;
        academic_unit_id: number;
      }>({
        table: "study_plan",
        columns: "id,external_plan_id,academic_unit_id",
        limit: 100_000,
      }),
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
      keyStudyPlan(unitCode, safeNumber(sp.external_plan_id, 0)),
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

/**
 * Validates if a string is a valid course code (not a message/placeholder text).
 * Valid course codes follow the pattern: 2-3 letter prefix + digits.
 * Examples: IC1802, MA0101, CA2125, FH0178, AEN100
 * 
 * Invalid: "NO HAY MATERIAS EQUIVALENTES EN EL PLAN", "", "ELECTIVA ABIERTA"
 */
function isValidCourseCode(code: string): boolean {
  const trimmed = String(code ?? "").trim().toUpperCase();
  // Must start with letters (2-3) followed by digits
  // No spaces, no words like "HAY", "MATERIAS", "EN", "EL", "PLAN", "ELECTIVA", "ABIERTA"
  return /^[A-Z]{2,3}\d{3,5}$/.test(trimmed);
}

async function fetchAcademicUnitsFromGuiaHorarios(
  alteonpValue: string,
): Promise<Array<{ code: string; name: string }>> {
  const envl = await httpJson<GuiaHorariosEnvelope>(
    "POST",
    URLS.guiaHorarios.cargaEscuelas,
    {
      headers: {
        ...guiaHeaders(alteonpValue),
      },
      body: {},
      timeoutMs: 30_000,
    },
  );

  const parsed = JSON.parse(envl.d) as GuiaEscuelaRow[];
  const seen = new Set<string>();
  const rows: Array<{ code: string; name: string }> = [];

  for (const r of parsed ?? []) {
    const code = String(r.IDE_DEPTO ?? "").trim();
    const name = String(r.DSC_DEPTO ?? "").trim();
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    rows.push({ code, name });
  }

  return rows;
}

async function fetchModalitiesFromGuiaHorarios(
  alteonpValue: string,
): Promise<Array<{ code: string; name: string; periods_per_year: number }>> {
  const envl = await httpJson<GuiaHorariosEnvelope>(
    "POST",
    URLS.guiaHorarios.cargaModalidadPeriodos,
    {
      headers: {
        ...guiaHeaders(alteonpValue),
      },
      body: {},
      timeoutMs: 30_000,
    },
  );

  const parsed = JSON.parse(envl.d) as GuiaModalityRow[];
  const seen = new Set<string>();
  const rows: Array<{ code: string; name: string; periods_per_year: number }> =
    [];

  for (const r of parsed ?? []) {
    const code = String(r.IDE_MODALIDAD ?? "").trim();
    const name = String(r.NOMBRE ?? "").trim();
    const ppy = Number(r.CANT_PERIODOS ?? 0);
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);

    rows.push({
      code,
      name,
      periods_per_year: Number.isFinite(ppy) ? ppy : 0,
    });
  }

  return rows;
}

// =========================================================================
// Transform + upsert into DB schema
// =========================================================================

async function syncCampuses(params: {
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

async function syncTerms(params: {
  supabase: SupabaseRestClient;
  dryRun: boolean;
  maxTerms?: number;
  termKeys?: string[];
}): Promise<void> {
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
    // Validate that modalities exist with canonical values.
    // Modalities are seeded separately with full metadata before this runs.
    for (const code of modalityCodes) {
      await requireAcademicModalityIdByCode({
        supabase: params.supabase,
        code,
        context: "syncTerms -> validate modalities",
      });
    }
  }

  const modalities = await params.supabase.select<{ id: number; code: string }>(
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

async function syncAcademicUnits(params: {
  supabase: SupabaseRestClient;
  universityId: number;
  alteonp: string;
  dryRun: boolean;
}): Promise<void> {
  logSection("Sync: academic units");
  const units = await fetchAcademicUnitsFromGuiaHorarios(params.alteonp);

  const rows = units.map((u) => ({
    university_id: params.universityId,
    code: u.code,
    name: u.name,
    offers_careers: false,
  }));

  await params.supabase.upsertMany({
    table: "academic_unit",
    rows,
    onConflict: "code",
    dryRun: params.dryRun,
  });
}

async function syncModalities(params: {
  supabase: SupabaseRestClient;
  alteonp: string;
  dryRun: boolean;
}): Promise<void> {
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

// Sync phases below; `run()` orchestrates order to maintain referential integrity.

async function syncProgramsAndCampusAvailability(params: {
  supabase: SupabaseRestClient;
  universityId: number;
  dryRun: boolean;
  campusCodes?: string[];
  maxCampuses?: number;
}): Promise<void> {
  logSection("Sync: career programs + career_campus");
  const campuses = await params.supabase.select<{ id: number; code: string }>({
    table: "campus",
    columns: "id,code",
    limit: 50_000,
  });

  let campusCodes = campuses
    .map((c) => c.code)
    .sort((a, b) => a.localeCompare(b, "en"));

  // Programs are synced for all campuses to maintain a complete catalog.
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

  const allPrograms = new Map<string, { code: string; name: string }>();
  const campusProgramPairs: Array<{
    campus_code: string;
    program_code: string;
    program_name: string;
  }> = [];

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

  // Academic units are already seeded; we just map programs to campuses via academic_unit_campus.
  // No need to insert into career_program (it no longer exists).

  const maps = await buildIngestMaps({ supabase: params.supabase });

  const academicUnitCampusRows: Array<{
    academic_unit_id: number;
    campus_id: number;
  }> = [];

  // Deduplicate pairs to avoid Postgres error:
  // "ON CONFLICT DO UPDATE command cannot affect row a second time"
  // This happens when the same (academic_unit_id, campus_id) appears more than once
  // in a single insert/upsert statement.
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

  for (const batch of chunk(academicUnitCampusRows, 5000)) {
    await params.supabase.upsertMany({
      table: "academic_unit_campus",
      rows: batch,
      onConflict: "academic_unit_id,campus_id",
      dryRun: params.dryRun,
    });
  }
}

async function syncCurriculumPlans(params: {
  supabase: SupabaseRestClient;
  dryRun: boolean;
  campusCodes?: string[];
  maxCampuses?: number;
  maxPlansPerProgram?: number;
}): Promise<void> {
  logSection("Sync: curriculum (study plans, levels, courses, relations)");

  const campuses = await params.supabase.select<{ code: string }>({
    table: "campus",
    columns: "code",
    limit: 1000,
  });

  // Start from explicit campusCodes if provided; otherwise from ALL campuses in DB.
  // Then (only when campusCodes is not explicitly provided) restrict to PRIMARY_CAMPUSES for curriculum.
  let campusCodes = params.campusCodes ?? campuses.map((c) => c.code);

  const primaryCampusSet = new Set(PRIMARY_CAMPUSES);
  if (!params.campusCodes) {
    campusCodes = campusCodes.filter((code) => primaryCampusSet.has(code));
  }

  // Apply maxCampuses by slicing in-order (do not use Set+filter which can behave unexpectedly with duplicates/order).
  if (params.maxCampuses && params.maxCampuses > 0) {
    campusCodes = campusCodes.slice(0, params.maxCampuses);
  }

  if (campusCodes.length === 0) {
    logInfo("No campuses to process");
    return;
  }

  logInfo(
    `  • Syncing curriculum for primary campuses only: ${campusCodes.join(", ")}`,
  );

  // Program-to-campus mappings vary; plan details are fetched once per plan ID.
  const programsByCampus = new Map<
    string,
    Array<{ code: string; name: string }>
  >();
  const programToCampuses = new Map<string, Set<string>>();
  const programCodes = new Set<string>();

  logProgress(`Fetching programs from ${campusCodes.length} campuses...`);
  for (let i = 0; i < campusCodes.length; i++) {
    const campusCode = campusCodes[i]!;
    logProgress(
      `  [${i + 1}/${campusCodes.length}] Fetching programs for campus ${campusCode}...`,
    );

    const careers = await fetchProgramCareersFromCurriculumApi(
      campusCode,
    ).catch(() => []);

    programsByCampus.set(campusCode, careers);

    for (const p of careers) {
      programCodes.add(p.code);
      if (!programToCampuses.has(p.code))
        programToCampuses.set(p.code, new Set());
      programToCampuses.get(p.code)!.add(campusCode);
    }
  }
  logSuccess(`Found ${programCodes.size} unique programs across all campuses`);

  const maps = await buildIngestMaps({ supabase: params.supabase });

  // Track which plan DETAILS we've already fetched to avoid duplicate upstream calls.
  // Keyed by externalPlanId (numeric). Plans are identical across campuses; availability is handled via study_plan_campus.
  const fetchedPlanDetailsByExternalPlanId = new Map<
    number,
    CurriculumPlanDetails
  >();

  // Accumulate plan headers we want to ingest.
  const planHeaders: Array<{
    academic_unit_id: number;
    academic_modality_id: number;
    external_plan_id: number;
    name: string;
    academic_degree: string | null;
    first_level_number: number;
  }> = [];

  // Accumulate curriculum graph rows.
  const planCampusPairs: Array<{
    study_plan_key: string;
    campus_code: string;
  }> = [];
  const planLevels: Array<{
    study_plan_key: string;
    level_number: number;
    level_label: string;
  }> = [];
  const planLevelCourses: Array<{
    study_plan_key: string;
    level_number: number;
    course_code: string;
    credits: number;
    weekly_hours: number;
    sort_order: number;
  }> = [];
  const planRelations: Array<{
    study_plan_key: string;
    from_course_code: string;
    to_course_code: string;
    relation_type: "PREREQUISITE" | "COREQUISITE" | "EQUIVALENT";
  }> = [];

  // Accumulate course catalog
  const courseUpserts = new Map<
    string,
    {
      code: string;
      name: string;
      credits: number;
      hours: number;
    }
  >();

  logProgress(
    `Processing curriculum details for ${campusCodes.length} campuses (plan availability per campus; details cached per plan)...`,
  );

  let campusIdx = 0;
  for (const campusCode of campusCodes) {
    campusIdx++;
    const careers = programsByCampus.get(campusCode) ?? [];
    logProgress(
      `  [${campusIdx}/${campusCodes.length}] Campus ${campusCode}: processing ${careers.length} programs...`,
    );

    let programIdx = 0;
    for (const program of careers) {
      programIdx++;
      const programCode = program.code;
      const academic_unit_id = maps.academicUnitIdByCode.get(programCode);
      if (!academic_unit_id) continue;

      logProgress(
        `    [${programIdx}/${careers.length}] Program ${programCode}: fetching study plans (campus-scoped list)...`,
      );

      let plans = await fetchPlansByProgramFromCurriculumApi({
        campusCode,
        programCode,
      }).catch(() => []);

      if (params.maxPlansPerProgram && params.maxPlansPerProgram > 0) {
        plans = plans.slice(0, params.maxPlansPerProgram);
      }

      let planIdx = 0;
      for (const p of plans) {
        planIdx++;

        // Fetch details ONCE per plan id (plans are identical across campuses),
        // but still record plan->campus availability exactly from the campus-scoped list.
        let details = fetchedPlanDetailsByExternalPlanId.get(p.externalPlanId);

        if (!details) {
          logProgress(
            `      [${planIdx}/${plans.length}] Plan ${p.externalPlanId}: fetching details...`,
          );

          details =
            (await fetchPlanDetailsFromCurriculumApi(p.externalPlanId).catch(
              () => null,
            )) ?? undefined;

          if (!details) {
            // Keep the "plans that can't be obtained" behavior: skip entirely.
            logInfo(
              `      ⚠ Plan ${p.externalPlanId}: could not fetch details, skipping`,
            );
            continue;
          }

          fetchedPlanDetailsByExternalPlanId.set(p.externalPlanId, details);
        }

        const modalityCode = normalizeModalityToCode(
          String(details.modality ?? ""),
        );
        if (!modalityCode) continue;

        // Validate that modality exists with canonical metadata.
        const academic_modality_id = await requireAcademicModalityIdByCode({
          supabase: params.supabase,
          code: modalityCode,
          context: `syncCurriculumPlans -> plan ${p.externalPlanId}`,
        });

        const external_plan_id = safeNumber(
          details.id_curriculum ?? p.externalPlanId,
          0,
        );
        if (external_plan_id <= 0) continue;

        const spKey = keyStudyPlan(programCode, external_plan_id);

        planHeaders.push({
          academic_unit_id,
          academic_modality_id,
          external_plan_id,
          name:
            String(details.dsc_curriculum ?? p.name).trim() ||
            String(p.name).trim(),
          academic_degree: details.academic_degree
            ? String(details.academic_degree).trim()
            : null,
          first_level_number: safeNumber(details.first_level, 0),
        });

        // Exact per-campus availability: only link this plan to the campus where it appeared in the plans list.
        planCampusPairs.push({
          study_plan_key: spKey,
          campus_code: campusCode,
        });

        for (let li = 0; li < details.levels.length; li++) {
          const level = details.levels[li]!;
          const label = String(level.id ?? "").trim();
          const levelNumMatch = /(\d+)/.exec(label);
          const level_number = levelNumMatch
            ? safeNumber(levelNumMatch[1], li)
            : li;

          planLevels.push({
            study_plan_key: spKey,
            level_number,
            level_label: label || `Nivel ${level_number}`,
          });

          for (let ci = 0; ci < level.courses.length; ci++) {
            const c = level.courses[ci]!;
            const course_code = String(c.id_course ?? "")
              .trim()
              .toUpperCase();
            if (!course_code) continue;

            // Load course name from curriculum API, but only if it's not a placeholder.
            // If name equals code or is empty, leave it empty for enrichment from schedule guide later.
            let courseName = String(c.name ?? "").trim();
            if (courseName.toUpperCase() === course_code) {
              courseName = ""; // Placeholder, leave empty for enrichment
            } else if (courseName) {
              courseName = normalizeCourseName(courseName); // Normalize if non-empty
            }

            courseUpserts.set(course_code, {
              code: course_code,
              name: courseName,
              credits: safeNumber(c.credits, 0),
              hours: safeNumber(c.hours, 0),
            });

            planLevelCourses.push({
              study_plan_key: spKey,
              level_number,
              course_code,
              credits: safeNumber(c.credits, 0),
              weekly_hours: safeNumber(c.hours, 0),
              sort_order: ci * 10,
            });

            for (const r of c.requirements ?? []) {
              const req = String(r.id ?? "")
                .trim()
                .toUpperCase();
              // Validate that this is an actual course code, not a message (e.g., "NO HAY...")
              if (!req || !isValidCourseCode(req)) continue;

              planRelations.push({
                study_plan_key: spKey,
                from_course_code: course_code,
                to_course_code: req,
                relation_type: "PREREQUISITE",
              });

              // Only add if not already in courseUpserts; leave name empty for enrichment
              if (!courseUpserts.has(req)) {
                courseUpserts.set(req, {
                  code: req,
                  name: "",
                  credits: 0,
                  hours: 0,
                });
              }
            }

            for (const r of c.co_requirements ?? []) {
              const req = String(r.id ?? "")
                .trim()
                .toUpperCase();
              // Validate that this is an actual course code, not a message (e.g., "NO HAY...")
              if (!req || !isValidCourseCode(req)) continue;

              planRelations.push({
                study_plan_key: spKey,
                from_course_code: course_code,
                to_course_code: req,
                relation_type: "COREQUISITE",
              });

              // Only add if not already in courseUpserts; leave name empty for enrichment
              if (!courseUpserts.has(req)) {
                courseUpserts.set(req, {
                  code: req,
                  name: "",
                  credits: 0,
                  hours: 0,
                });
              }
            }

            for (const eq of c.equivalent ?? []) {
              const eq_code = String(eq.id ?? "")
                .trim()
                .toUpperCase();
              // Validate that this is an actual course code, not a message (e.g., "NO HAY...")
              if (!eq_code || !isValidCourseCode(eq_code)) continue;

              planRelations.push({
                study_plan_key: spKey,
                from_course_code: course_code,
                to_course_code: eq_code,
                relation_type: "EQUIVALENT",
              });

              // Only add if not already in courseUpserts; leave name empty for enrichment
              if (!courseUpserts.has(eq_code)) {
                courseUpserts.set(eq_code, {
                  code: eq_code,
                  name: "",
                  credits: 0,
                  hours: 0,
                });
              }
            }
          }
        }
      }
    }
  }

  // NOTE:
  // Courses no longer have owning_academic_unit_id.
  // Course associations are determined via study_plan_level_course and course_relation tables.

  logProgress(`Processing ${courseUpserts.size} courses...`);
  const courseRows = Array.from(courseUpserts.values()).map((c) => {
    return {
      code: c.code,
      name: c.name,
      default_credits: c.credits,
      default_weekly_hours: c.hours,
    };
  });

  const batches = chunk(courseRows, 5000);
  logInfo(
    `Upserting courses in ${batches.length} batches of up to 5000 rows each`,
  );
  let batchIdx = 0;
  for (const batch of batches) {
    batchIdx++;
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "course",
      rows: batch,
      onConflict: "code",
      dryRun: params.dryRun,
      showProgress: false,
    });
    logProgress(
      `  Course batch ${batchIdx}/${batches.length}: ${batch.length} rows upserted`,
    );
  }
  logSuccess(`All ${courseRows.length} courses processed`);

  // Upsert study_plan headers - deduplicate first to avoid constraint violations
  logProgress(`Processing ${planHeaders.length} study plan headers...`);

  // Deduplicate by academic_unit_id + external_plan_id
  const uniquePlanHeaders = Array.from(
    new Map(
      planHeaders.map((h) => [
        `${h.academic_unit_id}-${h.external_plan_id}`,
        h,
      ]),
    ).values(),
  );

  if (uniquePlanHeaders.length !== planHeaders.length) {
    logInfo(
      `Deduplicated ${planHeaders.length} plans to ${uniquePlanHeaders.length} unique plans`,
    );
  }

  const planBatches = chunk(uniquePlanHeaders, 1000);
  logInfo(
    `Upserting study plans in ${planBatches.length} batches of up to 1000 rows each`,
  );
  let planBatchIdx = 0;
  for (const batch of planBatches) {
    planBatchIdx++;
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "study_plan",
      rows: batch,
      onConflict: "academic_unit_id,external_plan_id",
      dryRun: params.dryRun,
      showProgress: false,
    });
    logProgress(
      `  Study plan batch ${planBatchIdx}/${planBatches.length}: ${batch.length} rows upserted`,
    );
  }
  logSuccess(`All ${uniquePlanHeaders.length} study plans processed`);

  const maps3 = await buildIngestMaps({ supabase: params.supabase });

  // Upsert study_plan_campus
  logProgress(
    `Processing ${planCampusPairs.length} study plan-campus associations...`,
  );
  const spCampusRows: Array<{
    study_plan_id: number;
    campus_id: number;
    valid_from: Date | null;
    valid_to: Date | null;
  }> = [];
  for (const spc of planCampusPairs) {
    const [unitCode, externalPlanIdStr] = spc.study_plan_key.split("::");
    const study_plan_id = maps3.studyPlanIdByUnitCodeAndExternalPlanId.get(
      keyStudyPlan(unitCode!, safeNumber(externalPlanIdStr, 0)),
    );
    const campus_id = maps.campusIdByCode.get(spc.campus_code);
    if (!study_plan_id || !campus_id) continue;
    spCampusRows.push({
      study_plan_id,
      campus_id,
      valid_from: null,
      valid_to: null,
    });
  }
  const spCampusBatches = chunk(spCampusRows, 2000);
  for (const batch of spCampusBatches) {
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "study_plan_campus",
      rows: batch,
      onConflict: "study_plan_id,campus_id",
      dryRun: params.dryRun,
      showProgress: false,
    });
  }
  logSuccess(`${spCampusRows.length} study plan-campus associations processed`);

  // Upsert study_plan_level rows
  logProgress(`Processing ${planLevels.length} study plan levels...`);

  // Deduplicate levels by (study_plan_key, level_number)
  const levelMap = new Map<
    string,
    {
      study_plan_key: string;
      level_number: number;
      level_label: string;
    }
  >();
  for (const l of planLevels) {
    const key = `${l.study_plan_key}::${l.level_number}`;
    if (!levelMap.has(key)) {
      levelMap.set(key, l);
    }
  }

  const levelRows: Array<{
    study_plan_id: number;
    level_number: number;
    level_label: string;
  }> = [];
  for (const l of levelMap.values()) {
    const [unitCode, externalPlanIdStr] = l.study_plan_key.split("::");
    const study_plan_id = maps3.studyPlanIdByUnitCodeAndExternalPlanId.get(
      keyStudyPlan(unitCode!, safeNumber(externalPlanIdStr, 0)),
    );
    if (!study_plan_id) continue;
    levelRows.push({
      study_plan_id,
      level_number: l.level_number,
      level_label: l.level_label,
    });
  }
  const levelBatches = chunk(levelRows, 2000);
  for (const batch of levelBatches) {
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "study_plan_level",
      rows: batch,
      onConflict: "study_plan_id,level_number",
      dryRun: params.dryRun,
      showProgress: false,
    });
  }
  logSuccess(`${levelRows.length} study plan levels processed`);

  logProgress("Building level ID mappings...");
  const levels = await params.supabase.select<{
    id: number;
    study_plan_id: number;
    level_number: number;
  }>({
    table: "study_plan_level",
    columns: "id,study_plan_id,level_number",
    limit: 200_000,
  });
  const levelIdByPlanIdAndNumber = new Map<string, number>();
  for (const l of levels) {
    levelIdByPlanIdAndNumber.set(`${l.study_plan_id}::${l.level_number}`, l.id);
  }

  // Upsert study_plan_level_course
  logProgress(
    `Processing ${planLevelCourses.length} level-course associations...`,
  );

  // Deduplicate by (study_plan_key, level_number, course_code)
  const plcMap = new Map<
    string,
    {
      study_plan_key: string;
      level_number: number;
      course_code: string;
      credits: number;
      weekly_hours: number;
      sort_order: number;
    }
  >();
  for (const plc of planLevelCourses) {
    const key = `${plc.study_plan_key}::${plc.level_number}::${plc.course_code}`;
    if (!plcMap.has(key)) {
      plcMap.set(key, plc);
    }
  }

  const plcRows: Array<{
    study_plan_level_id: number;
    course_id: number;
    credits: number;
    weekly_hours: number;
    sort_order: number;
  }> = [];
  for (const plc of plcMap.values()) {
    const [unitCode, externalPlanIdStr] = plc.study_plan_key.split("::");
    const study_plan_id = maps3.studyPlanIdByUnitCodeAndExternalPlanId.get(
      keyStudyPlan(unitCode!, safeNumber(externalPlanIdStr, 0)),
    );
    if (!study_plan_id) continue;
    const level_id = levelIdByPlanIdAndNumber.get(
      `${study_plan_id}::${plc.level_number}`,
    );
    const course_id = maps3.courseIdByCode.get(plc.course_code);
    if (!level_id || !course_id) continue;
    plcRows.push({
      study_plan_level_id: level_id,
      course_id,
      credits: plc.credits,
      weekly_hours: plc.weekly_hours,
      sort_order: plc.sort_order,
    });
  }
  const plcBatches = chunk(plcRows, 2000);
  for (const batch of plcBatches) {
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "study_plan_level_course",
      rows: batch,
      onConflict: "study_plan_level_id,course_id",
      dryRun: params.dryRun,
      showProgress: false,
    });
  }
  logSuccess(`${plcRows.length} level-course associations processed`);

  // Relations
  // Upsert course_relation rows
  logProgress(`Processing ${planRelations.length} course relations...`);

  // Deduplicate by (study_plan_key, from_course_code, to_course_code, relation_type)
  const relMap = new Map<string, (typeof planRelations)[0]>();
  for (const r of planRelations) {
    const key = `${r.study_plan_key}::${r.from_course_code}::${r.to_course_code}::${r.relation_type}`;
    if (!relMap.has(key)) {
      relMap.set(key, r);
    }
  }

  const relRows: Array<{
    study_plan_id: number;
    from_course_id: number;
    to_course_id: number;
    relation_type: string;
  }> = [];
  for (const r of relMap.values()) {
    const [unitCode, externalPlanIdStr] = r.study_plan_key.split("::");
    const study_plan_id = maps3.studyPlanIdByUnitCodeAndExternalPlanId.get(
      keyStudyPlan(unitCode!, safeNumber(externalPlanIdStr, 0)),
    );
    if (!study_plan_id) continue;

    const from_course_id = maps3.courseIdByCode.get(r.from_course_code);
    const to_course_id = maps3.courseIdByCode.get(r.to_course_code);
    if (!from_course_id || !to_course_id) continue;

    relRows.push({
      study_plan_id,
      from_course_id,
      to_course_id,
      relation_type: r.relation_type,
    });
  }
  const relBatches = chunk(relRows, 2000);
  for (const batch of relBatches) {
    await params.supabase.upsertMany<(typeof batch)[0]>({
      table: "course_relation",
      rows: batch,
      onConflict: "study_plan_id,from_course_id,to_course_id,relation_type",
      dryRun: params.dryRun,
      showProgress: false,
    });
  }
  logSuccess(`${relRows.length} course relations processed`);
}

async function fetchScheduleGuideHtml(params: {
  campusCode: string;
  programCode: string;
  termKey: string;
}): Promise<string> {
  const url = `${URLS.studentRecords.scheduleGuide}?sede=${encodeURIComponent(params.campusCode)}&carrera=${encodeURIComponent(params.programCode)}&periodo=${encodeURIComponent(params.termKey)}`;
  const { text } = await httpText("POST", url, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    timeoutMs: 60_000,
  });
  return text;
}

async function syncScheduleGuide(params: {
  supabase: SupabaseRestClient;
  dryRun: boolean;
  campusCodes?: string[];
  maxCampuses?: number;
  termKeys?: string[];
  maxTerms?: number;
  alteonp?: string | false;
}): Promise<void> {
  logSection("Sync: schedule (student records + guiahorarios)");
  logProgress("Building ingestion maps...");
  const maps = await buildIngestMaps({ supabase: params.supabase });
  logSuccess("Ingestion maps ready");

  // Determine campuses and programs from the student records HTML endpoints.
  logProgress("Fetching campuses from student records...");
  let campuses = await fetchCampusesFromStudentRecordsHtml();

  // Filter to primary campuses only for schedule sync
  const primaryCampusSet = new Set(PRIMARY_CAMPUSES);
  campuses = campuses.filter((c) => primaryCampusSet.has(c.code.toUpperCase()));

  if (params.campusCodes && params.campusCodes.length > 0) {
    const allow = new Set(params.campusCodes.map((x) => x.toUpperCase()));
    campuses = campuses.filter((c) => allow.has(c.code.toUpperCase()));
  }
  if (params.maxCampuses && params.maxCampuses > 0) {
    campuses = campuses.slice(0, params.maxCampuses);
  }

  logInfo(
    `Syncing schedules for primary campuses only: ${campuses.map((c) => c.code).join(", ")}`,
  );

  let terms = await params.supabase.select<{ external_key: string }>({
    table: "academic_term",
    columns: "external_key",
    limit: 50_000,
  });
  let termKeys = terms
    .map((t) => t.external_key)
    .sort((a, b) => a.localeCompare(b, "en"));
  if (params.termKeys && params.termKeys.length > 0) {
    const allow = new Set(params.termKeys);
    termKeys = termKeys.filter((t) => allow.has(t));
  }
  if (params.maxTerms && params.maxTerms > 0) {
    termKeys = termKeys.slice(0, params.maxTerms);
  }

  // Program labels are fetched per campus from the Student Records HTML endpoints and cached
  // to avoid repeating identical requests during the triple loop (campus × program × term).
  logProgress(`Fetching programs for ${campuses.length} campuses...`);
  const programsByCampus = new Map<
    string,
    Array<{ code: string; name: string }>
  >();
  for (let i = 0; i < campuses.length; i++) {
    const campus = campuses[i]!;
    logProgress(`  [${i + 1}/${campuses.length}] Campus ${campus.code}...`);
    const list = await fetchProgramsByCampusFromStudentRecordsHtml(
      campus.code,
    ).catch(() => []);
    programsByCampus.set(campus.code, list);
  }
  logSuccess(`Programs cached for all campuses`);

  // Guía Horarios returns campus names (not campus codes). These lookup maps normalize names
  // and map them back to codes sourced from the other catalog endpoints.
  logProgress("Building campus name lookup maps...");
  const campusCodeByNormalizedName = new Map<string, string>();
  for (const c of await fetchCampusesFromCurriculumApi().catch(() => [])) {
    campusCodeByNormalizedName.set(normalizeCampusNameForMatch(c.name), c.code);
  }
  for (const c of await fetchCampusesFromStudentRecordsHtml().catch(() => [])) {
    campusCodeByNormalizedName.set(normalizeCampusNameForMatch(c.name), c.code);
  }

  const unitByNormalizedName = new Map<
    string,
    { code: string; name: string }
  >();
  // Academic unit lookups are performed via normalized names because Guía Horarios returns
  // reservation department names rather than department codes.
  const allUnits = await params.supabase.select<{ code: string; name: string }>(
    {
      table: "academic_unit",
      columns: "code,name",
      limit: 50_000,
    },
  );
  for (const u of allUnits) {
    unitByNormalizedName.set(normalizeAcademicUnitNameForMatch(u.name), {
      code: u.code,
      name: u.name,
    });
  }

  // Guía Horarios offers are queried by (academic_unit_code, year). The endpoint returns rows
  // that include (NUM_ANO, IDE_MODALIDAD, IDE_PER_MOD), which can be normalized to a term key
  // compatible with `academic_term.external_key` (e.g. "2026_S_1"). Only terms present in the
  // selected `termKeys` are indexed for enrichment to avoid mismatched joins.
  const allowedTermKeys = new Set(termKeys);

  const yearsToFetch = Array.from(
    new Set(
      termKeys
        .map((k) => parseAcademicTermKey(k))
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .map((x) => x.year),
    ),
  ).sort((a, b) => a - b);

  // Enrichment results are indexed by a composite key so they can be joined into the HTML rows.
  // Key format: `${campusCode}::${courseCode}::${groupCode}::${termExternalKey}`.
  const enrichByOfferingGroupKey = new Map<
    string,
    {
      meetings: Array<{ weekday: number; starts_at: string; ends_at: string }>;
      reservations: Array<{
        campus_code: string | null;
        academic_unit_code: string | null;
        external_plan_id: number | null;
        reserved_seats: number | null;
      }>;
    }
  >();

  if (params.alteonp) {
    // Enrichment requires a valid `AlteonP` cookie. Offer rows are fetched by school code and year.
    const academicUnitsToFetch = allUnits.map((u) => u.code);
    logProgress(
      `Enriching from Guía Horarios: ${yearsToFetch.length} years × ${academicUnitsToFetch.length} units...`,
    );

    let yearIdx = 0;
    for (const year of yearsToFetch) {
      yearIdx++;
      logProgress(`  [${yearIdx}/${yearsToFetch.length}] Year ${year}...`);
      let unitIdx = 0;
      for (const academicUnitCode of academicUnitsToFetch) {
        unitIdx++;
        if (unitIdx % 10 === 0) {
          logProgress(
            `    Processing unit ${unitIdx}/${academicUnitsToFetch.length}...`,
          );
        }
        const rows = await fetchOfferingsByAcademicUnitAndYearFromGuiaHorarios({
          alteonp: String(params.alteonp),
          academicUnitCode,
          year,
        }).catch(() => []);

        for (const r of rows) {
          const numAno = Number(r.NUM_ANO);
          const modalityCode = String(r.IDE_MODALIDAD ?? "")
            .trim()
            .toUpperCase();
          const periodNumber = Number(r.IDE_PER_MOD);

          const externalKey = `${numAno}_${modalityCode}_${periodNumber}`;
          if (!allowedTermKeys.has(externalKey)) continue;

          const campusCode =
            campusCodeByNormalizedName.get(
              normalizeCampusNameForMatch(r.DSC_SEDE),
            ) ?? null;

          const courseCode = String(r.IDE_MATERIA ?? "")
            .trim()
            .toUpperCase();
          const groupCode = String(r.IDE_GRUPO ?? "").padStart(2, "0");

          if (!campusCode || !courseCode || !groupCode) continue;

          const k = `${campusCode}::${courseCode}::${groupCode}::${externalKey}`;
          const existing = enrichByOfferingGroupKey.get(k) ?? {
            meetings: [],
            reservations: [],
          };

          const weekday = weekdayFromSpanish(String(r.NOM_DIA ?? ""));
          const starts_at = String(r.HINICIO ?? "").trim();
          const ends_at = String(r.HFIN ?? "").trim();
          if (weekday && starts_at && ends_at) {
            existing.meetings.push({ weekday, starts_at, ends_at });
          }

          const reservaCampusCode = r.RESERVA_SEDE
            ? (campusCodeByNormalizedName.get(
                normalizeCampusNameForMatch(r.RESERVA_SEDE),
              ) ?? null)
            : null;

          const reservaUnitCode = r.RESERVA_DEPTO
            ? (unitByNormalizedName.get(
                normalizeAcademicUnitNameForMatch(r.RESERVA_DEPTO),
              )?.code ?? null)
            : null;

          const reservaPlanExternalId = r.RESERVA_PLAN
            ? reservationPlanKeyToExternalPlanId(r.RESERVA_PLAN)
            : null;

          // Guía Horarios does not provide reserved seat counts. The reserved seat count is taken from the
          // Student Records HTML table and applied to each reservation-target row when inserting.
          if (reservaCampusCode || reservaUnitCode || reservaPlanExternalId) {
            existing.reservations.push({
              campus_code: reservaCampusCode,
              academic_unit_code: reservaUnitCode,
              external_plan_id: reservaPlanExternalId,
              reserved_seats: null,
            });
          }

          enrichByOfferingGroupKey.set(k, existing);
        }
      }
    }
    logSuccess(
      `Enrichment complete: ${enrichByOfferingGroupKey.size} offering groups enriched`,
    );
  }

  logProgress(
    `Processing schedules: ${campuses.length} campuses × ${termKeys.length} terms...`,
  );
  let campusIdx = 0;
  for (const campus of campuses) {
    campusIdx++;
    const campus_id = maps.campusIdByCode.get(campus.code);
    if (!campus_id) continue;

    const programs = programsByCampus.get(campus.code) ?? [];
    logProgress(
      `  [${campusIdx}/${campuses.length}] Campus ${campus.code}: ${programs.length} programs...`,
    );

    let programIdx = 0;
    for (const program of programs) {
      programIdx++;
      // `program.code` from Student Records represents the school/department that publishes the offering list.
      // It is stored as `course_offering.academic_unit_id` for origin tracking and for filtering offerings by unit.
      const academic_unit_id =
        maps.academicUnitIdByCode.get(program.code) ?? null;
      if (!academic_unit_id) continue;

      let termIdx = 0;
      for (const termKey of termKeys) {
        termIdx++;
        if (termIdx % 5 === 1 || termKeys.length <= 5) {
          logProgress(
            `    [Program ${programIdx}/${programs.length}] [Term ${termIdx}/${termKeys.length}] ${program.code} @ ${termKey}...`,
          );
        }

        const academic_term_id = maps.academicTermIdByExternalKey.get(termKey);
        if (!academic_term_id) continue;

        const html = await fetchScheduleGuideHtml({
          campusCode: campus.code,
          programCode: program.code,
          termKey,
        }).catch(() => "");

        if (!html) continue;

        const parsedRows = parseScheduleGuideTable(html);
        if (parsedRows.length === 0) continue;

        logInfo(`      Found ${parsedRows.length} course groups`);

        // Build course and professor catalogs from parsed data.
        const courseCodes = Array.from(
          new Set(parsedRows.map((r) => r.courseCode.toUpperCase())),
        );
        const professorNames = Array.from(
          new Set(
            parsedRows
              .map((r) => r.professorName)
              .filter((x): x is string => Boolean(x)),
          ),
        );

        const freshMaps = await buildIngestMaps({ supabase: params.supabase });

        // Enrich course names from schedule guide HTML.
        // Prioritize longer names (more descriptive) and normalize them.
        // Only update if the current name is empty or a placeholder (equals the code).
        const courseNameByCode = new Map<string, string>();
        for (const r of parsedRows) {
          const code = String(r.courseCode ?? "").trim().toUpperCase();
          const rawName = String(r.courseName ?? "").trim();
          if (!code || !rawName) continue;
          if (rawName.toUpperCase() === code) continue; // Skip placeholders
          
          const normalizedName = normalizeCourseName(rawName);
          const prev = courseNameByCode.get(code);
          // Keep the longer (more descriptive) name
          if (!prev || normalizedName.length > prev.length) {
            courseNameByCode.set(code, normalizedName);
          }
        }

        // Only upsert names if they're not empty
        const courseNameRows = Array.from(courseNameByCode.entries())
          .filter(([, name]) => name.trim().length > 0)
          .map(([code, name]) => ({ code, name }));

        for (const batch of chunk(courseNameRows, 2000)) {
          await params.supabase.upsertMany<(typeof batch)[0]>({
            table: "course",
            rows: batch,
            onConflict: "code",
            dryRun: params.dryRun,
            showProgress: false,
          });
        }

        // Insert missing courses (no owning_academic_unit_id anymore)
        const missingCourseRows = courseCodes
          .filter((c) => !freshMaps.courseIdByCode.has(c))
          .map((c) => ({
            code: c,
            name: courseNameByCode.get(c) ?? "",
            default_credits: 0,
            default_weekly_hours: 0,
          }));

        for (const batch of chunk(missingCourseRows, 2000)) {
          await params.supabase.upsertMany<(typeof batch)[0]>({
            table: "course",
            rows: batch,
            onConflict: "code",
            dryRun: params.dryRun,
            showProgress: false,
          });
        }

        // Upsert professors
        const profRows = professorNames.map((name) => ({ full_name: name }));
        for (const batch of chunk(profRows, 2000)) {
          await params.supabase.upsertMany<(typeof batch)[0]>({
            table: "professor",
            rows: batch,
            onConflict: "full_name",
            dryRun: params.dryRun,
            showProgress: false,
          });
        }

        const maps2 = await buildIngestMaps({ supabase: params.supabase });
        const professors = await params.supabase.select<{
          id: number;
          full_name: string;
        }>({
          table: "professor",
          columns: "id,full_name",
          limit: 200_000,
        });
        const professorIdByName = new Map<string, number>();
        for (const p of professors) professorIdByName.set(p.full_name, p.id);

        // Offerings are defined at the header level as a unique tuple:
        // (course_id, campus_id, academic_unit_id, academic_term_id).
        // NOTE: When enrichByOfferingGroupKey is available, use the campus from DSC_SEDE (Guía Horarios)
        // instead of the loop campus, as Guía Horarios provides the actual campus where the group is offered.
        const offeringByKey = new Map<
          string,
          {
            course_id: number;
            campus_id: number;
            course_name_snapshot: string;
            credits_snapshot: number;
            weekly_hours_snapshot: number;
            course_type: string | null;
          }
        >();

        for (const r of parsedRows) {
          const course_id = maps2.courseIdByCode.get(
            r.courseCode.toUpperCase(),
          );
          if (!course_id) continue;

          // Determine the correct campus_id:
          // The Student Records HTML is filtered by campus, but the group might actually be offered at a different
          // campus (identified by DSC_SEDE in Guía Horarios). We need to check both possibilities:
          // 1. Try to find the group in enrichment under the loop campus (most common case)
          // 2. If not found, try all campuses (Guía Horarios has all groups regardless of requesting campus)
          let offering_campus_id = campus_id;
          let enrichmentKey = `${campus.code}::${r.courseCode.toUpperCase()}::${r.groupCode}::${termKey}`;
          let enrichment = enrichByOfferingGroupKey.get(enrichmentKey);
          
          // If not found with loop campus, search all campuses
          if (!enrichment) {
            for (const c of campuses) {
              enrichmentKey = `${c.code}::${r.courseCode.toUpperCase()}::${r.groupCode}::${termKey}`;
              enrichment = enrichByOfferingGroupKey.get(enrichmentKey);
              if (enrichment) {
                // Found! Extract the campus from DSC_SEDE mapping
                const guiaCampusCode = c.code;
                const guiaCampusId = maps2.campusIdByCode.get(guiaCampusCode);
                if (guiaCampusId) {
                  offering_campus_id = guiaCampusId;
                }
                break;
              }
            }
          } else if (enrichment.meetings && enrichment.meetings.length > 0) {
            // Already found with loop campus, but check if DSC_SEDE indicates a different campus
            const keyParts = enrichmentKey.split("::");
            const guiaCampusCode = keyParts[0];
            const guiaCampusId = maps2.campusIdByCode.get(guiaCampusCode);
            if (guiaCampusId) {
              offering_campus_id = guiaCampusId;
            }
          }

          const offeringKey = `${course_id}::${offering_campus_id}::${academic_unit_id}::${academic_term_id}`;
          if (!offeringByKey.has(offeringKey)) {
            offeringByKey.set(offeringKey, {
              course_id,
              campus_id: offering_campus_id,
              course_name_snapshot: r.courseName || r.courseCode,
              credits_snapshot: r.credits,
              weekly_hours_snapshot: 0,
              course_type: r.courseType,
            });
          }
        }

        const offeringRows = Array.from(offeringByKey.values()).map((o) => ({
          course_id: o.course_id,
          campus_id: o.campus_id,
          academic_unit_id,
          academic_term_id,
          course_name_snapshot: o.course_name_snapshot,
          credits_snapshot: o.credits_snapshot,
          weekly_hours_snapshot: o.weekly_hours_snapshot,
          course_type: o.course_type,
        }));

        for (const batch of chunk(offeringRows, 2000)) {
          await params.supabase.upsertMany<(typeof batch)[0]>({
            table: "course_offering",
            rows: batch,
            onConflict: "course_id,campus_id,academic_unit_id,academic_term_id",
            dryRun: params.dryRun,
            showProgress: false,
          });
        }

        // Refresh offerings for this academic unit/term to map groups
        // Note: offerings may have different campus_ids due to Guía Horarios enrichment
        const offerings: Array<{
          id: number;
          course_id: number;
          campus_id: number;
          academic_unit_id: number;
          academic_term_id: number;
        }> = await params.supabase.select<{
          id: number;
          course_id: number;
          campus_id: number;
          academic_unit_id: number;
          academic_term_id: number;
        }>({
          table: "course_offering",
          columns: "id,course_id,campus_id,academic_unit_id,academic_term_id",
          filter: `academic_term_id=eq.${academic_term_id}&academic_unit_id=eq.${academic_unit_id}`,
          limit: 200_000,
        });

        // Map offerings by (course_id, campus_id) since campus may vary
        const offeringIdByKey = new Map<string, number>();
        for (const o of offerings) {
          const key = `${o.course_id}::${o.campus_id}`;
          offeringIdByKey.set(key, o.id);
        }

        // Groups represent sections within an offering. A group is identified by (course_offering_id, group_code).
        const groupRows: Array<{
          course_offering_id: number;
          group_code: string;
          group_type: string;
          classroom: string | null;
          capacity: number;
          reserved_seats: number;
          enrolled_count: number;
        }> = [];

        // Group-professor links, meeting rows, and reservation rows are written after groups exist so the
        // `course_offering_group_id` foreign key can be resolved.
        const groupProfessorRows: Array<{
          course_offering_group_id: number;
          professor_id: number;
        }> = [];
        const meetingRows: Array<{
          course_offering_group_id: number;
          weekday: number;
          starts_at: string;
          ends_at: string;
        }> = [];
        const reservationRows: Array<{
          course_offering_group_id: number;
          campus_id: number | null;
          academic_unit_id: number | null;
          study_plan_id: number | null;
          reserved_seats: number | null;
        }> = [];

        // Groups are inserted/upserted first. A subsequent lookup fetches their ids to attach professors,
        // meetings, and reservation rows deterministically.
        for (const r of parsedRows) {
          const course_id = maps2.courseIdByCode.get(
            r.courseCode.toUpperCase(),
          );
          if (!course_id) continue;

          // Determine correct campus_id (same logic as offerings)
          let offering_campus_id = campus_id;
          let enrichmentKey = `${campus.code}::${r.courseCode.toUpperCase()}::${r.groupCode}::${termKey}`;
          let enrichment = enrichByOfferingGroupKey.get(enrichmentKey);
          
          // If not found with loop campus, search all campuses
          if (!enrichment) {
            for (const c of campuses) {
              enrichmentKey = `${c.code}::${r.courseCode.toUpperCase()}::${r.groupCode}::${termKey}`;
              enrichment = enrichByOfferingGroupKey.get(enrichmentKey);
              if (enrichment) {
                const guiaCampusCode = c.code;
                const guiaCampusId = maps2.campusIdByCode.get(guiaCampusCode);
                if (guiaCampusId) {
                  offering_campus_id = guiaCampusId;
                }
                break;
              }
            }
          } else if (enrichment.meetings && enrichment.meetings.length > 0) {
            const keyParts = enrichmentKey.split("::");
            const guiaCampusCode = keyParts[0];
            const guiaCampusId = maps2.campusIdByCode.get(guiaCampusCode);
            if (guiaCampusId) {
              offering_campus_id = guiaCampusId;
            }
          }

          const offeringKey = `${course_id}::${offering_campus_id}`;
          const course_offering_id = offeringIdByKey.get(offeringKey);
          if (!course_offering_id) continue;

          const group_type = r.groupType ?? "Regular";
          groupRows.push({
            course_offering_id,
            group_code: r.groupCode,
            group_type,
            classroom: r.classroom,
            capacity: r.capacity,
            reserved_seats: r.reserved,
            enrolled_count: 0,
          });
        }

        for (const batch of chunk(groupRows, 2000)) {
          await params.supabase.upsertMany<(typeof batch)[0]>({
            table: "course_offering_group",
            rows: batch,
            onConflict: "course_offering_id,group_code",
            dryRun: params.dryRun,
            showProgress: false,
          });
        }

        const groups = await params.supabase.select<{
          id: number;
          course_offering_id: number;
          group_code: string;
        }>({
          table: "course_offering_group",
          columns: "id,course_offering_id,group_code",
          limit: 200_000,
        });
        const groupIdByOfferingIdAndGroupCode = new Map<string, number>();
        for (const g of groups) {
          groupIdByOfferingIdAndGroupCode.set(
            `${g.course_offering_id}::${g.group_code}`,
            g.id,
          );
        }

        // Reservation targeting may include a plan identifier derived from the reservation plan field.
        // This map allows converting external plan ids into internal `study_plan.id` values when available.
        const studyPlans = await params.supabase.select<{
          id: number;
          external_plan_id: number;
        }>({
          table: "study_plan",
          columns: "id,external_plan_id",
          limit: 200_000,
        });
        const studyPlanIdByExternalPlanId = new Map<number, number>();
        for (const sp of studyPlans) {
          studyPlanIdByExternalPlanId.set(sp.external_plan_id, sp.id);
        }

        for (const r of parsedRows) {
          const course_id = maps2.courseIdByCode.get(
            r.courseCode.toUpperCase(),
          );
          if (!course_id) continue;

          // Determine correct campus_id (same logic as offerings)
          let offering_campus_id = campus_id;
          let enrichmentKey = `${campus.code}::${r.courseCode.toUpperCase()}::${r.groupCode}::${termKey}`;
          let enrichment = enrichByOfferingGroupKey.get(enrichmentKey);
          
          // If not found with loop campus, search all campuses
          if (!enrichment) {
            for (const c of campuses) {
              enrichmentKey = `${c.code}::${r.courseCode.toUpperCase()}::${r.groupCode}::${termKey}`;
              enrichment = enrichByOfferingGroupKey.get(enrichmentKey);
              if (enrichment) {
                const guiaCampusCode = c.code;
                const guiaCampusId = maps2.campusIdByCode.get(guiaCampusCode);
                if (guiaCampusId) {
                  offering_campus_id = guiaCampusId;
                }
                break;
              }
            }
          } else if (enrichment.meetings && enrichment.meetings.length > 0) {
            const keyParts = enrichmentKey.split("::");
            const guiaCampusCode = keyParts[0];
            const guiaCampusId = maps2.campusIdByCode.get(guiaCampusCode);
            if (guiaCampusId) {
              offering_campus_id = guiaCampusId;
            }
          }

          const offeringKey = `${course_id}::${offering_campus_id}`;
          const course_offering_id = offeringIdByKey.get(offeringKey);
          if (!course_offering_id) continue;

          const groupId = groupIdByOfferingIdAndGroupCode.get(
            `${course_offering_id}::${r.groupCode}`,
          );
          if (!groupId) continue;

          if (r.professorName) {
            const professor_id = professorIdByName.get(r.professorName);
            if (professor_id) {
              groupProfessorRows.push({
                course_offering_group_id: groupId,
                professor_id,
              });
            }
          }

          // Meetings are attached using Guía Horarios when present (one row per weekday/time).
          // If enrichment is missing, the HTML schedule text is parsed to infer meeting rows.
          // Search for enrichment using same logic as offerings: try loop campus first, then all campuses
          let enrichKey = `${campus.code}::${r.courseCode.toUpperCase()}::${r.groupCode}::${termKey}`;
          let enrich = enrichByOfferingGroupKey.get(enrichKey);
          
          // If not found with loop campus, search all campuses
          if (!enrich) {
            for (const c of campuses) {
              enrichKey = `${c.code}::${r.courseCode.toUpperCase()}::${r.groupCode}::${termKey}`;
              enrich = enrichByOfferingGroupKey.get(enrichKey);
              if (enrich) {
                break;
              }
            }
          }

          const meetingsFromGuia = enrich?.meetings ?? [];
          if (meetingsFromGuia.length > 0) {
            for (const m of meetingsFromGuia) {
              meetingRows.push({
                course_offering_group_id: groupId,
                weekday: m.weekday,
                starts_at: m.starts_at,
                ends_at: m.ends_at,
              });
            }
          } else {
            for (const m of parseScheduleTextToMeetings(r.scheduleText)) {
              meetingRows.push({
                course_offering_group_id: groupId,
                weekday: m.weekday,
                starts_at: m.startsAt,
                ends_at: m.endsAt,
              });
            }
          }

          // Reservation rows store both the reserved seat count and the targeting constraints.
          // The reserved seat count originates from the Student Records HTML table, while the targeting
          // constraints (campus/unit/plan) originate from Guía Horarios when present.
          const reservationTargets = enrich?.reservations ?? [];
          if (reservationTargets.length > 0) {
            for (const t of reservationTargets) {
              const campus_id_target = t.campus_code
                ? (maps2.campusIdByCode.get(t.campus_code) ?? null)
                : null;
              const academic_unit_id_target = t.academic_unit_code
                ? (maps2.academicUnitIdByCode.get(t.academic_unit_code) ?? null)
                : null;
              const study_plan_id_target = t.external_plan_id
                ? (studyPlanIdByExternalPlanId.get(t.external_plan_id) ?? null)
                : null;

              reservationRows.push({
                course_offering_group_id: groupId,
                campus_id: campus_id_target,
                academic_unit_id: academic_unit_id_target,
                study_plan_id: study_plan_id_target,
                reserved_seats: r.reserved,
              });
            }
          } else {
            reservationRows.push({
              course_offering_group_id: groupId,
              campus_id: null,
              academic_unit_id: null,
              study_plan_id: null,
              reserved_seats: r.reserved,
            });
          }
        }

        for (const batch of chunk(groupProfessorRows, 2000)) {
          await params.supabase.upsertMany<(typeof batch)[0]>({
            table: "course_offering_group_professor",
            rows: batch,
            onConflict: "course_offering_group_id,professor_id",
            dryRun: params.dryRun,
            showProgress: false,
          });
        }

        for (const batch of chunk(meetingRows, 2000)) {
          await params.supabase.upsertMany<(typeof batch)[0]>({
            table: "course_offering_meeting",
            rows: batch,
            onConflict: "course_offering_group_id,weekday,starts_at,ends_at",
            dryRun: params.dryRun,
            showProgress: false,
          });
        }

        for (const batch of chunk(reservationRows, 2000)) {
          await params.supabase.upsertMany<(typeof batch)[0]>({
            table: "course_offering_reservation",
            rows: batch,
            onConflict:
              "course_offering_group_id,campus_id,academic_unit_id,study_plan_id",
            dryRun: params.dryRun,
            showProgress: false,
          });
        }
      }
    }
  }
  logSuccess(`All schedule data processed for ${campuses.length} campuses`);
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = normalizeSupabaseUrl(env("VITE_SUPABASE_URL"));
  const secretKey = env("SUPABASE_SECRET_KEY");

  setStep("init");

  if (!secretKey.startsWith("sb_secret_")) {
    console.warn(
      "SUPABASE_SECRET_KEY does not start with sb_secret_. A secret key is required for write access under RLS.",
    );
  }

  const countryIso2 = "CR";
  const uniShort = "ITCR";
  const uniName = "Instituto Tecnológico de Costa Rica";

  const only = args.only;
  const shouldRun = (name: string) => only.size === 0 || only.has(name);

  const supabase = new SupabaseRestClient({ supabaseUrl, secretKey });

  console.log("\n═══════════════════════════════════════");
  console.log("ITCR Data Seeder Configuration");
  console.log("═══════════════════════════════════════");
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Dry Run:      ${args.dryRun ? "YES" : "NO"}`);
  console.log(
    `Scope:        ${only.size ? Array.from(only).join(", ") : "all"}`,
  );

  // Base catalogs (replaces supabase/seeds/01_base.sql)
  await seedBaseCatalog({ supabase, dryRun: args.dryRun });
  console.log(`Primary Campuses: ${PRIMARY_CAMPUSES.join(", ")}`);
  console.log("═══════════════════════════════════════");
  console.log("NOTE: All campuses & programs will be synced,");
  console.log("      but curriculum & schedules only for primary campuses.");
  console.log("═══════════════════════════════════════\n");

  const ensured = await supabase.ensureItcrUniversity({
    countryIso2,
    universityName: uniName,
    universityShortName: uniShort,
    dryRun: args.dryRun,
  });

  if (!ensured) {
    throw new Error("Failed to ensure base university/country rows.");
  }

  const needsGuia = shouldRun("units") || shouldRun("modalities");
  const alteonp =
    needsGuia &&
    (process.env.GUIAHORARIOS_ALTEONP ??
      (await acquireGuiaHorariosAlteonpCookie()));

  // Core catalogs
  if (shouldRun("campuses")) {
    await syncCampuses({
      supabase,
      universityId: ensured.universityId,
      dryRun: args.dryRun,
      maxCampuses: args.maxCampuses,
      campusCodes: args.campusCodes,
    });
  }

  if (shouldRun("terms")) {
    await syncTerms({
      supabase,
      dryRun: args.dryRun,
      maxTerms: args.maxTerms,
      termKeys: args.termKeys,
    });
  }

  if (needsGuia && alteonp) {
    if (shouldRun("modalities")) {
      await syncModalities({ supabase, alteonp, dryRun: args.dryRun });
    }
    if (shouldRun("units")) {
      await syncAcademicUnits({
        supabase,
        universityId: ensured.universityId,
        alteonp,
        dryRun: args.dryRun,
      });
    }
  }

  // Curriculum graph
  if (shouldRun("programs")) {
    await syncProgramsAndCampusAvailability({
      supabase,
      universityId: ensured.universityId,
      dryRun: args.dryRun,
      campusCodes: args.campusCodes,
      maxCampuses: args.maxCampuses,
    });
  }

  if (shouldRun("curriculum")) {
    await syncCurriculumPlans({
      supabase,
      dryRun: args.dryRun,
      campusCodes: args.campusCodes,
      maxCampuses: args.maxCampuses,
      maxPlansPerProgram: args.maxPlansPerProgram,
    });
  }

  // Schedule guide
  if (shouldRun("schedule")) {
    await syncScheduleGuide({
      supabase,
      campusCodes: args.campusCodes,
      maxCampuses: args.maxCampuses,
      termKeys: args.termKeys,
      maxTerms: args.maxTerms,
      dryRun: args.dryRun,
      alteonp,
    });
  }

  console.log("\n═══════════════════════════════════════");
  console.log("✓ Seed completed successfully");
  console.log("═══════════════════════════════════════\n");
}

run().catch((err) => {
  printTopLevelFailureReport(err);
  console.error(err);
  process.exit(1);
});

// Export to make this a module and avoid type conflicts with other files
export {};
