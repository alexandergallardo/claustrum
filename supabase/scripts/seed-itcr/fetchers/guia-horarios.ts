import { URLS } from "../config";
import {
  httpJson,
  httpText,
  parseScheduleGuideTable,
} from "../http-client";
import type { GuiaOfertaEscuelaAnoRow } from "../types";
import { safeNumber } from "../utils";

function logWarn(message: string): void {
  console.warn(`  ⚠ ${message}`);
}

function logError(message: string): void {
  console.error(`  ✗ ${message}`);
}

function logInfo(message: string): void {
  console.log(`  • ${message}`);
}

export type GuiaHorariosEnvelope = { d: string };

export type GuiaEscuelaRow = {
  IDE_DEPTO: string;
  DSC_DEPTO: string;
};

export type GuiaModalityRow = {
  IDE_MODALIDAD: string;
  NOMBRE: string;
  CANT_PERIODOS: number;
};

/**
 * Extracts the AlteonP cookie value from a Set-Cookie header.
 */
export function extractAlteonpFromSetCookie(setCookie: string): string | null {
  const m = /(?:^|;\s*)AlteonP=([^;]+)/i.exec(setCookie);
  return m?.[1] ?? null;
}

/**
 * Acquires the AlteonP cookie by making a GET request to the guiahorarios escuela.aspx page.
 */
export async function acquireGuiaHorariosAlteonpCookie(): Promise<string> {
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

/**
 * Returns the headers required for requests to guiahorarios AJAX endpoints.
 */
export function guiaHeaders(alteonp: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: `AlteonP=${alteonp}`,
  };
}

/**
 * Fetches academic units (escuelas) from guiahorarios.
 */
