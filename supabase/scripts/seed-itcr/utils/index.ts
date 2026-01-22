/**
 * Utility functions for the ITCR seed script.
 * 
 * This module contains helper functions used for data parsing, normalization,
 * validation, and other common operations throughout the seeding process.
 */

import type {
  SupabaseRestClient,
  ParsedAcademicTermKey,
} from "../types";

/**
 * Converts a value to a number with a fallback default.
 * Returns the fallback if the value is not a finite number.
 * 
 * @param v - The value to convert to a number
 * @param fallback - The fallback value if conversion fails (default: 0)
 * @returns The converted number or the fallback
 */
export function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Splits an array into chunks of the specified size.
 * 
 * @param arr - The array to chunk
 * @param size - The size of each chunk (must be > 0)
 * @returns Array of chunks
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Normalizes text for loose comparison by:
 * - Decomposing Unicode characters (NFD normalization)
 * - Removing diacritical marks
 * - Replacing underscores and hyphens with spaces
 * - Collapsing multiple spaces to single space
 * - Converting to lowercase and trimming
 * 
 * @param raw - The raw text to normalize
 * @returns Normalized lowercase text without diacritics
 */
export function normalizeLooseText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Creates a unique key for a study plan combining program code and external plan ID.
 * 
 * @param programCode - The academic unit/program code
 * @param externalPlanId - The external plan ID from the curriculum API
 * @returns A composite key in format "programCode::externalPlanId"
 */
export function keyStudyPlan(programCode: string, externalPlanId: number): string {
  return `${programCode}::${externalPlanId}`;
}

/**
 * Validates if a string is a valid course code.
 * Valid course codes follow the pattern: 2-3 letter prefix followed by 3-5 digits.
 * Examples: IC1802, MA0101, CA2125, FH0178, AEN100
 * 
 * Invalid examples: "NO HAY MATERIAS EQUIVALENTES EN EL PLAN", "", "ELECTIVA ABIERTA"
 * 
 * @param code - The course code to validate
 * @returns True if the code matches the valid course code pattern
 */
export function isValidCourseCode(code: string): boolean {
  const trimmed = String(code ?? "").trim().toUpperCase();
  return /^[A-Z]{2,3}\d{3,5}$/.test(trimmed);
}

/**
 * Retrieves the academic modality ID by its code with validation.
 * Throws an error if the modality is not found or is a placeholder.
 * 
 * @param params - Parameters including supabase client, modality code, and context
 * @param params.supabase - Supabase REST client
 * @param params.code - The modality code to look up
 * @param params.context - Context string for error messages
 * @returns The modality ID
 * @throws Error if modality is missing or is a placeholder
 */
