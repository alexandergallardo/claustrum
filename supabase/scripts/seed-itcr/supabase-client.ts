/**
 * Supabase REST client for database operations.
 * Provides methods for upserting, inserting, selecting, and deleting records
 * via the Supabase PostgREST API.
 */

import type { HttpMethod } from "./types";
import { postgrestBaseUrl } from "./config";
import { logProgress, logSuccess } from "./logging";
import { httpJson } from "./http-client";

/**
 * Supabase REST client for PostgREST operations.
 * Handles authentication, CRUD operations, and university-specific logic.
 */
export class SupabaseRestClient {
  private baseUrl: string;
  private apikey: string;

  /**
   * Creates a new SupabaseRestClient instance.
   * @param opts - Configuration options
   * @param opts.supabaseUrl - The Supabase project URL
   * @param opts.secretKey - The Supabase service role secret key
   */
  constructor(opts: { supabaseUrl: string; secretKey: string }) {
    this.baseUrl = postgrestBaseUrl(opts.supabaseUrl);
    this.apikey = opts.secretKey;
  }

  /**
   * Upserts a single row into a table.
   * @typeParam T - The type of the row being upserted
   * @param params - Upsert parameters
   * @param params.table - Database table name
   * @param params.row - Row data to upsert
   * @param params.onConflict - Column(s) to use for conflict resolution
   * @param params.dryRun - When true, simulates the operation without database changes
   * @param params.showProgress - When false, suppresses progress logging
   */
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

  /**
   * Builds HTTP headers for Supabase requests.
   * @param extra - Additional headers to include
   * @returns Record containing authentication and custom headers
   */
  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      apikey: this.apikey,
      Authorization: `Bearer ${this.apikey}`,
      ...(extra ?? {}),
    };
  }

  /**
   * Upserts multiple rows into a table.
   * @typeParam T - The type of the rows being upserted
   * @param params - Upsert parameters
   * @param params.table - Database table name
   * @param params.rows - Array of row data to upsert
   * @param params.onConflict - Column(s) to use for conflict resolution
   * @param params.dryRun - When true, simulates the operation without database changes
   * @param params.showProgress - When false, suppresses progress logging
   */
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

  /**
   * Inserts multiple rows into a table.
   * @typeParam T - The type of the rows being inserted
   * @param params - Insert parameters
   * @param params.table - Database table name
   * @param params.rows - Array of row data to insert
   * @param params.dryRun - When true, simulates the operation without database changes
   * @param params.showProgress - When false, suppresses progress logging
   */
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

  /**
   * Selects rows from a table with optional filtering and limits.
   * Uses pagination to retrieve all rows when limit is high.
   * @typeParam T - The expected return type
   * @param params - Select parameters
   * @param params.table - Database table name
   * @param params.columns - Columns to select (comma-separated)
   * @param params.filter - PostgREST filter expression
   * @param params.limit - Maximum number of rows to return per page
   * @returns Array of selected rows
   */
  async select<T>(params: {
    table: string;
    columns: string;
    filter?: string;
    limit?: number;
  }): Promise<T[]> {
    const pageSize = params.limit ?? 10_000;
    const allRows: T[] = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore) {
      const qs = [
        `select=${encodeURIComponent(params.columns)}`,
        `limit=${encodeURIComponent(String(pageSize))}`,
        offset > 0 ? `offset=${encodeURIComponent(String(offset))}` : null,
        params.filter ? params.filter : null,
      ].filter(Boolean);
      const url = `${this.baseUrl}/${encodeURIComponent(params.table)}?${qs.join("&")}`;
      
      const rows = await httpJson<T[]>("GET", url, {
        headers: this.headers({ Accept: "application/json" }),
        timeoutMs: 60_000,
      });

      pageCount++;
      if (rows.length === 0 || rows.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }

      allRows.push(...rows);
    }

    if (pageCount > 1) {
      console.log(`    [paginated ${pageCount} pages, ${allRows.length} total rows for ${params.table}]`);
    }

    return allRows;
  }

  /**
   * Selects a single row from a table.
   * @typeParam T - The expected return type
   * @param params - Select parameters
   * @param params.table - Database table name
   * @param params.columns - Columns to select (comma-separated)
   * @param params.filter - PostgREST filter expression
   * @returns The first matching row or null if not found
   */
  async selectOne<T>(params: {
    table: string;
    columns: string;
    filter: string;
  }): Promise<T | null> {
    const url = `${this.baseUrl}/${encodeURIComponent(params.table)}?select=${encodeURIComponent(params.columns)}&${params.filter}&limit=1`;
    const rows = await httpJson<T[]>("GET", url, {
      headers: this.headers({ Accept: "application/json" }),
      timeoutMs: 60_000,
    });
    return rows[0] ?? null;
  }

  /**
   * Deletes rows matching a filter condition.
   * @param params - Delete parameters
   * @param params.table - Database table name
   * @param params.filter - PostgREST filter expression
   * @param params.dryRun - When true, simulates the operation without database changes
   */
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

  /**
   * Ensures the ITCR university exists in the database.
   * Creates the country and university records if they don't exist.
   * @param params - University parameters
   * @param params.countryIso2 - ISO 2-letter country code
   * @param params.universityName - Full university name
   * @param params.universityShortName - Short university name (abbreviation)
   * @param params.dryRun - When true, simulates the operation without database changes
   * @returns Object containing countryId and universityId, or null if creation failed
   */
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
      const uni2 = await this.selectOne<{ id: number }>({
        table: "university",
        columns: "id",
        filter: `short_name=eq.${encodeURIComponent(params.universityShortName)}`,
      });
      if (!uni2) return null;
      return { countryId: country.id, universityId: uni2.id };
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

    return { countryId: country.id, universityId: uni.id };
  }
}

/**
 * Returns the HTTP method to use for upsert operations.
 * Supabase PostgREST uses POST for upserts.
 * @returns The HTTP method "POST"
 */
export function methodForUpsert(): HttpMethod {
  return "POST";
}
