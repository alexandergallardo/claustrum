/**
 * TEC Digital fetchers for batch schedule data retrieval.
 * 
 * Provides batch fetching of schedule guide data from the TEC Digital student records
 * endpoint. Used to complement Guía Horarios data with capacity and classroom info.
 */

import { URLS } from "../config";
import { httpText } from "../http-client";
import type { TecDigitalRow, TecDigitalCombination } from "../types";
import { mapSedeName, type CampusMap } from "./campus-map";

function normalizeHeader(text: string): string {
  const withoutTags = text.replace(/<\/?.?[^>]+>/g, "");
  const trimmed = withoutTags.trim().toUpperCase();
  const spaces = trimmed.replace(/\s+/g, "_");
  const normalized = spaces
    .replace(/Í/g, "I")
    .replace(/Á/g, "A")
    .replace(/É/g, "E")
    .replace(/Ó/g, "O")
    .replace(/Ú/g, "U")
    .replace(/Ñ/g, "N");
  return normalized;
}

function normalizeGrupo(grupo: string | number): number {
  if (typeof grupo === "number") return grupo;
  const cleaned = String(grupo).replace(/^0+/, "");
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function buildTecDigitalCombinations(
  guiaRows: Array<{
    DSC_SEDE: string;
    IDE_MATERIA: string;
    IDE_GRUPO: number;
    IDE_MODALIDAD: string;
    IDE_PER_MOD: number;
    NUM_ANO: number;
  }>,
  academicUnitCode: string,
  campusMap: CampusMap,
): Set<TecDigitalCombination> {
  const combinations = new Set<TecDigitalCombination>();
  const seen = new Set<string>();

  for (const row of guiaRows) {
    const periodo = `${row.NUM_ANO}_${row.IDE_MODALIDAD}_${row.IDE_PER_MOD}`;
    const sedeCode = mapSedeName(row.DSC_SEDE, campusMap);
    const key = `${sedeCode}|${academicUnitCode}|${periodo}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      combinations.add([sedeCode, academicUnitCode, periodo] as TecDigitalCombination);
    }
  }
  return combinations;
}

export async function fetchTecDigitalBatch(
  combinations: Set<TecDigitalCombination>
): Promise<Map<TecDigitalCombination, TecDigitalRow[]>> {
  const results = new Map<TecDigitalCombination, TecDigitalRow[]>();
  const base = URLS.studentRecords.scheduleGuide;

  const sortedCombos = Array.from(combinations).sort();

  for (const [sede, carrera, periodo] of sortedCombos) {
    try {
      const params = new URLSearchParams({
        sede,
        carrera,
        periodo,
      });

      const url = `${base}?${params.toString()}`;
      console.log(`  GET ${url}`);

      const response = await httpText("GET", url, {
        headers: {
          Accept: "text/html",
        },
        timeoutMs: 30000,
      });

      const rows = parseTecDigitalTable(response.text);
      results.set([sede, carrera, periodo] as TecDigitalCombination, rows);
      console.log(`    → ${rows.length} rows`);
    } catch (error) {
      console.warn(
        `Failed to fetch TEC Digital data for ${sede}/${carrera}/${periodo}: ${error}`
      );
      results.set([sede, carrera, periodo] as TecDigitalCombination, []);
    }
  }

  return results;
}

export function parseTecDigitalTable(html: string): TecDigitalRow[] {
  const rows: TecDigitalRow[] = [];

  if (!html.includes("<table")) return rows;

  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return rows;

  const tableHtml = tableMatch[1];
  const theadMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);

  let header: string[] = [];
  let bodyHtml = tableHtml;

  if (theadMatch) {
    const thMatches = theadMatch[1].matchAll(/<th[^>]*>([^<]+)<\/th>/gi);
    header = Array.from(thMatches, (m) => normalizeHeader(m[1]));
  }

  if (tbodyMatch) {
    bodyHtml = tbodyMatch[1];
  } else {
    const trMatches = bodyHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (trMatches && trMatches.length > 0) {
      bodyHtml = trMatches.slice(1).join("");
    }
  }

  const trMatches = bodyHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const trHtml of trMatches) {
    const tdMatches = trHtml.match(/<t[dh][^>]*>([^<]*)<\/t[dh]>/gi);
    if (!tdMatches || tdMatches.length === 0) continue;

    const cells = tdMatches.map((m) => {
      const content = m.replace(/<\/?t[dh][^>]*>/gi, "").trim();
      return content;
    });

    if (cells.length < header.length) continue;

    const row: TecDigitalRow = {} as TecDigitalRow;
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = cells[i] || "";
    }
    rows.push(row);
  }

  return rows;
}

export function findTecDigitalRow(
  tecdigitalData: Map<TecDigitalCombination, TecDigitalRow[]>,
  sedeCodigo: string,
  carrera: string,
  periodo: string,
  ideMateria: string,
  ideGrupo: number
): TecDigitalRow | null {
  const key: TecDigitalCombination = [sedeCodigo, carrera, periodo];
  const rows = tecdigitalData.get(key);
  if (!rows) return null;

  for (const tecRow of rows) {
    const tecCodigo = tecRow.CODIGO || "";
    const tecGrupo = normalizeGrupo(tecRow.GRUPO || "0");
    if (tecCodigo === ideMateria && tecGrupo === ideGrupo) {
      return tecRow;
    }
  }

  return null;
}
