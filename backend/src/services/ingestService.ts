import type { Prisma, PrismaClient } from "@prisma/client";
import {
  isMatch,
  makeIngestConfig,
  parseRelease,
  type OcdsRelease,
} from "../lib/ocds.js";
import type { IngestStatus } from "../types/tenders.js";
import type { MatchAlert } from "./alertsService.js";

export type ReleasePage = {
  releases: OcdsRelease[];
  next: string | null;
};

export type ReleaseFetcher = (url: string) => Promise<ReleasePage>;

const DEFAULT_FEED_URL =
  process.env.ETENDERS_OCDS_URL ??
  "https://ocds-api.etenders.gov.za/api/1.1/releases";

function asJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function earlierDate(
  current: Date | null | undefined,
  incoming: Date | null,
): Date | null {
  if (!current) return incoming;
  if (!incoming) return current;

  return current <= incoming ? current : incoming;
}

function sanitizeMaxPages(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 5;
  }

  return Math.min(Math.floor(value), 100);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function httpFetcher(timeoutMs = 15_000): ReleaseFetcher {
  return async (url) => {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "nfa-console-tender-ingest/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`eTenders feed returned HTTP ${response.status}`);
    }

    const json = (await response.json()) as {
      releases?: unknown;
      links?: {
        next?: unknown;
      };
    };

    if (json.releases !== undefined && !Array.isArray(json.releases)) {
      throw new Error("eTenders feed returned an invalid releases collection");
    }

    let next: string | null = null;

    if (typeof json.links?.next === "string" && json.links.next.trim()) {
      try {
        next = new URL(json.links.next, url).toString();
      } catch {
        throw new Error("eTenders feed returned an invalid next-page URL");
      }
    }

    return {
      releases: (json.releases ?? []) as OcdsRelease[],
      next,
    };
  };
}

