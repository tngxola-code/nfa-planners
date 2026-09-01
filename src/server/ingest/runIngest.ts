/**
 * Ingest runner: orchestrates the full opportunity pipeline.
 *
 *   fetchOcdsReleases -> normaliseRelease (drop nulls) -> upsertOpportunities
 *     -> optional sendDigest
 *
 * Reliability contract: this function NEVER throws for expected failure
 * modes. Per-release normalisation failures, a top-level fetch failure, and
 * notification failures are all collected into `report.errors` so that no
 * failure path can silently drop opportunities from view — every outcome is
 * visible in the returned IngestReport. It only throws on truly unexpected
 * internal bugs, and even those are surfaced by the CLI runner as exit 1.
 *
 * NOTE: relative imports only in src/server — the offline smoke loader
 * transpiles TS→CJS without Next's "@/" path-alias resolution.
 */

import { fetchOcdsReleases } from "../../lib/ocds/client";
import { normaliseRelease } from "../../lib/ocds/normalise";
import type { OcdsRelease } from "../../lib/ocds/types";
import type { DataDirOptions } from "../paths";
import { sendDigest, type SendDigestResult } from "../notifications/sendDigest";
import { upsertOpportunities, type UpsertResult } from "../repositories/opportunities";

export interface IngestReport {
  /** Releases returned by the source. */
  fetched: number;
  /** Releases successfully normalised into opportunities. */
  normalised: number;
  /** Releases dropped during normalisation (low fit, expired, invalid). */
  droppedLowFit: number;
  inserted: number;
  updated: number;
  skippedDuplicates: number;
  notified: SendDigestResult;
  /** Human-readable failure descriptions; empty on a clean run. */
  errors: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface RunIngestOptions extends DataDirOptions {
  /** Send the digest email after ingestion (default false). */
  notify?: boolean;
  /**
   * Digest recipient. Defaults to CONSOLE_AUTH_EMAIL, then
   * TEST_EMAIL_RECIPIENT.
   */
  recipient?: string;
  /** Injectable release source (defaults to fetchOcdsReleases) — for tests. */
  fetchReleases?: () => Promise<OcdsRelease[]>;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runIngest(options: RunIngestOptions = {}): Promise<IngestReport> {
  const startedAt = new Date();
  const errors: string[] = [];

  const base: Omit<IngestReport, "finishedAt" | "durationMs"> = {
    fetched: 0,
    normalised: 0,
    droppedLowFit: 0,
    inserted: 0,
    updated: 0,
    skippedDuplicates: 0,
    notified: { sent: 0, skipped: true },
    errors,
    startedAt: startedAt.toISOString(),
  };

  const finish = (): IngestReport => {
    const finishedAt = new Date();
    return {
      ...base,
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  };

  // 1. Fetch. A failure here must not throw: record it and report zeros.
  const fetchReleases = options.fetchReleases ?? (() => fetchOcdsReleases());
  let releases: OcdsRelease[];
  try {
    releases = await fetchReleases();
  } catch (err) {
    errors.push(`fetch failed: ${describe(err)}`);
    return finish();
  }
  base.fetched = releases.length;

  // 2. Normalise. Per-release failures are collected, not thrown.
  const opportunities = [];
  for (const release of releases) {
    try {
      const opportunity = normaliseRelease(release);
      if (opportunity === null) {
        base.droppedLowFit += 1;
        continue;
      }
      opportunities.push(opportunity);
    } catch (err) {
      errors.push(
        `normalise failed for release ${release?.id ?? "<unknown>"}: ${describe(err)}`,
      );
    }
  }
  base.normalised = opportunities.length;

  // 3. Persist.
  let upsert: UpsertResult;
  try {
    upsert = await upsertOpportunities(opportunities, options);
    base.inserted = upsert.inserted;
    base.updated = upsert.updated;
    base.skippedDuplicates = upsert.skippedDuplicates;
  } catch (err) {
    errors.push(`persistence failed: ${describe(err)}`);
    return finish();
  }

  // 4. Optional digest. Notification failures are collected, not thrown.
  if (options.notify) {
    const recipient =
      options.recipient ??
      process.env.CONSOLE_AUTH_EMAIL ??
      process.env.TEST_EMAIL_RECIPIENT;

    if (!recipient) {
      errors.push(
        "notify requested but no recipient configured (recipient option, CONSOLE_AUTH_EMAIL or TEST_EMAIL_RECIPIENT)",
      );
    } else {
      try {
        base.notified = await sendDigest(recipient, options);
      } catch (err) {
        errors.push(`notification failed: ${describe(err)}`);
      }
    }
  }

  return finish();
}
