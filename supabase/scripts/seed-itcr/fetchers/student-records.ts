/**
 * Student Records API fetchers.
 * Provides functions to fetch campuses, programs, terms, and schedule guides
 * from the ITCR Student Records (Expediente Estudiantil) endpoints.
 */

import { URLS } from "../config";
import {
	httpText,
	httpJson,
	parseHtmlSpans,
} from "../http-client";
import type { PeriodRow, AcademicTermRow } from "../types";
import { safeNumber } from "../utils";

/**
 * Fetches campus list from the Student Records HTML endpoint.
 * Parses HTML response to extract campus codes and names from span elements.
 * 
 * @returns Promise resolving to array of campus objects with code and name properties
 */
export async function fetchCampusesFromStudentRecordsHtml(): Promise<
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

/**
 * Fetches academic programs for a given campus from the Student Records HTML endpoint.
 * Parses HTML response to extract program codes and names from span elements.
 * 
 * @param campusCode - The campus code to fetch programs for
 * @returns Promise resolving to array of program objects with code and name properties
 */
export async function fetchProgramsByCampusFromStudentRecordsHtml(
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

/**
 * Fetches academic terms from the Student Records API endpoint.
 * Returns parsed term data including external key, display name, year, modality, and period.
 * 
 * @returns Promise resolving to array of academic term objects
 */
export async function fetchTermsFromStudentRecordsApi(): Promise<
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

	const out: Array<AcademicTermRow> = [];
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

/**
 * Fetches schedule guide HTML for a given campus, program, and term.
 * Returns raw HTML that needs to be parsed for structured data.
 * 
 * @param params - Parameters object containing campusCode, programCode, and termKey
 * @param params.campusCode - The campus code
 * @param params.programCode - The program/career code
 * @param params.termKey - The academic term key (e.g., "2026_S_1")
 * @returns Promise resolving to raw HTML string of the schedule guide
 */
export async function fetchScheduleGuideHtml(params: {
	campusCode: string;
	programCode: string;
	termKey: string;
}): Promise<string> {
	const url = URLS.studentRecords.scheduleGuide;
	const body = new URLSearchParams({
		sede: params.campusCode,
		carrera: params.programCode,
		periodo: params.termKey,
	}).toString();
	const { text } = await httpText("POST", url, {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			Accept: "text/html",
		},
		body,
		timeoutMs: 60_000,
	});
	return text;
}

/**
 * Parses an academic term key into its component parts.
 * Keys follow the format: YEAR_MODALITY_PERIOD (e.g., "2026_S_1").
 * 
 * @param key - The academic term key to parse
 * @returns Object with year, modalityCode, and periodNumber, or null if invalid
 */
function parseAcademicTermKey(
	key: string,
): { year: number; modalityCode: string; periodNumber: number } | null {
	const m = /^(\d{4})_([A-Z])_(\d+)$/.exec(key.trim());
	if (!m) return null;
	return {
		year: safeNumber(m[1], 0),
		modalityCode: m[2],
		periodNumber: safeNumber(m[3], 0),
	};
}