export async function fetchAcademicUnitsFromGuiaHorarios(
  alteonpValue: string,
): Promise<Array<{ code: string; name: string }>> {
  try {
    const envl = await httpJson<GuiaHorariosEnvelope>(
      "POST",
      URLS.guiaHorarios.cargaEscuelas,
      {
        headers: {
          ...guiaHeaders(alteonpValue),
        },
        body: {},
        timeoutMs: 5_000,
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
  } catch (error) {
    logError(
      `appsext cargaEscuelas failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return await fetchAcademicUnitsFromTecdigital();
  }
}

/**
 * Fetches academic modalities from guiahorarios.
 */
export async function fetchModalitiesFromGuiaHorarios(
  alteonpValue: string,
): Promise<Array<{ code: string; name: string; periods_per_year: number }>> {
  try {
    const envl = await httpJson<GuiaHorariosEnvelope>(
      "POST",
      URLS.guiaHorarios.cargaModalidadPeriodos,
      {
        headers: {
          ...guiaHeaders(alteonpValue),
        },
        body: {},
        timeoutMs: 5_000,
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
  } catch (error) {
    logError(
      `appsext cargaModalidadPeriodos failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return await fetchModalitiesTocdigital();
  }
}

/**
 * Fetches course offerings from guiahorarios appsext endpoint.
 */
export async function fetchOfferingsByAcademicUnitAndYearFromGuiaHorarios(params: {
  alteonp: string;
  academicUnitCode: string;
  year: number;
  skipGuiaHorarios?: boolean;
}): Promise<GuiaOfertaEscuelaAnoRow[]> {
  try {
    if (params.skipGuiaHorarios) {
      return await fetchOfferingsByAcademicUnitAndYearFromTecdigital(
        params.academicUnitCode,
        params.year,
      );
    }

    const endpoint = URLS.guiaHorarios.getdatosEscuelaAno;
    const body = { escuela: params.academicUnitCode, ano: String(params.year) };
    
    logInfo(`GET ${endpoint}?escuela=${params.academicUnitCode}&ano=${params.year}`);

    const envl = await httpJson<GuiaHorariosEnvelope>(
      "POST",
      endpoint,
      {
        headers: guiaHeaders(params.alteonp),
        body,
        timeoutMs: 10_000,
      },
    );

    const d = String(envl.d ?? "").trim();
    if (!d) {
      logInfo(`  → No data (empty response)`);
      return [];
    }
    if (/^NO\b/i.test(d)) {
      logInfo(`  → No data ("NO DATOS")`);
      return [];
    }

    const raw = JSON.parse(d) as unknown;
    if (!Array.isArray(raw)) {
      logInfo(`  → No data (not an array)`);
      return [];
    }
    
    const rows = raw as GuiaOfertaEscuelaAnoRow[];
    logInfo(`  → ${rows.length} rows`);
    return rows;
  } catch (error) {
    logError(
      `appsext getdatosEscuelaAno failed for unit ${params.academicUnitCode} year ${params.year}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return await fetchOfferingsByAcademicUnitAndYearFromTecdigital(
      params.academicUnitCode,
      params.year,
    );
  }
}

/**
 * Fetches course offerings from tecdigital tabla_guia_horario endpoint as fallback.
 */
export async function fetchOfferingsByAcademicUnitAndYearFromTecdigital(
  academicUnitCode: string,
  year: number,
): Promise<GuiaOfertaEscuelaAnoRow[]> {
  try {
    logWarn(
      `Attempting tecdigital fallback for unit ${academicUnitCode} year ${year}...`,
    );

    const periods = await httpJson<Array<{ key: string; data: string }>>(
      "POST",
      URLS.studentRecords.periods,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeoutMs: 10_000,
      },
    );

    const periodKeysForYear = (periods ?? [])
      .filter((p) => p.key?.startsWith(`${year}_`))
      .map((p) => p.key);

    if (periodKeysForYear.length === 0) {
      logWarn(`No periods found for year ${year}`);
      return [];
    }

    const allRows: GuiaOfertaEscuelaAnoRow[] = [];

    const campusesResponse = await httpText("POST", URLS.studentRecords.campusesHtml, {
      timeoutMs: 10_000,
    });
    const campusMatches = Array.from(
      campusesResponse.text.matchAll(/<span\s+value='([^']+)'>([^<]+)<\/span>/gi),
    );

    for (const campusMatch of campusMatches) {
      const campusCode = campusMatch[1];
      const campusName = campusMatch[2];
      if (!campusCode) continue;

      for (const periodKey of periodKeysForYear) {
        try {
          const htmlResponse = await httpText("POST", URLS.studentRecords.scheduleGuide, {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              Accept: "text/html",
            },
            body: new URLSearchParams({
              sede: String(campusCode ?? ""),
              carrera: String(academicUnitCode ?? ""),
              periodo: String(periodKey ?? ""),
            }).toString(),
            timeoutMs: 10_000,
          });

          const parsedRows = parseScheduleGuideTable(htmlResponse.text);

          if (parsedRows.length === 0) {
            const hasTable = htmlResponse.text.includes("<table") || htmlResponse.text.includes("<tr");
            if (!hasTable) {
              logWarn(`  No table found in HTML for ${academicUnitCode}/${periodKey}`);
            } else {
              logWarn(`  Table found but 0 rows parsed for ${academicUnitCode}/${periodKey}`);
            }
          }

          const periodParts = periodKey.split("_");
          const periodYear = safeNumber(periodParts[0], year);
          const modality = periodParts[1] ?? "S";
          const periodNum = safeNumber(periodParts[2], 1);

          const groupedByKey = new Map<string, typeof parsedRows[0] & { meetings: Array<{ weekday: number; startTime: string; endTime: string }> }>();
          for (const row of parsedRows) {
            const key = `${row.courseCode}::${row.groupCode}`;
            const existing = groupedByKey.get(key);
            if (existing) {
              if (row.meetings && row.meetings.length > 0) {
                existing.meetings.push(...row.meetings);
              }
            } else {
              groupedByKey.set(key, {
                ...row,
                meetings: row.meetings ?? [],
              });
            }
          }

          for (const [, row] of groupedByKey) {
            allRows.push({
              DSC_SEDE: campusName ?? `Campus ${campusCode}`,
              IDE_MATERIA: row.courseCode,
              DSC_MATERIA: row.courseName,
              IDE_GRUPO: safeNumber(row.groupCode, 0),
              DSC_DEPTO: academicUnitCode,
              CAN_CREDITOS: row.credits,
              HORAS: row.credits,
              NOM_DIA: row.meetings?.[0] ? getDayNameFromWeekday(row.meetings[0].weekday) : "",
              IDE_MODALIDAD: modality,
              IDE_PER_MOD: periodNum,
              NUM_ANO: periodYear,
              DSC_MODALIDAD: getModalityDisplay(modality),
              TIPO_CURSO: row.courseType ?? "",
              HINICIO: row.meetings?.[0]?.startTime ?? "",
              HFIN: row.meetings?.[0]?.endTime ?? "",
              NOM_PROFESOR: row.professorName ?? "",
              RESERVA_SEDE: "",
              RESERVA_DEPTO: "",
              RESERVA_PLAN: "",
            });
          }
        } catch (e) {
          logWarn(
            `Failed to fetch schedule for ${academicUnitCode} period ${periodKey}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    if (allRows.length > 0) {
      logInfo(
        `Tecdigital fallback returned ${allRows.length} rows for unit ${academicUnitCode} year ${year}`,
      );
    }
    return allRows;
  } catch (error) {
    logWarn(
      `Tecdigital fallback also failed: ${error instanceof Error ? error.message : String(error)}, skipping offerings for ${academicUnitCode} year ${year}`,
    );
    return [];
  }
}

/**
 * Converts a weekday number to its Spanish day name.
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
 * Returns the display name for a modality code.
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
 * Fallback: fetches academic units from tecdigital when guiahorarios fails.
 */
export async function fetchAcademicUnitsFromTecdigital(): Promise<
  Array<{ code: string; name: string }>
> {
  logWarn(
    "appsext cargaEscuelas failed, fetching from tecdigital carga_carreras_json...",
  );
  try {
    const campusesResponse = await httpText("POST", URLS.studentRecords.campusesHtml, {
      timeoutMs: 10_000,
    });
    const campusesHtml = campusesResponse.text;

    const campusMatches = Array.from(
      campusesHtml.matchAll(/<span\s+value='([^']+)'>([^<]+)<\/span>/gi),
    );
    const campusCodes: string[] = [];
    for (const m of campusMatches) {
      const code = m[1]?.trim();
      if (code) campusCodes.push(code);
    }

    if (campusCodes.length === 0) {
      logWarn(
        `No campuses extracted from carga_sedes_tds_lib. Raw HTML: ${campusesHtml.substring(0, 200)}...`,
      );
      return [];
    }

    logInfo(`Extracted ${campusCodes.length} campuses: ${campusCodes.join(", ")}`);

    const allUnits = new Map<string, { code: string; name: string }>();
    const results = await Promise.allSettled(
      campusCodes.map(async (campusCode) => {
        const url = `${URLS.curriculum.careersByCampus}?id_sede=${encodeURIComponent(campusCode)}`;
        const data = await httpJson<{ carreras: Array<{ key: string; data: string }> }>("GET", url, {
          headers: { Accept: "application/json" },
          timeoutMs: 10_000,
        });

        const items: Array<{ code: string; name: string }> = [];
        for (const item of data.carreras ?? []) {
          const code = String(item.key ?? "").trim();
          const name = String(item.data ?? "").trim();
          if (code) {
            items.push({ code, name });
          }
        }
        return { campus: campusCode, items };
      }),
    );

    let successCount = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        successCount++;
        const { campus, items } = result.value;
        logInfo(`Campus ${campus}: found ${items.length} units`);
        for (const item of items) {
          if (!allUnits.has(item.code)) {
            allUnits.set(item.code, item);
          }
        }
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        logWarn(`Failed to fetch units for a campus: ${reason}`);
      }
    }

    logInfo(`Successfully fetched ${successCount}/${campusCodes.length} campuses, total unique units: ${allUnits.size}`);
    return Array.from(allUnits.values());
  } catch (error) {
    logWarn(
      `tecdigital fallback also failed: ${error instanceof Error ? error.message : String(error)}, skipping academic units`,
    );
    return [];
  }
}

/**
 * Fallback: fetches modalities from tecdigital when guiahorarios fails.
 */
export async function fetchModalitiesTocdigital(): Promise<
  Array<{ code: string; name: string; periods_per_year: number }>
> {
  logWarn(
    "appsext cargaModalidadPeriodos failed, fetching from tecdigital carga_periodos_tds_lib...",
  );
  try {
    const periods = await httpJson<
      Array<{ key: string; data: string }>
    >(
      "POST",
      URLS.studentRecords.periods,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeoutMs: 10_000,
      },
    );

    const modalityMap = new Map<string, { periods: Set<string>; display: string }>();

    for (const p of periods ?? []) {
      const key = String(p.key ?? "").trim();
      const display = String(p.data ?? "").trim();

      const parts = key.split("_");
      if (parts.length >= 2) {
        const modCode = parts[1] ?? "";

        if (!modalityMap.has(modCode)) {
          modalityMap.set(modCode, { periods: new Set(), display: "" });
        }

        const entry = modalityMap.get(modCode)!;
        entry.periods.add(key);

        if (!entry.display && display) {
          const nameMatch = /[\d\s-]*-\s*(.+?)\s+\d+/.exec(display);
          entry.display = nameMatch ? nameMatch[1]! : modCode;
        }
      }
    }

    const modalityDisplayNames: Record<string, string> = {
      "S": "Semestre",
      "B": "Bimestre",
      "C": "Cuatrimestre",
      "T": "Trimestre",
      "M": "Mensual",
      "H": "Humanística",
      "V": "Verano",
    };

    const result: Array<{ code: string; name: string; periods_per_year: number }> = [];
    for (const [code, entry] of modalityMap) {
      const displayName = entry.display || modalityDisplayNames[code] || code;
      result.push({
        code,
        name: displayName,
        periods_per_year: entry.periods.size,
      });
    }

    return result;
  } catch (error) {
    logWarn(
      `tecdigital fallback failed: ${error instanceof Error ? error.message : String(error)}, using default modalities`,
    );
    return [
      { code: "M", name: "Modalidad Presencial", periods_per_year: 2 },
      { code: "V", name: "Modalidad Virtual", periods_per_year: 2 },
      { code: "H", name: "Modalidad Híbrida", periods_per_year: 2 },
    ];
  }
}

/**
 * Fetches course offerings from Guía Horarios for a specific school and year.
 * This is the primary function used in the new syncSchedule flow.
 * 
 * @param alteonp - The AlteonP authentication cookie
 * @param escuela - The academic unit/school code
 * @param ano - The academic year to fetch
 * @returns Array of GuiaOfertaEscuelaAnoRow with all course offering data
 */
export async function fetchGuiaHorariosByEscuelaYear(
  alteonp: string,
  escuela: string,
  ano: number
): Promise<GuiaOfertaEscuelaAnoRow[]> {
  return fetchOfferingsByAcademicUnitAndYearFromGuiaHorarios({
    alteonp,
    academicUnitCode: escuela,
    year: ano,
  });
}
