/**
 * Campus map loader for TEC Digital.
 * Loads campus codes and names from TEC Digital API endpoints.
 */

import { URLS } from "../config";
import { httpText, httpJson } from "../http-client";

export interface CampusMapEntry {
  code: string;
  name: string;
}

export interface CampusMap {
  codeByNormalizedName: Map<string, string>;
  nameByCode: Map<string, string>;
}

export async function loadCampusMap(): Promise<CampusMap> {
  const codeByNormalizedName = new Map<string, string>();
  const nameByCode = new Map<string, string>();

  try {
    const { text } = await httpText("POST", URLS.studentRecords.campusesHtml, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
      },
      timeoutMs: 30_000,
    });

    const spans = parseHtmlSpans(text);
    for (const s of spans) {
      const code = s.value.trim();
      const name = s.text.trim().toUpperCase();
      if (code && name && !codeByNormalizedName.has(name)) {
        codeByNormalizedName.set(name, code);
        nameByCode.set(code, name);
      }
    }
  } catch (error) {
    console.warn(`Failed to load campus map from HTML endpoint: ${error}`);
  }

  try {
    const data = await httpJson<{ sedes: Array<{ key: string; data: string }> }>(
      "GET",
      URLS.curriculum.campusesJson,
      {
        headers: { Accept: "application/json" },
        timeoutMs: 30_000,
      },
    );

    for (const item of data.sedes ?? []) {
      const code = (item.key ?? "").trim();
      const name = (item.data ?? "").trim().toUpperCase();
      if (code && name && !codeByNormalizedName.has(name)) {
        codeByNormalizedName.set(name, code);
        nameByCode.set(code, name);
      }
    }
  } catch (error) {
    console.warn(`Failed to load campus map from JSON endpoint: ${error}`);
  }

  return { codeByNormalizedName, nameByCode };
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

export function mapSedeName(
  name: string,
  campusMap: CampusMap,
): string {
  const normalized = name.trim().toUpperCase();
  const code = campusMap.codeByNormalizedName.get(normalized);
  if (code) return code;
  return normalized.slice(0, 2).toUpperCase();
}
