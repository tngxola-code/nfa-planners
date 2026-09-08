/**
 * eTenders OCDS API client with retries and timeout.
 */

import { isOcdsRelease, type OcdsRelease } from "@/lib/ocds/types";

const DEFAULT_BASE_URL = "https://ocds-api.etenders.gov.za";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_LIMIT = 50;
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 1000;

export interface FetchOcdsReleasesOptions {
  baseUrl?: string;
  limit?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  retries: number
): Promise<Response> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      const backoff = RETRY_BACKOFF * Math.pow(2, attempt - 1);
      console.warn(`OCDS fetch attempt ${attempt} failed, retrying in ${backoff}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error("Unreachable");
}

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

  const url = new URL("/releases", baseUrl);
  url.searchParams.set("limit", String(limit));

  let response: Response;
  try {
    response = await fetchWithRetry(
      url.toString(),
      { headers: { accept: "application/json" } },
      timeoutMs,
      MAX_RETRIES
    );
  } catch (err) {
    throw new Error(
      `OCDS request to ${url.toString()} failed after ${MAX_RETRIES} attempts: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `OCDS request to ${url.toString()} failed with status ${response.status}`
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    throw new Error(
      `OCDS response from ${url.toString()} was not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const releases: unknown[] = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.releases)
      ? payload.releases
      : [];

  const valid = releases.filter(isOcdsRelease);
  if (valid.length < releases.length) {
    console.warn(`OCDS: ${releases.length - valid.length} releases failed validation and were dropped.`);
  }
  return valid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