export async function requireAcademicModalityIdByCode(params: {
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

  const modality = await params.supabase.selectOne({
    table: "academic_modality",
    columns: "id,name",
    filter: `code=eq.${encodeURIComponent(code)}`,
  }) as { id: number; name: string } | null;

  if (!modality) {
    throw new Error(
      [
        `Missing academic_modality for code="${code}" (${params.context}).`,
        "This seeder does not create placeholder modalities.",
        "Ensure modalities are seeded with full metadata (name, periods_per_year) before running dependent steps.",
      ].join("\n"),
    );
  }

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

/**
 * Parses an academic term key into its component parts.
 * Keys follow the format: YEAR_MODALITY_PERIOD (e.g., "2026_S_1")
 * 
 * @param key - The academic term key to parse
 * @returns Object with year, modalityCode, and periodNumber, or null if invalid
 */
export function parseAcademicTermKey(
  key: string,
): ParsedAcademicTermKey | null {
  const m = /^(\d{4})_([A-Z])_(\d+)$/.exec(key.trim());
  if (!m) return null;
  return { year: Number(m[1]), modalityCode: m[2], periodNumber: Number(m[3]) };
}

/**
 * Converts a modality name to its corresponding code.
 * 
 * @param modalityName - The modality name to convert
 * @returns The modality code (e.g., "S" for "Semestre") or null if not matched
 */
export function normalizeModalityToCode(modalityName: string): string | null {
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
 * Normalizes course names to a consistent format.
 * 
 * Features:
 * - Preserves acronyms/abbreviations already in ALL CAPS (e.g., ETFP, TIC, AI)
 * - Converts Roman numerals to uppercase (e.g., "Ii" -> "II")
 * - Capitalizes first letter of regular words, keeps others lowercase
 * - Keeps Spanish stopwords lowercase (except at start)
 * 
 * @param name - The raw course name
 * @returns Normalized course name
 * 
 * @example
 * normalizeCourseName("examen diagnóstico") // "Examen Diagnóstico"
 * normalizeCourseName("Bases de datos Ii") // "Bases de Datos II"
 * normalizeCourseName("PROGRAMACION ORIENTADA A OBJETOS") // "Programación Orientada a Objetos"
 */
export function normalizeCourseName(name: string): string {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "";

  const lowerWords = new Set([
    "a",
    "al",
    "ante",
    "bajo",
    "con",
    "contra",
    "de",
    "del",
    "desde",
    "durante",
    "e",
    "el",
    "en",
    "entre",
    "hacia",
    "hasta",
    "la",
    "las",
    "lo",
    "los",
    "o",
    "para",
    "por",
    "segun",
    "sin",
    "sobre",
    "tras",
    "u",
    "y",
  ]);

  const words = trimmed.split(/\s+/);
  const normalized = words.map((word, idx) => {
    const raw = String(word ?? "").trim();
    if (!raw) return "";

    if (/^[A-ZÁÉÍÓÚÑÜ]{2,8}$/.test(raw)) return raw;

    if (/^[IVX]+$/i.test(raw) && raw.length <= 6) return raw.toUpperCase();

    if (/^(\d+)(st|nd|rd|th)$/i.test(raw)) return raw.toLowerCase();

    const lower = raw.toLowerCase();
    if (idx > 0 && lowerWords.has(lower)) return lower;

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return normalized.filter(Boolean).join(" ");
}

/**
 * Converts a Spanish day name to its weekday number.
 * 
 * @param day - Spanish day name (e.g., "Lunes", "Martes")
 * @returns Weekday number (1=Monday, 6=Saturday, 0=Sunday) or null if not recognized
 */
export function weekdayFromSpanish(day: string): number | null {
  const d = day.trim().toLowerCase();
  if (d.startsWith("lunes")) return 1;
  if (d.startsWith("martes")) return 2;
  if (d.startsWith("miércoles") || d.startsWith("miercoles")) return 3;
  if (d.startsWith("jueves")) return 4;
  if (d.startsWith("viernes")) return 5;
  if (d.startsWith("sábado") || d.startsWith("sabado")) return 6;
  if (d.startsWith("domingo")) return 0;
  return null;
}

/**
 * Parses schedule text into meeting times.
 * Expected format: "DayName - HH:MM:HH:MM" (e.g., "Martes - 7:30:9:20")
 * 
 * @param scheduleText - The schedule text to parse
 * @returns Array of meeting objects with weekday, startsAt, and endsAt
 */
export function parseScheduleTextToMeetings(
  scheduleText: string,
): Array<{ weekday: number; startsAt: string; endsAt: string }> {
  const s = scheduleText.replace(/\s+/g, " ").trim();
  const m =
    /^([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s*-\s*(\d{1,2}:\d{1,2})\s*:\s*(\d{1,2}:\d{1,2})$/.exec(
      s,
    );
  if (!m) return [];
  const wd = weekdayFromSpanish(m[1] ?? "");
  if (!wd) return [];
  const [startHour, startMin] = m[2]!.split(":");
  const [endHour, endMin] = m[3]!.split(":");
  const startsAt = `${startHour!.padStart(2, "0")}:${startMin!.padStart(2, "0")}`;
  const endsAt = `${endHour!.padStart(2, "0")}:${endMin!.padStart(2, "0")}`;
  return [{ weekday: wd, startsAt, endsAt }];
}

/**
 * Parses HTML to extract span elements with value and text attributes.
 * 
 * @param html - The HTML string to parse
 * @returns Array of objects with value and text properties
 */
export function parseHtmlSpans(html: string): Array<{ value: string; text: string }> {
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

/**
 * Parses the schedule guide HTML table into structured data.
 * Extracts course, group, schedule, and capacity information.
 * 
 * @param html - The HTML table content to parse
 * @returns Array of parsed schedule guide rows
 */
export function parseScheduleGuideTable(html: string): Array<{
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
  meetings?: Array<{ weekday: number; startTime: string; endTime: string }>;
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
    meetings?: Array<{ weekday: number; startTime: string; endTime: string }>;
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

    const meetings: Array<{ weekday: number; startTime: string; endTime: string }> = [];
    if (scheduleText) {
      const scheduleMatch = /(\w+)\s*-\s*(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,2})/.exec(scheduleText);
      if (scheduleMatch) {
        const dayName = scheduleMatch[1]!.toLowerCase();
        const startHour = scheduleMatch[2]!.padStart(2, "0");
        const startMin = scheduleMatch[3]!.padStart(2, "0");
        const endHour = scheduleMatch[4]!.padStart(2, "0");
        const endMin = scheduleMatch[5]!.padStart(2, "0");

        const dayMap: Record<string, number> = {
          lunes: 1,
          martes: 2,
          miercoles: 3,
          miércoles: 3,
          jueves: 4,
          viernes: 5,
          sabado: 6,
          sábado: 6,
          domingo: 0,
        };

        const weekday = dayMap[dayName];
        if (weekday !== undefined) {
          meetings.push({
            weekday,
            startTime: `${startHour}:${startMin}`,
            endTime: `${endHour}:${endMin}`,
          });
        }
      }
    }

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
      meetings: meetings.length > 0 ? meetings : undefined,
    });
  }

  return rows;
}

/**
 * Normalizes a campus name for matching purposes.
 * Removes diacritical marks and converts to lowercase.
 * 
 * @param name - The campus name to normalize
 * @returns Normalized campus name suitable for comparison
 */
export function normalizeCampusNameForMatch(name: string): string {
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

/**
 * Normalizes an academic unit name for matching purposes.
 * Removes diacritical marks and converts to lowercase.
 * 
 * @param name - The academic unit name to normalize
 * @returns Normalized name suitable for comparison
 */
export function normalizeAcademicUnitNameForMatch(name: string): string {
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

/**
 * Normalizes a name for loose/fuzzy matching.
 * Strips common Spanish stopwords and normalizes whitespace.
 * 
 * @param name - The name to normalize
 * @returns Normalized name with stopwords removed
 */
export function normalizeNameForLooseMatch(name: string): string {
  const normalized = normalizeAcademicUnitNameForMatch(name);
  return normalized
    .replace(/\b(de|del|la|el|los|las|y|en|para|por)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts a reservation plan key to an external plan ID.
 * Upstream often uses formats like "412" or "412.Ingenieria..." or empty string.
 * 
 * @param planKey - The plan key from reservation data
 * @returns The numeric external plan ID or null if invalid
 */
export function reservationPlanKeyToExternalPlanId(planKey: string): number | null {
  const s = String(planKey ?? "").trim();
  if (!s) return null;
  const m = /^(\d+)/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
