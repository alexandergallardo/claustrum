/**
 * HTTP client utilities for ITCR seed script.
 * Provides generic JSON/text HTTP fetch with TLS bypass support for ITCR endpoints,
 * plus HTML parsing and schedule text processing functions.
 */

import type { HttpMethod, ScheduleGuideRow, MeetingTime } from "./types";
import { envBool } from "./config";

let __lastStep: string | null = null;

/**
 * Set the current step for progress tracking.
 * Used to track which operation is currently in progress.
 * @param step - The step description
 */
export function setStep(step: string): void {
  __lastStep = step;
}

/**
 * Get the last set step description.
 * @returns The last step description or "(unknown)" if not set
 */
export function getLastStep(): string {
  return __lastStep ?? "(unknown)";
}

/**
 * Safely convert a value to a number with a fallback.
 * @param v - The value to convert
 * @param fallback - Fallback value if conversion fails (default: 0)
 * @returns The converted number or fallback
 */
export function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Check if a URL is an ITCR domain that requires HTTPS.
 * Only ITCR domains (tec-appsext.itcr.ac.cr and subdomains) are allowed.
 * Used to determine if TLS bypass should be applied.
 * @param url - The URL to check
 * @returns True if the URL is an ITCR HTTPS URL
 */
export function isItcrHttpsUrl(url: string): boolean {
  if (!url.startsWith("https://")) return false;

  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  return host === "tec-appsext.itcr.ac.cr" || host.endsWith(".itcr.ac.cr");
}

/**
 * Get the weekday number from a Spanish day name.
 * @param day - The Spanish day name (e.g., "Lunes", "Martes")
 * @returns The weekday number (0=Sunday, 1=Monday, ..., 6=Saturday) or null if not recognized
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
 * Get the day name from a weekday number.
 * @param weekday - The weekday number (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns The uppercase Spanish day name or empty string if invalid
 */
export function getDayNameFromWeekday(weekday: number): string {
  const dayNames: Record<number, string> = {
    1: "LUNES",
    2: "MARTES",
    3: "MIERCOLES",
    4: "JUEVES",
    5: "VIERNES",
    6: "SABADO",
    7: "DOMINGO",
  };
  return dayNames[weekday] ?? "";
}

/**
 * Get the display name for a modality code.
 * @param code - The modality code (e.g., "S", "V", "B")
 * @returns The display name or the code itself if not found
 */
export function getModalityDisplay(code: string): string {
  const displays: Record<string, string> = {
    "A": "ANUAL",
    "S": "SEMESTRE",
    "V": "VERANO",
    "B": "BIMESTRE",
    "C": "CUATRIMESTRE",
    "T": "TRIMESTRE",
    "H": "CENTROS FORMACION HUMANISTICA",
    "M": "MENSUAL",
    "I": "INTENSIVO",
    "N": "BIANUAL",
  };
  return displays[code] ?? code;
}

/**
 * Parse HTML to extract span elements with value and text attributes.
 * Matches span tags like: <span value='code'>Text</span>
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
 * Parse a schedule text string into meeting times.
 * Expected format: "DayName - HH:MM:HH:MM" (e.g., "Martes - 7:30:9:20")
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
 * Parse an HTML schedule guide table into structured data.
 * Extracts course, group, schedule, and professor information from table rows.
 * @param html - The HTML string containing the schedule table
 * @returns Array of parsed schedule guide rows
 */
export function parseScheduleGuideTable(html: string): ScheduleGuideRow[] {
  const rows: ScheduleGuideRow[] = [];

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

    const meetings: MeetingTime[] = [];
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
 * Perform an HTTP request expecting a JSON response.
 * Supports TLS bypass for ITCR HTTPS endpoints when SEED_INSECURE_HTTPS is set.
 * @typeParam T - The expected JSON response type
 * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param url - The URL to request
 * @param opts - Optional request configuration
 * @returns Promise resolving to the parsed JSON response
 */
export async function httpJson<T>(
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

/**
 * Perform an HTTP request expecting a text response.
 * Supports TLS bypass for ITCR HTTPS endpoints when SEED_INSECURE_HTTPS is set.
 * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param url - The URL to request
 * @param opts - Optional request configuration
 * @returns Promise resolving to an object containing the response text and headers
 */
export async function httpText(
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
