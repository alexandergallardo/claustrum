/**
 * Normalization functions for ITCR seed data processing.
 * 
 * These functions normalize various data fields from ITCR APIs into consistent
 * formats suitable for database storage and matching operations.
 */

import type { ParsedAcademicTermKey } from "../types";

const unknownCourseTypeOnce = new Set<string>();
const unknownGroupTypeOnce = new Set<string>();

/**
 * Normalizes loose text by removing accents, normalizing whitespace, and converting to lowercase.
 * Used as a base for other normalization functions.
 * 
 * @param raw - The raw string to normalize
 * @returns Normalized lowercase string with standardized formatting
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
 * Normalizes a course type string to a valid database enum value.
 * 
 * Maps various raw course type descriptions to the supported enum values:
 * - "Electiva Unica" - for elective courses
 * - "Curso Comun" - for common courses
 * - "Trabajo Final De Graduacion" - for final graduation work
 * - "Curso Unico" - for unique/single courses (default fallback)
 * 
 * @param raw - The raw course type string from the source
 * @returns The normalized course type enum value, or null if input is empty
 */
export function normalizeCourseType(raw: string | null): string | null {
  if (!raw) return null;
  const t = normalizeLooseText(raw);
  if (!t) return null;

  if (t.includes("electiva")) return "Electiva Unica";
  if (t.includes("comun")) return "Curso Comun";
  if (t.includes("trabajo final")) return "Trabajo Final De Graduacion";
  if (t.includes("unico")) return "Curso Unico";
  if (t.includes("curso")) return "Curso Unico";

  if (!unknownCourseTypeOnce.has(t)) {
    unknownCourseTypeOnce.add(t);
    console.warn(
      `[seed] Unknown courseType '${raw}' -> storing as 'Curso Unico' to satisfy enum`,
    );
  }
  return "Curso Unico";
}

/**
 * Normalizes a group type string to a valid database enum value.
 * 
 * Maps various raw group type descriptions to the supported enum values:
 * - "Semipresencial" - for semi-presential groups
 * - "Virtual" - for virtual groups
 * - "Asistida" - for assisted groups
 * - "Tutoría" - for tutoring groups
 * - "Regular" - for regular groups (default fallback)
 * 
 * @param raw - The raw group type string from the source
 * @returns The normalized group type enum value, defaults to "Regular"
 */
export function normalizeGroupType(raw: string | null): string {
  if (!raw) return "Regular";
  const t = normalizeLooseText(raw);
  if (!t) return "Regular";
  if (t.includes("semi")) return "Semipresencial";
  if (t.includes("virtual")) return "Virtual";
  if (t.includes("asistida")) return "Asistida";
  if (t.includes("tutoria")) return "Tutoría";
  if (t.includes("regular")) return "Regular";

  if (!unknownGroupTypeOnce.has(t)) {
    unknownGroupTypeOnce.add(t);
    console.warn(
      `[seed] Unknown groupType '${raw}' -> defaulting to 'Regular' to satisfy enum`,
    );
  }
  return "Regular";
}

/**
 * Converts a modality name to its corresponding single-letter code.
 * 
 * Maps modality names to their database codes:
 * - "Semestre" -> "S"
 * - "Verano" -> "V"
 * - "Bimestre" -> "B"
 * - "Cuatrimestre" -> "C"
 * - "Trimestre" -> "T"
 * - "Anual" -> "A"
 * - "Mensual" -> "M"
 * - "Intensivo" -> "I"
 * - "Bianual" -> "N"
 * - "Centros Formacion Humanistica" -> "H"
 * 
 * @param modalityName - The modality name to convert
 * @returns The single-letter code, or null if no match found
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
 * This function:
 * - Capitalizes the first letter of each word (except Spanish stopwords)
 * - Preserves acronyms/abbreviations already in ALL CAPS (e.g., ETFP, TIC, AI)
 * - Converts Roman numerals to uppercase (e.g., "Ii" -> "II")
 * - Converts to title case for regular words
 * 
 * Examples:
 *   "examen diagnóstico" -> "Examen Diagnóstico"
 *   "Bases de datos Ii" -> "Bases de Datos II"
 *   "PROGRAMACION ORIENTADA A OBJETOS" -> "Programación Orientada a Objetos"
 * 
 * @param name - The course name to normalize
 * @returns The normalized course name in consistent title case format
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
 * Normalizes a campus name for matching purposes.
 * 
 * Performs the following transformations:
 * - Converts to lowercase
 * - Normalizes whitespace
 * - Removes accent marks from vowels
 * - Converts ñ to n
 * 
 * This creates a consistent representation for fuzzy matching operations.
 * 
 * @param name - The campus name to normalize
 * @returns Normalized name suitable for matching
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
 * 
 * Performs the following transformations:
 * - Converts to lowercase
 * - Normalizes whitespace
 * - Removes accent marks from vowels
 * - Converts ñ to n
 * 
 * This creates a consistent representation for fuzzy matching operations.
 * 
 * @param name - The academic unit name to normalize
 * @returns Normalized name suitable for matching
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
 * Normalizes a name for loose/fuzzy matching by removing common Spanish stopwords.
 * 
 * This function:
 * - First applies the standard academic unit name normalization
 * - Then removes common Spanish stopwords (de, del, la, el, los, las, y, en, para, por)
 * - Normalizes whitespace
 * 
 * Used for fuzzy matching of upstream names that sometimes omit stopwords like "de".
 * Keep this conservative: strip only the most common stopwords.
 * 
 * @param name - The name to normalize for loose matching
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
 * Extracts the external plan ID from a reservation plan key.
 * 
 * Upstream often uses plan keys in formats like:
 * - "412" - just the ID
 * - "412.Ingenieria..." - ID with description
 * - "" - empty string
 * 
 * @param planKey - The plan key string to parse
 * @returns The numeric plan ID, or null if invalid/empty
 */
export function reservationPlanKeyToExternalPlanId(planKey: string): number | null {
  const s = String(planKey ?? "").trim();
  if (!s) return null;
  const m = /^(\d+)/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parses an academic term key into its component parts.
 * 
 * Academic term keys follow the format: YEAR_MODALITY_PERIOD
 * Examples:
 * - "2026_S_1" -> { year: 2026, modalityCode: "S", periodNumber: 1 }
 * - "2025_V_2" -> { year: 2025, modalityCode: "V", periodNumber: 2 }
 * 
 * @param key - The academic term key string to parse
 * @returns Parsed components or null if key format is invalid
 */
export function parseAcademicTermKey(
  key: string,
): ParsedAcademicTermKey | null {
  const m = /^(\d{4})_([A-Z])_(\d+)$/.exec(key.trim());
  if (!m) return null;
  return { year: Number(m[1]), modalityCode: m[2], periodNumber: Number(m[3]) };
}
