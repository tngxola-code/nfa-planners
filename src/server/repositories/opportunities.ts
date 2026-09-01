/**
 * Opportunity repository over `data/opportunities.json`.
 *
 * SERVER-ONLY: do not import from client components (see store/fileStore.ts).
 *
 * Storage layout: a flat JSON array of Opportunity records. Records are
 * deduplicated by their stable `hash` (sha256 of
 * reference|title|client|closingDate, computed during normalisation).
 *
 * All functions accept an optional `{ dataDir }` (or honour NFA_DATA_DIR) so
 * smoke tests can run against a temp directory without touching real data.
 */

import path from "node:path";

// NOTE: relative imports only in src/server — the offline smoke loader
// transpiles TS→CJS without Next's "@/" path-alias resolution.
import type {
  Opportunity,
  OpportunityCategory,
  OpportunityStatus,
} from "../../lib/ocds/types";

import { resolveDataDir, type DataDirOptions } from "../paths";
import { readJsonFile, updateJsonFile } from "../store/fileStore";

const OPPORTUNITIES_FILE = "opportunities.json";

/**
 * Fields excluded from the "did the content change?" comparison: identity
 * and bookkeeping stamps are refreshed on every normalisation run and must
 * not turn an unchanged record into an "update".
 */
const VOLATILE_FIELDS = new Set(["id", "ingestedAt", "notifiedAt"]);

function opportunitiesPath(options?: DataDirOptions): string {
  return path.join(resolveDataDir(options?.dataDir), OPPORTUNITIES_FILE);
}

function contentEquals(a: Opportunity, b: Opportunity): boolean {
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  const av_ = a as unknown as Record<string, unknown>;
  const bv_ = b as unknown as Record<string, unknown>;
  for (const key of Array.from(keys)) {
    if (VOLATILE_FIELDS.has(key)) continue;
    const av = av_[key];
    const bv = bv_[key];
    if (Array.isArray(av) || Array.isArray(bv)) {
      if (JSON.stringify(av ?? []) !== JSON.stringify(bv ?? [])) return false;
      continue;
    }
    if (av !== bv) return false;
  }
  return true;
}

/** Default sort: closing date ascending (soonest deadline first). */
function byClosingDateAsc(a: Opportunity, b: Opportunity): number {
  const delta = Date.parse(a.closingDate) - Date.parse(b.closingDate);
  if (delta !== 0) return delta;
  return a.reference.localeCompare(b.reference);
}

export interface OpportunityFilter {
  status?: OpportunityStatus;
  category?: OpportunityCategory;
  /** Case-insensitive substring over title, client, reference, description. */
  search?: string;
  minFitScore?: number;
}

