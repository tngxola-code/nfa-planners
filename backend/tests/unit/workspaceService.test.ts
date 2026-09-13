import { describe, expect, it } from "vitest";
import {
  WorkspaceAccessError,
  WorkspaceService,
} from "../../src/services/workspaceService.js";

const NOW = new Date("2026-09-13T12:00:00.000Z");

function createPrisma({ membership = true, ownerMembership = true } = {}) {
  const cards = [
    {
      id: "card-1",
      tenantId: "tenant-1",
      stage: "reviewing",
      ownerId: "user-1",
      createdAt: new Date("2026-09-10T08:00:00.000Z"),
      updatedAt: new Date("2026-09-12T08:00:00.000Z"),
      tender: {
        ocid: "ocds-1",
        title: "Spatial development framework",
        buyer: "City of Tshwane",
        valueZar: {
          toString: () => "2500000",
        },
        closingAt: new Date("2026-09-16T12:00:00.000Z"),
        awardedAt: null,
        cancelledAt: null,
        compulsoryBriefing: true,
      },
    },
  ];

  return {
    member: {
      findFirst: async ({ where }: { where: { userId: string } }) => {
        if (where.userId === "owner-2") {
          return ownerMembership ? { userId: where.userId } : null;
        }

        return membership ? { userId: where.userId } : null;
      },
    },
    workspaceCard: {
      findMany: async (args: { select?: unknown }) => {
        if (args.select) {
          return cards.map((card) => ({
            tender: {
              ocid: card.tender.ocid,
              title: card.tender.title,
              closingAt: card.tender.closingAt,
            },
          }));
        }

        return cards;
      },
      findFirst: async () => ({
        id: "card-1",
      }),
      update: async ({
        data,
      }: {
        data: {
          stage: string;
          ownerId?: string | null;
        };
      }) => ({
        ...cards[0],
        stage: data.stage,
        ownerId: data.ownerId === undefined ? cards[0].ownerId : data.ownerId,
      }),
    },
  };
}

describe("WorkspaceService", () => {
  it("returns every pipeline column, including empty columns", async () => {
    const service = new WorkspaceService(createPrisma() as never);

    const result = await service.pipeline("tenant-1", "user-1", NOW);

    expect(result.columns).toHaveLength(6);
    expect(
      result.columns.find((column) => column.stage === "reviewing")?.count,
    ).toBe(1);

    expect(
      result.columns.find((column) => column.stage === "submitted")?.count,
    ).toBe(0);
  });

  it("rejects users outside the tenant", async () => {
    const service = new WorkspaceService(
      createPrisma({ membership: false }) as never,
    );

    await expect(
      service.pipeline("tenant-1", "outsider", NOW),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("returns upcoming closing dates with urgency", async () => {
    const service = new WorkspaceService(createPrisma() as never);

    const result = await service.calendar("tenant-1", "user-1", 90, NOW);

    expect(result.events).toEqual([
      {
        day: "2026-09-16",
        label: "Spatial development framework",
        ocid: "ocds-1",
        urgency: "critical",
      },
    ]);
  });

  it("moves only a card in the selected tenant", async () => {
    const service = new WorkspaceService(createPrisma() as never);

    const result = await service.moveCard(
      "tenant-1",
      "user-1",
      "card-1",
      "in_progress",
      "owner-2",
      NOW,
    );

    expect(result).toMatchObject({
      id: "card-1",
      stage: "in_progress",
      ownerId: "owner-2",
    });
  });

  it("rejects an owner outside the tenant", async () => {
    const service = new WorkspaceService(
      createPrisma({
        ownerMembership: false,
      }) as never,
    );

    await expect(
      service.moveCard(
        "tenant-1",
        "user-1",
        "card-1",
        "in_progress",
        "owner-2",
        NOW,
      ),
    ).rejects.toBeInstanceOf(WorkspaceAccessError);
  });
});
