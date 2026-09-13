import type { PrismaClient } from "@prisma/client";
import express from "express";
import request from "supertest";
import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { StoragePresigner } from "../../src/lib/storage.js";
import { signAccessToken } from "../../src/lib/tokens.js";
import {
  authErrorHandler,
} from "../../src/routes/auth.js";
import {
  complianceErrorHandler,
  complianceRouter,
} from "../../src/routes/compliance.js";
import { ComplianceService } from "../../src/services/complianceService.js";

interface RequirementRow {
  id: string;
  cardId: string;
  name: string;
  detail: string | null;
  status: string;
  ownerId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskRow {
  id: string;
  cardId: string;
  title: string;
  done: boolean;
  ownerId: string | null;
  due: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface VaultRow {
  id: string;
  tenantId: string;
  category: string;
  name: string;
  ext: string | null;
  contentType: string | null;
  status: string;
  expiresAt: Date | null;
  version: string;
  sizeBytes: number | null;
  storageKey: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function createFakePrisma() {
  const requirements: RequirementRow[] = [];
  const tasks: TaskRow[] = [];
  const vaultDocuments: VaultRow[] = [
    {
      id: "foreign-document",
      tenantId: "tenant-2",
      category: "tax",
      name: "Foreign tenant tax document",
      ext: "pdf",
      contentType: "application/pdf",
      status: "valid",
      expiresAt: null,
      version: "v1",
      sizeBytes: 100,
      storageKey: "vault/tenant-2/foreign.pdf",
      uploadedBy: "user-1",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  ];
  const packs: Array<Record<string, unknown>> = [];

  let requirementSequence = 0;
  let taskSequence = 0;
  let documentSequence = 0;
  let packSequence = 0;

  const memberships = new Set([
    "tenant-1:user-1",
    "tenant-2:user-1",
  ]);

  const cards = [
    {
      id: "card-1",
      tenantId: "tenant-1",
      tenderId: "tender-1",
      stage: "qualifying",
      ownerId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tender: {
        title: "Bulk water meters",
      },
    },
  ];

  const prisma = {
    __requirements: requirements,
    __tasks: tasks,
    __vaultDocuments: vaultDocuments,
    __packs: packs,

    member: {
      findUnique: async ({
        where,
      }: {
        where: {
          tenantId_userId: {
            tenantId: string;
            userId: string;
          };
        };
      }) => {
        const { tenantId, userId } =
          where.tenantId_userId;

        return memberships.has(`${tenantId}:${userId}`)
          ? { id: `${tenantId}-${userId}` }
          : null;
      },
    },

    workspaceCard: {
      findFirst: async ({
        where,
      }: {
        where: {
          id: string;
          tenantId: string;
        };
      }) =>
        cards.find(
          (card) =>
            card.id === where.id &&
            card.tenantId === where.tenantId,
        ) ?? null,
    },

    requirement: {
      findMany: async ({
        where,
      }: {
        where: {
          cardId: string;
        };
      }) =>
        requirements.filter(
          (row) => row.cardId === where.cardId,
        ),

      count: async ({
        where,
      }: {
        where: {
          cardId: string;
        };
      }) =>
        requirements.filter(
          (row) => row.cardId === where.cardId,
        ).length,

      createMany: async ({
        data,
      }: {
        data: Array<{
          cardId: string;
          name: string;
          detail: string;
          sortOrder: number;
        }>;
      }) => {
        const now = new Date();

        for (const item of data) {
          const duplicate = requirements.some(
            (row) =>
              row.cardId === item.cardId &&
              row.name === item.name,
          );

          if (!duplicate) {
            requirements.push({
              id: `requirement-${++requirementSequence}`,
              ...item,
              status: "missing",
              ownerId: null,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        return {
          count: data.length,
        };
      },

      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          cardId: string;
        };
        data: {
          status?: string;
          ownerId?: string | null;
        };
      }) => {
        const row = requirements.find(
          (item) =>
            item.id === where.id &&
            item.cardId === where.cardId,
        );

        if (!row) {
          return {
            count: 0,
          };
        }

        Object.assign(row, data, {
          updatedAt: new Date(),
        });

        return {
          count: 1,
        };
      },
    },

    bidTask: {
      findMany: async ({
        where,
      }: {
        where: {
          cardId: string;
        };
      }) =>
        tasks.filter(
          (row) => row.cardId === where.cardId,
        ),

      create: async ({
        data,
      }: {
        data: {
          cardId: string;
          title: string;
          ownerId: string | null;
          due: Date | null;
        };
      }) => {
        const now = new Date();
        const row: TaskRow = {
          id: `task-${++taskSequence}`,
          ...data,
          done: false,
          createdAt: now,
          updatedAt: now,
        };

        tasks.push(row);
        return row;
      },

      findFirst: async ({
        where,
      }: {
        where: {
          id: string;
          cardId: string;
        };
      }) =>
        tasks.find(
          (row) =>
            row.id === where.id &&
            row.cardId === where.cardId,
        ) ?? null,

      update: async ({
        where,
        data,
      }: {
        where: {
          id: string;
        };
        data: {
          done: boolean;
        };
      }) => {
        const row = tasks.find(
          (item) => item.id === where.id,
        );

        if (!row) {
          throw new Error("Task not found.");
        }

        Object.assign(row, data, {
          updatedAt: new Date(),
        });

        return row;
      },
    },

    vaultDocument: {
      findMany: async ({
        where,
      }: {
        where?: {
          tenantId?: string;
          expiresAt?: {
            gte: Date;
            lte: Date;
          };
        };
      }) =>
        vaultDocuments.filter((document) => {
          if (
            where?.tenantId &&
            document.tenantId !== where.tenantId
          ) {
            return false;
          }

          if (where?.expiresAt) {
            return Boolean(
              document.expiresAt &&
                document.expiresAt >=
                  where.expiresAt.gte &&
                document.expiresAt <=
                  where.expiresAt.lte,
            );
          }

          return true;
        }),

      create: async ({
        data,
      }: {
        data: Omit<
          VaultRow,
          "id" | "status" | "version" | "createdAt" | "updatedAt"
        >;
      }) => {
        const now = new Date();
        const document: VaultRow = {
          id: `document-${++documentSequence}`,
          ...data,
          status: "valid",
          version: "v1",
          createdAt: now,
          updatedAt: now,
        };

        vaultDocuments.push(document);
        return document;
      },
    },

    submissionPack: {
      create: async ({
        data,
      }: {
        data: Record<string, unknown>;
      }) => {
        const pack = {
          id: `pack-${++packSequence}`,
          ...data,
          createdAt: new Date(),
        };

        packs.push(pack);
        return pack;
      },
    },
  };

  return prisma;
}

describe("Compliance and vault API", () => {
  let app: express.Express;
  let prisma: ReturnType<typeof createFakePrisma>;

  const authorization = {
    Authorization: `Bearer ${signAccessToken(
      "user-1",
      "owner",
    )}`,
    "X-Tenant-Id": "tenant-1",
  };

  beforeEach(() => {
    prisma = createFakePrisma();

    const presigner: StoragePresigner = {
      async presignUpload(input) {
        return {
          uploadUrl:
            `https://storage.test/${input.storageKey}`,
          method: "PUT",
          headers: {
            "content-type": input.contentType,
          },
        };
      },
    };

    app = express();
    app.use(express.json());
    app.use(
      "/v1",
      complianceRouter(
        new ComplianceService(
          prisma as unknown as PrismaClient,
          presigner,
        ),
      ),
    );
    app.use(complianceErrorHandler);
    app.use(authErrorHandler);
  });

  it("seeds, updates, and reports requirement readiness", async () => {
    const initial = await request(app)
      .get("/v1/bids/card-1/requirements")
      .set(authorization)
      .expect(200);

    expect(initial.body.requirements).toHaveLength(7);
    expect(initial.body.readiness).toEqual({
      met: 0,
      total: 7,
      pct: 0,
      label: "Needs work",
    });

    const requirementId =
      initial.body.requirements[0].id as string;

    const updated = await request(app)
      .put(
        `/v1/bids/card-1/requirements/${requirementId}`,
      )
      .set(authorization)
      .send({
        status: "complete",
      })
      .expect(200);

    expect(updated.body.readiness.met).toBe(1);
  });

  it("creates and toggles a bid task", async () => {
    const created = await request(app)
      .post("/v1/bids/card-1/tasks")
      .set(authorization)
      .send({
        title: "Attach SARS PIN",
        due: "2026-09-30T12:00:00.000Z",
      })
      .expect(201);

    expect(created.body.data[0].done).toBe(false);

    const taskId = created.body.data[0].id as string;

    const toggled = await request(app)
      .post(`/v1/bids/card-1/tasks/${taskId}/toggle`)
      .set(authorization)
      .expect(200);

    expect(toggled.body.data[0].done).toBe(true);
  });

  it("keeps vault documents isolated by tenant", async () => {
    const uploaded = await request(app)
      .post("/v1/vault/documents")
      .set(authorization)
      .send({
        name: "bbbee.pdf",
        content_type: "application/pdf",
        category: "transformation",
        size_bytes: 2048,
      })
      .expect(201);

    expect(uploaded.body.storageKey).toMatch(
      /^vault\/tenant-1\//,
    );
    expect(uploaded.body.uploadUrl).toContain(
      "https://storage.test/vault/tenant-1/",
    );

    const listed = await request(app)
      .get("/v1/vault/documents")
      .set(authorization)
      .expect(200);

    const names = listed.body.data.flatMap(
      (group: { documents: Array<{ name: string }> }) =>
        group.documents.map((document) => document.name),
    );

    expect(names).toContain("bbbee.pdf");
    expect(names).not.toContain(
      "Foreign tenant tax document",
    );
  });

  it("excludes another tenant's documents from a pack", async () => {
    const response = await request(app)
      .post("/v1/bids/card-1/submission-pack")
      .set(authorization)
      .expect(201);

    expect(response.body.status).toBe("draft");

    const names = response.body.manifest.items.map(
      (item: { name: string }) => item.name,
    );

    expect(names).not.toContain(
      "Foreign tenant tax document",
    );

    expect(prisma.__packs).toHaveLength(1);
  });

  it("rejects cross-tenant card access", async () => {
    await request(app)
      .get("/v1/bids/card-1/requirements")
      .set({
        ...authorization,
        "X-Tenant-Id": "tenant-2",
      })
      .expect(404);
  });

  it("rejects invalid dates and missing tenant context", async () => {
    await request(app)
      .post("/v1/bids/card-1/tasks")
      .set(authorization)
      .send({
        title: "Invalid task",
        due: "not-a-date",
      })
      .expect(400);

    await request(app)
      .get("/v1/bids/card-1/requirements")
      .set("Authorization", authorization.Authorization)
      .expect(400);
  });

  it("rejects unauthenticated requests", async () => {
    await request(app)
      .get("/v1/vault/documents")
      .set("X-Tenant-Id", "tenant-1")
      .expect(401);
  });
});
