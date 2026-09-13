import { beforeEach, describe, expect, it } from "vitest";
import type { OcdsRelease } from "../../src/lib/ocds.js";
import {
  IngestService,
  type ReleaseFetcher,
} from "../../src/services/ingestService.js";
import { TendersService } from "../../src/services/tendersService.js";

function createFakePrisma() {
  const tenders: Array<Record<string, any>> = [];
  const runs: Array<Record<string, any>> = [];
  const members = [
    {
      userId: "user-1",
      tenantId: "tenant-1",
    },
  ];
  const cards: Array<Record<string, any>> = [];

  let sequence = 0;

  const prisma = {
    tender: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; ocid?: string };
      }) =>
        tenders.find(
          (tender) => tender.id === where.id || tender.ocid === where.ocid,
        ) ?? null,

      findMany: async ({
        take,
        cursor,
        skip,
      }: {
        take?: number;
        cursor?: { id: string };
        skip?: number;
      }) => {
        const sorted = [...tenders].sort((left, right) => {
          const leftDate = left.publishedAt?.getTime?.() ?? 0;
          const rightDate = right.publishedAt?.getTime?.() ?? 0;

          if (leftDate !== rightDate) {
            return rightDate - leftDate;
          }

          return String(right.id).localeCompare(String(left.id));
        });

        let start = 0;

        if (cursor) {
          const anchor = sorted.findIndex((tender) => tender.id === cursor.id);

          start = anchor < 0 ? sorted.length : anchor;
          start += skip ?? 0;
        }

        return sorted.slice(start, start + (take ?? 20));
      },

      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { ocid: string };
        create: Record<string, any>;
        update: Record<string, any>;
      }) => {
        const existing = tenders.find((tender) => tender.ocid === where.ocid);

        if (existing) {
          const updateDocuments = update.documents;

          Object.assign(existing, {
            ...update,
            documents: existing.documents,
          });

          if (updateDocuments?.create) {
            existing.documents = updateDocuments.create.map(
              (document: Record<string, any>, index: number) => ({
                id: `document-${++sequence}-${index}`,
                tenderId: existing.id,
                sizeBytes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                ...document,
              }),
            );
          }

          return existing;
        }

        const id = `tender-${++sequence}`;

        const created = {
          id,
          province: null,
          category: null,
          briefingAt: null,
          briefingVenue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
          documents: (create.documents?.create ?? []).map(
            (document: Record<string, any>, index: number) => ({
              id: `document-${++sequence}-${index}`,
              tenderId: id,
              sizeBytes: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...document,
            }),
          ),
        };

        tenders.push(created);
        return created;
      },
    },

    ingestRun: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const run = {
          id: `run-${++sequence}`,
          source: "etenders",
          cursor: null,
          releasesProcessed: 0,
          createdCount: 0,
          updatedCount: 0,
          matchedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          errorSummary: null,
          startedAt: new Date(),
          finishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };

        runs.push(run);
        return run;
      },

      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, any>;
      }) => {
        const run = runs.find((candidate) => candidate.id === where.id);

        if (!run) {
          throw new Error("Fake ingest run not found");
        }

        Object.assign(run, data, {
          updatedAt: new Date(),
        });

        return run;
      },

      findFirst: async ({
        where,
      }: {
        where?: {
          status?:
            | string
            | {
                in?: string[];
              };
        };
      }) => {
        const candidates = [...runs].reverse();
        const status = where?.status;

        if (typeof status === "string") {
          return candidates.find((run) => run.status === status) ?? null;
        }

        if (status?.in) {
          return (
            candidates.find((run) => status.in?.includes(run.status)) ?? null
          );
        }

        return candidates[0] ?? null;
      },
    },

    member: {
      findFirst: async ({
        where,
      }: {
        where: {
          userId: string;
          tenantId: string;
        };
      }) =>
        members.find(
          (member) =>
            member.userId === where.userId &&
            member.tenantId === where.tenantId,
        ) ?? null,
    },

    workspaceCard: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: {
          tenantId_tenderId: {
            tenantId: string;
            tenderId: string;
          };
        };
        create: Record<string, any>;
        update: Record<string, any>;
      }) => {
        const key = where.tenantId_tenderId;

        const existing = cards.find(
          (card) =>
            card.tenantId === key.tenantId && card.tenderId === key.tenderId,
        );

        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        const card = {
          id: `card-${++sequence}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };

        cards.push(card);
        return card;
      },
    },
  };

  return {
    prisma: prisma as any,
    tenders,
    runs,
    cards,
  };
}

const SAMPLE_RELEASE: OcdsRelease = {
  ocid: "ocds-9d2tz1-TSH-0042",
  id: "release-1",
  date: "2026-09-12T08:00:00Z",
  tender: {
    title: "Precinct Spatial Development Framework",
    description: "GIS and spatial planning services",
    status: "active",
    value: {
      amount: 2_100_000,
      currency: "ZAR",
    },
    tenderPeriod: {
      startDate: "2026-09-12T08:00:00Z",
      endDate: "2026-09-18T16:00:00Z",
    },
    documents: [
      {
        id: "notice-1",
        title: "Tender notice",
        documentType: "notice",
        url: "https://example.test/tender-notice.pdf",
      },
    ],
  },
  buyer: {
    id: "buyer-1",
  },
  parties: [
    {
      id: "buyer-1",
      name: "City of Tshwane",
      roles: ["buyer"],
    },
  ],
};

describe("Tender ingestion integration", () => {
  beforeEach(() => {
    process.env.INGEST_MATCH_KEYWORDS = "spatial planning,gis";
    process.env.INGEST_NEW_WINDOW_HOURS = "48";
  });

  it("ingests an OCDS release and exposes it through search", async () => {
    const fake = createFakePrisma();

    const fetcher: ReleaseFetcher = async () => ({
      releases: [SAMPLE_RELEASE],
      next: null,
    });

    const ingest = new IngestService(fake.prisma, fetcher);

    const tenders = new TendersService(fake.prisma);

    const result = await ingest.run(1);
    expect(result.runId).toMatch(/^run-/);

    const page = await tenders.search({
      now: new Date("2026-09-13T10:00:00Z"),
    });

    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toMatchObject({
      source: "etenders",
      ocid: SAMPLE_RELEASE.ocid,
      title: "Precinct Spatial Development Framework",
      buyer: "City of Tshwane",
      valueZar: "2100000",
      status: "open",
      compulsoryBriefing: false,
      documentsCount: 1,
    });

    const status = await ingest.status();

    expect(status).toMatchObject({
      releasesProcessedLastRun: 1,
      matchedLastRun: 1,
      failedLastRun: 0,
      feedStatus: "ok",
      running: false,
    });
  });

  it("refreshes an existing tender without duplicating it", async () => {
    const fake = createFakePrisma();

    let call = 0;

    const fetcher: ReleaseFetcher = async () => {
      call += 1;

      return {
        releases: [
          call === 1
            ? SAMPLE_RELEASE
            : {
                ...SAMPLE_RELEASE,
                id: "release-2",
                date: "2026-09-14T08:00:00Z",
                tender: {
                  ...SAMPLE_RELEASE.tender,
                  title: "Updated Precinct Spatial Development Framework",
                },
              },
        ],
        next: null,
      };
    };

    const ingest = new IngestService(fake.prisma, fetcher);

    await ingest.run(1);
    await ingest.run(1);

    expect(fake.tenders).toHaveLength(1);
    expect(fake.tenders[0].title).toBe(
      "Updated Precinct Spatial Development Framework",
    );

    expect(fake.tenders[0].publishedAt.toISOString()).toBe(
      "2026-09-12T08:00:00.000Z",
    );
  });

  it("saves a tender only for a valid tenant member", async () => {
    const fake = createFakePrisma();

    const fetcher: ReleaseFetcher = async () => ({
      releases: [SAMPLE_RELEASE],
      next: null,
    });

    const ingest = new IngestService(fake.prisma, fetcher);

    const tenders = new TendersService(fake.prisma);

    await ingest.run(1);

    const card = await tenders.save(
      "tenant-1",
      SAMPLE_RELEASE.ocid,
      "user-1",
      "new",
    );

    expect(card).toMatchObject({
      tenantId: "tenant-1",
      ownerId: "user-1",
      stage: "new",
    });

    const forbidden = await tenders.save(
      "another-tenant",
      SAMPLE_RELEASE.ocid,
      "user-1",
      "new",
    );

    expect(forbidden).toBeNull();
    expect(fake.cards).toHaveLength(1);
  });
});
