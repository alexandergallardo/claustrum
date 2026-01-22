/**
 * Curriculum API fetchers for the ITCR seed script.
 * Provides functions to fetch campuses, careers, plans, and plan details
 * from the TecDigital Curriculum API endpoints.
 */

import { URLS } from "../config";
import { httpJson } from "../http-client";
import type {
  CurriculumCampusesResponse,
  CurriculumCareersResponse,
  CurriculumPlansResponse,
  CurriculumPlanDetails,
} from "../types";
import { safeNumber } from "../utils";

/**
 * Fetches all campuses from the Curriculum API.
 * Returns a list of campus locations with their codes and names.
 *
 * @returns Promise resolving to an array of campus objects with code and name properties
 */
export async function fetchCampusesFromCurriculumApi(): Promise<
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

/**
 * Fetches program careers for a given campus from the Curriculum API.
 * Returns a list of academic programs/careers available at the specified campus.
 *
 * @param campusCode - The campus code to fetch careers for
 * @returns Promise resolving to an array of career objects with code and name properties
 */
export async function fetchProgramCareersFromCurriculumApi(
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

/**
 * Fetches study plans for a given program from the Curriculum API.
 * Returns a list of study plans available for the specified program at the campus.
 *
 * @param params - Object containing campusCode and programCode
 * @param params.campusCode - The campus code
 * @param params.programCode - The program/department code
 * @returns Promise resolving to an array of plan objects with externalPlanId and name properties
 */
export async function fetchPlansByProgramFromCurriculumApi(params: {
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

/**
 * Fetches detailed information for a specific study plan from the Curriculum API.
 * Returns comprehensive curriculum data including courses, requirements, and academic metadata.
 *
 * @param externalPlanId - The external plan ID from the curriculum API
 * @returns Promise resolving to the curriculum plan details
 */
export async function fetchPlanDetailsFromCurriculumApi(
  externalPlanId: number,
): Promise<CurriculumPlanDetails> {
  const url = `${URLS.curriculum.planDetails}?id_plan=${encodeURIComponent(String(externalPlanId))}`;
  return httpJson<CurriculumPlanDetails>("GET", url, {
    headers: { Accept: "application/json" },
    timeoutMs: 60_000,
  });
}
