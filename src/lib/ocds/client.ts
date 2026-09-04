/**
 * eTenders OCDS API client.
 *
 * Server-side only. The client is never invoked at module top level; call
 * `fetchOcdsReleases` from an ingestion job or route handler.
 */

import { isOcdsRelease, type OcdsRelease } from "./types";

const DEFAULT_BASE_URL = "https://ocds-api.etenders.gov.za";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_LIMIT = 50;

export interface FetchOcdsReleasesOptions {
  /** Overrides ETENDERS_OCDS_BASE_URL (mainly for tests). */
  baseUrl?: string;
  /** Maximum number of releases to request. */
  limit?: number;
  /** Request timeout in milliseconds (default 15s). */
  timeoutMs?: number;
  /** Injected fetch implementation (defaults to globalThis.fetch). */
  fetchImpl?: typeof fetch;
  /** ISO date string (YYYY-MM-DD) for start of window. Defaults to 90 days ago. */
  dateFrom?: string;
  /** ISO date string (YYYY-MM-DD) for end of window. Defaults to today. */
  dateTo?: string;
}

/**
 * Fetch recent OCDS releases from the eTenders OCDS API.
 *
 * Throws on non-2xx responses and on malformed JSON. Releases that do not
 * match the expected OCDS shape are dropped silently.
 */
export async function fetchOcdsReleases(
  options: FetchOcdsReleasesOptions = {},
): Promise<OcdsRelease[]> {
  const baseUrl =
    options.baseUrl ?? process.env.ETENDERS_OCDS_BASE_URL ?? DEFAULT_BASE_URL;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("OCDS client: no fetch implementation available in this runtime");
  }

  // Build date window – default to last 90 days
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const dateFrom = options.dateFrom ?? defaultFrom.toISOString().split('T')[0];
  const dateTo = options.dateTo ?? now.toISOString().split('T')[0];

  const url = new URL("/api/OCDSReleases", baseUrl);
  url.searchParams.set("dateFrom", dateFrom);
  url.searchParams.set("dateTo", dateTo);
  url.searchParams.set("PageSize", String(limit));

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(
      `OCDS request to ${url.toString()} failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `OCDS request to ${url.toString()} failed with status ${response.status}`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    throw new Error(
      `OCDS response from ${url.toString()} was not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // Tolerate both a bare release array and a release-package envelope.
  const releases: unknown[] = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.releases)
      ? payload.releases
      : [];

  return releases.filter(isOcdsRelease);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