export class IngestService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly fetcher: ReleaseFetcher = httpFetcher(),
    private readonly onMatches?: (matches: MatchAlert[]) => Promise<void>,
  ) {}

  async run(
    requestedMaxPages = Number(process.env.INGEST_MAX_PAGES ?? 5),
  ): Promise<{ runId: string }> {
    const config = makeIngestConfig();
    const maxPages = sanitizeMaxPages(requestedMaxPages);

    const existingRun = await this.prisma.ingestRun.findFirst({
      where: { status: "running" },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    if (existingRun) {
      throw new Error(`Tender ingestion is already running: ${existingRun.id}`);
    }

    const run = await this.prisma.ingestRun.create({
      data: { status: "running" },
    });

    let url: string | null = DEFAULT_FEED_URL;
    let processed = 0;
    let matched = 0;
    let releaseFailures = 0;
    const matchedTenders: MatchAlert[] = [];

    const releaseErrors: string[] = [];
    const visitedPages = new Set<string>();

    try {
      for (let pageNumber = 0; url && pageNumber < maxPages; pageNumber += 1) {
        if (visitedPages.has(url)) {
          throw new Error(`Pagination loop detected for ${url}`);
        }

        visitedPages.add(url);

        const page = await this.fetcher(url);

        for (const release of page.releases) {
          try {
            const parsed = parseRelease(release, config);

            if (isMatch(parsed, config)) {
              matched += 1;
              matchedTenders.push({
                ocid: parsed.ocid,
                title: parsed.title,
                buyer: parsed.buyer,
              });
            }

            const existing = await this.prisma.tender.findUnique({
              where: { ocid: parsed.ocid },
              select: {
                publishedAt: true,
                awardedAt: true,
                cancelledAt: true,
              },
            });

            const publishedAt = earlierDate(
              existing?.publishedAt,
              parsed.publishedAt,
            );

            /*
             * Award and cancellation dates represent lifecycle events.
             * Do not erase an already-observed event when a later partial
             * release omits it.
             */
            const awardedAt = parsed.awardedAt ?? existing?.awardedAt ?? null;

            const cancelledAt =
              parsed.cancelledAt ?? existing?.cancelledAt ?? null;

            await this.prisma.tender.upsert({
              where: { ocid: parsed.ocid },
              create: {
                ocid: parsed.ocid,
                source: "etenders",
                sourceReleaseId: parsed.sourceReleaseId,
                title: parsed.title,
                buyer: parsed.buyer,
                valueZar: parsed.valueZar,
                description: parsed.description,
                publishedAt,
                closingAt: parsed.closingAt,
                awardedAt,
                cancelledAt,
                compulsoryBriefing: parsed.compulsoryBriefing,
                sourceUpdatedAt: parsed.sourceUpdatedAt,
                lastIngestedAt: new Date(),
                raw: asJsonInput(release),
                documents: {
                  create: parsed.documents,
                },
              },
              update: {
                sourceReleaseId: parsed.sourceReleaseId,
                title: parsed.title,
                buyer: parsed.buyer,
                valueZar: parsed.valueZar,
                description: parsed.description,
                publishedAt,
                closingAt: parsed.closingAt,
                awardedAt,
                cancelledAt,
                compulsoryBriefing: parsed.compulsoryBriefing,
                sourceUpdatedAt: parsed.sourceUpdatedAt,
                lastIngestedAt: new Date(),
                raw: asJsonInput(release),
                documents: {
                  deleteMany: {},
                  create: parsed.documents,
                },
              },
            });

            processed += 1;
          } catch (error) {
            releaseFailures += 1;

            if (releaseErrors.length < 10) {
              const ocid = release?.ocid?.trim() || "unknown-ocid";

              releaseErrors.push(`${ocid}: ${errorMessage(error)}`);
            }
          }
        }

        url = page.next;
      }

      const partialFailureMessage =
        releaseFailures > 0
          ? [`${releaseFailures} release(s) failed.`, ...releaseErrors].join(
              " ",
            )
          : null;

      await this.prisma.ingestRun.update({
        where: { id: run.id },
        data: {
          status: "success",
          releasesProcessed: processed,
          matchedCount: matched,
          failedCount: releaseFailures,
          errorSummary: partialFailureMessage,
          finishedAt: new Date(),
        },
      });

      if (matchedTenders.length > 0 && this.onMatches) {
        await this.onMatches(matchedTenders);
      }

      return { runId: run.id };
    } catch (error) {
      const message = errorMessage(error);

      await this.prisma.ingestRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          releasesProcessed: processed,
          matchedCount: matched,
          failedCount: releaseFailures,
          errorSummary: message,
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async status(): Promise<IngestStatus> {
    const [lastCompleted, running] = await Promise.all([
      this.prisma.ingestRun.findFirst({
        where: {
          status: {
            in: ["success", "failed"],
          },
        },
        orderBy: { startedAt: "desc" },
      }),
      this.prisma.ingestRun.findFirst({
        where: { status: "running" },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      }),
    ]);

    let feedStatus: IngestStatus["feedStatus"] = "degraded";

    if (lastCompleted?.status === "failed") {
      feedStatus = "down";
    } else if (
      lastCompleted?.status === "success" &&
      lastCompleted.errorSummary
    ) {
      feedStatus = "degraded";
    } else if (lastCompleted?.status === "success") {
      feedStatus = "ok";
    }

    return {
      lastSyncAt: lastCompleted?.finishedAt?.toISOString() ?? null,
      releasesProcessedLastRun: lastCompleted?.releasesProcessed ?? 0,
      createdLastRun: lastCompleted?.createdCount ?? 0,
      updatedLastRun: lastCompleted?.updatedCount ?? 0,
      matchedLastRun: lastCompleted?.matchedCount ?? 0,
      skippedLastRun: lastCompleted?.skippedCount ?? 0,
      failedLastRun: lastCompleted?.failedCount ?? 0,
      sourcesTracked: 1,
      feedStatus,
      running: running !== null,
    };
  }
}
