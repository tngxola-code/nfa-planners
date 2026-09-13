import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  TenderDetail,
  TenderStatus,
  TenderSummary,
} from "../types/tenders.js";

export type TenderSort = "newest" | "closing" | "value";

export interface TenderSearchQuery {
  q?: string;
  province?: string[];
  category?: string;
  status?: TenderStatus;
  published_within?: "24h" | "7d" | "30d" | "all";
  value_min?: number;
  value_max?: number;
  has_briefing?: boolean;
  compulsory_briefing_only?: boolean;
  closing_soon?: boolean;
  cursor?: string;
  limit?: number;
  sort?: TenderSort;
  now?: Date;
}

const NEW_WINDOW_MS = 48 * 60 * 60 * 1_000;

function isNewTender(publishedAt: Date | null, now: Date): boolean {
  if (!publishedAt) return false;

  const ageMs = now.getTime() - publishedAt.getTime();
  return ageMs >= 0 && ageMs <= NEW_WINDOW_MS;
}

/**
 * Builds query-time filters so statuses never become stale after deadlines.
 */
export function buildSearchWhere(
  query: TenderSearchQuery,
  now = new Date(),
): Prisma.TenderWhereInput {
  const conditions: Prisma.TenderWhereInput[] = [];

  const searchTerm = query.q?.trim();

  if (searchTerm) {
    conditions.push({
      OR: [
        {
          title: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          buyer: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          ocid: {
            equals: searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (query.province?.length) {
    conditions.push({
      province: {
        in: query.province,
        mode: "insensitive",
      },
    });
  }

  if (query.category) {
    conditions.push({
      category: {
        equals: query.category,
        mode: "insensitive",
      },
    });
  }

  if (query.value_min !== undefined || query.value_max !== undefined) {
    conditions.push({
      valueZar: {
        ...(query.value_min !== undefined ? { gte: query.value_min } : {}),
        ...(query.value_max !== undefined ? { lte: query.value_max } : {}),
      },
    });
  }

  switch (query.status) {
    case "open":
      conditions.push({
        awardedAt: null,
        cancelledAt: null,
        closingAt: { gt: now },
      });
      break;

    case "closed":
      conditions.push({
        awardedAt: null,
        cancelledAt: null,
        closingAt: { lte: now },
      });
      break;

    case "awarded":
      conditions.push({
        awardedAt: { not: null },
        cancelledAt: null,
      });
      break;

    case "cancelled":
      conditions.push({
        cancelledAt: { not: null },
      });
      break;

    case "unknown":
      conditions.push({
        closingAt: null,
        awardedAt: null,
        cancelledAt: null,
      });
      break;
  }

  if (query.published_within && query.published_within !== "all") {
    const hoursByWindow = {
      "24h": 24,
      "7d": 24 * 7,
      "30d": 24 * 30,
    } as const;

    const hours = hoursByWindow[query.published_within];

    conditions.push({
      publishedAt: {
        gte: new Date(now.getTime() - hours * 3_600_000),
        lte: now,
      },
    });
  }

  if (query.has_briefing !== undefined) {
    conditions.push({
      briefingAt: query.has_briefing ? { not: null } : null,
    });
  }

  if (query.compulsory_briefing_only) {
    conditions.push({
      compulsoryBriefing: true,
    });
  }

  if (query.closing_soon) {
    conditions.push({
      awardedAt: null,
      cancelledAt: null,
      closingAt: {
        gt: now,
        lte: new Date(now.getTime() + 7 * 24 * 3_600_000),
      },
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

function deriveStatus(
  tender: {
    closingAt: Date | null;
    awardedAt: Date | null;
    cancelledAt: Date | null;
  },
  now: Date,
): TenderStatus {
  if (tender.cancelledAt) return "cancelled";
  if (tender.awardedAt) return "awarded";

  if (!tender.closingAt) {
    return "unknown";
  }

  return tender.closingAt <= now ? "closed" : "open";
}

export function toSummary(
  tender: {
    id: string;
    source: string;
    ocid: string;
    title: string;
    buyer: string;
    province: string | null;
    category: string | null;
    valueZar: { toString(): string } | null;
    closingAt: Date | null;
    publishedAt: Date | null;
    awardedAt: Date | null;
    cancelledAt: Date | null;
    compulsoryBriefing: boolean;
    documents: { id: string }[];
  },
  now = new Date(),
): TenderSummary {
  return {
    id: tender.id,
    source: tender.source,
    ocid: tender.ocid,
    title: tender.title,
    buyer: tender.buyer,
    province: tender.province,
    category: tender.category,
    valueZar: tender.valueZar?.toString() ?? null,
    closingAt: tender.closingAt?.toISOString() ?? null,
    publishedAt: tender.publishedAt?.toISOString() ?? null,
    status: deriveStatus(tender, now),
    isNew: isNewTender(tender.publishedAt, now),
    compulsoryBriefing: tender.compulsoryBriefing,
    documentsCount: tender.documents.length,
  };
}

function getOrderBy(sort: TenderSort): Prisma.TenderOrderByWithRelationInput[] {
  switch (sort) {
    case "closing":
      return [
        {
          closingAt: {
            sort: "asc",
            nulls: "last",
          },
        },
        { id: "desc" },
      ];

    case "value":
      return [
        {
          valueZar: {
            sort: "desc",
            nulls: "last",
          },
        },
        { id: "desc" },
      ];

    case "newest":
    default:
      return [
        {
          publishedAt: {
            sort: "desc",
            nulls: "last",
          },
        },
        { id: "desc" },
      ];
  }
}

export class TendersService {
  constructor(private readonly prisma: PrismaClient) {}

  async search(query: TenderSearchQuery) {
    const now = query.now ?? new Date();
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const rows = await this.prisma.tender.findMany({
      where: buildSearchWhere(query, now),
      orderBy: getOrderBy(query.sort ?? "newest"),
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      include: {
        documents: {
          select: { id: true },
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: page.map((tender) => toSummary(tender, now)),
      nextCursor: hasMore && page.length ? page[page.length - 1].id : null,
    };
  }

  async detail(ocid: string, now = new Date()): Promise<TenderDetail | null> {
    const tender = await this.prisma.tender.findUnique({
      where: { ocid },
      include: {
        documents: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!tender) return null;

    const timeline: TenderDetail["timeline"] = [];

    if (tender.publishedAt) {
      timeline.push({
        title: "Tender published",
        date: tender.publishedAt.toISOString(),
        kind: "done",
      });
    }

    if (tender.briefingAt) {
      timeline.push({
        title: tender.compulsoryBriefing ? "Compulsory briefing" : "Briefing",
        date: tender.briefingAt.toISOString(),
        kind: tender.briefingAt <= now ? "done" : "due",
      });
    }

    if (tender.closingAt) {
      timeline.push({
        title: "Submissions close",
        date: tender.closingAt.toISOString(),
        kind: tender.closingAt <= now ? "done" : "due",
      });
    }

    if (tender.cancelledAt) {
      timeline.push({
        title: "Tender cancelled",
        date: tender.cancelledAt.toISOString(),
        kind: "done",
      });
    } else if (tender.awardedAt) {
      timeline.push({
        title: "Tender awarded",
        date: tender.awardedAt.toISOString(),
        kind: "done",
      });
    }

    return {
      ...toSummary(tender, now),
      description: tender.description,
      briefing: tender.briefingAt
        ? {
            at: tender.briefingAt.toISOString(),
            venue: tender.briefingVenue,
          }
        : null,
      keyDates: {
        published: tender.publishedAt?.toISOString() ?? null,
        briefing: tender.briefingAt?.toISOString() ?? null,
        closing: tender.closingAt?.toISOString() ?? null,
        awarded: tender.awardedAt?.toISOString() ?? null,
      },
      timeline,
      documents: tender.documents.map((document) => ({
        id: document.id,
        name: document.name,
        docType: document.docType,
        url: document.url,
        sizeBytes: document.sizeBytes,
        publishedAt: document.publishedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Saves a tender to a tenant workspace.
   * Idempotency is scoped to tenant + tender.
   */
  async save(tenantId: string, ocid: string, ownerId: string, stage = "new") {
    const membership = await this.prisma.member.findFirst({
      where: {
        userId: ownerId,
        tenantId,
      },
      select: { userId: true },
    });

    if (!membership) return null;

    const tender = await this.prisma.tender.findUnique({
      where: { ocid },
      select: { id: true },
    });

    if (!tender) return null;

    return this.prisma.workspaceCard.upsert({
      where: {
        tenantId_tenderId: {
          tenantId,
          tenderId: tender.id,
        },
      },
      create: {
        tenantId,
        tenderId: tender.id,
        stage,
        ownerId,
      },
      update: {
        ownerId,
        stage,
      },
    });
  }
}