function matchesFilter(opportunity: Opportunity, filter: OpportunityFilter): boolean {
  if (filter.status !== undefined && opportunity.status !== filter.status) {
    return false;
  }
  if (filter.category !== undefined && opportunity.category !== filter.category) {
    return false;
  }
  if (
    filter.minFitScore !== undefined &&
    opportunity.fitScore < filter.minFitScore
  ) {
    return false;
  }
  if (filter.search !== undefined && filter.search.trim() !== "") {
    const needle = filter.search.trim().toLowerCase();
    const haystack = [
      opportunity.title,
      opportunity.client,
      opportunity.reference,
      opportunity.description ?? "",
    ]
      .join("\n")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/**
 * List stored opportunities, optionally filtered, sorted by closing date
 * ascending.
 */
export async function listOpportunities(
  filter: OpportunityFilter = {},
  options?: DataDirOptions,
): Promise<Opportunity[]> {
  const all = await readJsonFile<Opportunity[]>(opportunitiesPath(options), []);
  return all.filter((opp) => matchesFilter(opp, filter)).sort(byClosingDateAsc);
}

/** Look up a single opportunity by its buyer-side reference. */
export async function getOpportunityByReference(
  reference: string,
  options?: DataDirOptions,
): Promise<Opportunity | null> {
  const all = await readJsonFile<Opportunity[]>(opportunitiesPath(options), []);
  return all.find((opp) => opp.reference === reference) ?? null;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  skippedDuplicates: number;
}

/**
 * Insert or update a batch of opportunities, deduplicating by `hash`.
 *
 * For each incoming record:
 *  - no stored record with the same hash            -> inserted,
 *  - stored record exists and content is identical  -> skipped,
 *  - stored record exists but content changed       -> updated (the stored
 *    `id` and `ingestedAt` are preserved; the rest is replaced).
 *
 * Duplicates within the incoming batch itself are treated the same way: the
 * first occurrence wins, later occurrences update or skip against it.
 */
export async function upsertOpportunities(
  opportunities: Opportunity[],
  options?: DataDirOptions,
): Promise<UpsertResult> {
  if (opportunities.length === 0) {
    return { inserted: 0, updated: 0, skippedDuplicates: 0 };
  }

  const counts: UpsertResult = { inserted: 0, updated: 0, skippedDuplicates: 0 };

  await updateJsonFile<Opportunity[]>(
    opportunitiesPath(options),
    [],
    (current) => {
      const byHash = new Map(current.map((opp) => [opp.hash, opp]));
      const merged = [...current];

      for (const incoming of opportunities) {
        const existing = byHash.get(incoming.hash);
        if (!existing) {
          byHash.set(incoming.hash, incoming);
          merged.push(incoming);
          counts.inserted += 1;
          continue;
        }
        if (contentEquals(existing, incoming)) {
          counts.skippedDuplicates += 1;
          continue;
        }
        const next: Opportunity = {
          ...incoming,
          id: existing.id,
          ingestedAt: existing.ingestedAt,
          // A sent notification survives content updates: the dedup hash is
          // unchanged, so the opportunity must not be re-emailed.
          notifiedAt: existing.notifiedAt,
        };
        byHash.set(incoming.hash, next);
        merged[merged.indexOf(existing)] = next;
        counts.updated += 1;
      }

      return merged;
    },
  );

  return counts;
}

/**
 * Mark opportunities (by stable hash) as included in a sent digest email.
 * Returns the number of records updated.
 */
export async function markNotified(
  hashes: string[],
  notifiedAt: string = new Date().toISOString(),
  options?: DataDirOptions,
): Promise<number> {
  if (hashes.length === 0) return 0;
  const wanted = new Set(hashes);
  let marked = 0;

  await updateJsonFile<Opportunity[]>(opportunitiesPath(options), [], (current) =>
    current.map((opp) => {
      if (!wanted.has(opp.hash)) return opp;
      marked += 1;
      return { ...opp, notifiedAt };
    }),
  );

  return marked;
}

// ---------------------------------------------------------------------------
// Dashboard counts
// ---------------------------------------------------------------------------

export const HIGH_MATCH_FIT_SCORE = 80;
export const CLOSING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface OpportunityCounts {
  /** Opportunities with status "active". */
  active: number;
  /** Ingested on the same UTC calendar day as `now`. */
  newToday: number;
  /** Active opportunities closing within the next 7 days (not yet closed). */
  closingSoon: number;
  /** Active opportunities with fitScore >= 80. */
  highMatch: number;
}

export interface CountOptions extends DataDirOptions {
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

/** Aggregate counts for the console dashboard. */
export async function countOpportunities(
  options: CountOptions = {},
): Promise<OpportunityCounts> {
  const now = options.now ?? new Date();
  const all = await readJsonFile<Opportunity[]>(opportunitiesPath(options), []);

  const todayUtc = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();

  const counts: OpportunityCounts = {
    active: 0,
    newToday: 0,
    closingSoon: 0,
    highMatch: 0,
  };

  for (const opp of all) {
    const isActive = opp.status === "active";
    if (isActive) counts.active += 1;

    const ingestedMs = Date.parse(opp.ingestedAt);
    if (!Number.isNaN(ingestedMs) && opp.ingestedAt.slice(0, 10) === todayUtc) {
      counts.newToday += 1;
    }

    if (!isActive) continue;

    const closingMs = Date.parse(opp.closingDate);
    if (
      !Number.isNaN(closingMs) &&
      closingMs >= nowMs &&
      closingMs - nowMs <= CLOSING_SOON_WINDOW_MS
    ) {
      counts.closingSoon += 1;
    }

    if (opp.fitScore >= HIGH_MATCH_FIT_SCORE) {
      counts.highMatch += 1;
    }
  }

  return counts;
}
