import type { PrismaClient } from "@prisma/client";
import { closingUrgency, dayKey, daysUntil } from "../lib/urgency.js";
import {
  STAGES,
  type CalendarEvent,
  type CardDto,
  type PipelineColumn,
  type Stage,
} from "../types/workspace.js";

interface WorkspaceCardRow {
  id: string;
  stage: string;
  ownerId: string | null;
  createdAt: Date;
  tender: {
    ocid: string;
    title: string;
    buyer: string;
    valueZar: { toString(): string } | null;
    closingAt: Date | null;
    compulsoryBriefing: boolean;
  };
}

export class WorkspaceAccessError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

function isStage(value: string): value is Stage {
  return STAGES.includes(value as Stage);
}

function toCardDto(row: WorkspaceCardRow, now: Date): CardDto {
  if (!isStage(row.stage)) {
    throw new Error(`Workspace card ${row.id} has invalid stage: ${row.stage}`);
  }

  return {
    id: row.id,
    ocid: row.tender.ocid,
    title: row.tender.title,
    buyer: row.tender.buyer,
    valueZar: row.tender.valueZar?.toString() ?? null,
    stage: row.stage,
    ownerId: row.ownerId,
    closingAt: row.tender.closingAt?.toISOString() ?? null,
    closingInDays: daysUntil(row.tender.closingAt, now),
    compulsoryBriefing: row.tender.compulsoryBriefing,
    createdAt: row.createdAt.toISOString(),
  };
}

export class WorkspaceService {
  constructor(private readonly prisma: PrismaClient) {}

  private async requireMembership(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.member.findFirst({
      where: {
        tenantId,
        userId,
      },
      select: {
        userId: true,
      },
    });

    if (!membership) {
      throw new WorkspaceAccessError(
        403,
        "You do not have access to this workspace",
      );
    }
  }

  async pipeline(
    tenantId: string,
    userId: string,
    now = new Date(),
  ): Promise<{ columns: PipelineColumn[] }> {
    await this.requireMembership(tenantId, userId);

    const rows = await this.prisma.workspaceCard.findMany({
      where: {
        tenantId,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: {
        tender: {
          select: {
            ocid: true,
            title: true,
            buyer: true,
            valueZar: true,
            closingAt: true,
            compulsoryBriefing: true,
          },
        },
      },
    });

    const cards = rows.map((row) => toCardDto(row, now));

    const columns = STAGES.map((stage) => {
      const stageCards = cards.filter((card) => card.stage === stage);

      return {
        stage,
        count: stageCards.length,
        cards: stageCards,
      };
    });

    return { columns };
  }

  async calendar(
    tenantId: string,
    userId: string,
    days = 90,
    now = new Date(),
  ): Promise<{ events: CalendarEvent[] }> {
    await this.requireMembership(tenantId, userId);

    const until = new Date(now.getTime() + days * 86_400_000);

    const rows = await this.prisma.workspaceCard.findMany({
      where: {
        tenantId,
        tender: {
          closingAt: {
            gt: now,
            lte: until,
          },
          awardedAt: null,
          cancelledAt: null,
        },
      },
      orderBy: [
        {
          tender: {
            closingAt: "asc",
          },
        },
        { id: "asc" },
      ],
      select: {
        tender: {
          select: {
            ocid: true,
            title: true,
            closingAt: true,
          },
        },
      },
    });

    const events: CalendarEvent[] = [];

    for (const row of rows) {
      const closingAt = row.tender.closingAt;

      if (!closingAt) {
        continue;
      }

      const urgency = closingUrgency(closingAt, now);

      if (!urgency) {
        continue;
      }

      events.push({
        day: dayKey(closingAt),
        label: row.tender.title,
        ocid: row.tender.ocid,
        urgency,
      });
    }

    return { events };
  }

  async moveCard(
    tenantId: string,
    userId: string,
    cardId: string,
    stage: Stage,
    ownerId?: string | null,
    now = new Date(),
  ): Promise<CardDto> {
    await this.requireMembership(tenantId, userId);

    const existing = await this.prisma.workspaceCard.findFirst({
      where: {
        id: cardId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new WorkspaceAccessError(404, "Workspace card was not found");
    }

    if (ownerId) {
      const ownerMembership = await this.prisma.member.findFirst({
        where: {
          tenantId,
          userId: ownerId,
        },
        select: {
          userId: true,
        },
      });

      if (!ownerMembership) {
        throw new WorkspaceAccessError(
          400,
          "The selected owner is not a workspace member",
        );
      }
    }

    const updated = await this.prisma.workspaceCard.update({
      where: {
        id: cardId,
      },
      data: {
        stage,
        ...(ownerId !== undefined ? { ownerId } : {}),
      },
      include: {
        tender: {
          select: {
            ocid: true,
            title: true,
            buyer: true,
            valueZar: true,
            closingAt: true,
            compulsoryBriefing: true,
          },
        },
      },
    });

    return toCardDto(updated, now);
  }
}
