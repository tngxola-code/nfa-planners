import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  aiReviewErrorHandler,
  aiReviewRouter,
} from "../../src/routes/aiReview.js";
import {
  AiReviewService,
} from "../../src/services/aiReviewService.js";
import {
  authErrorHandler,
} from "../../src/routes/auth.js";

const { secret } = vi.hoisted(() => {
  const value =
    "x".repeat(64);

  Object.assign(process.env, {
    JWT_SECRET: value,
  });

  return {
    secret: value,
  };
});

function accessToken(
  userId: string,
  role = "owner",
): string {
  return jwt.sign(
    {
      sub: userId,
      role,
      typ: "access",
    },
    secret,
    {
      expiresIn: "15m",
    },
  );
}

function createFakePrisma() {
  const jobs: Array<Record<string, unknown>> = [];
  let sequence = 0;

  const members = [
    {
      id: "member-1",
      tenantId: "tenant-1",
      userId: "user-1",
    },
    {
      id: "member-2",
      tenantId: "tenant-2",
      userId: "user-2",
    },
  ];

  const cards = [
    {
      id: "card-1",
      tenantId: "tenant-1",
      tender: {
        title: "Bulk water meters",
      },
    },
    {
      id: "card-2",
      tenantId: "tenant-2",
      tender: {
        title: "Road maintenance",
      },
    },
  ];

  const requirements = [
    {
      cardId: "card-1",
      name: "Tax Clearance Certificate",
      status: "missing",
      sortOrder: 1,
    },
    {
      cardId: "card-1",
      name: "B-BBEE Certificate",
      status: "complete",
      sortOrder: 2,
    },
  ];

  const vaultDocuments = [
    {
      id: "document-1",
      tenantId: "tenant-1",
      name: "Company registration",
      status: "valid",
      expiresAt: null,
    },
    {
      id: "document-2",
      tenantId: "tenant-2",
      name: "Tenant 2 confidential document",
      status: "valid",
      expiresAt: null,
    },
  ];

  function jobMatches(
    job: Record<string, unknown>,
    where: Record<string, unknown>,
  ): boolean {
    return Object.entries(where).every(
      ([key, value]) => job[key] === value,
    );
  }

  return {
    __jobs: jobs,

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
      }) =>
        members.find(
          (member) =>
            member.tenantId ===
              where.tenantId_userId.tenantId &&
            member.userId ===
              where.tenantId_userId.userId,
        ) ?? null,
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
        requirements
          .filter(
            (requirement) =>
              requirement.cardId === where.cardId,
          )
          .sort(
            (left, right) =>
              left.sortOrder - right.sortOrder,
          )
          .map((requirement) => ({
            name: requirement.name,
            status: requirement.status,
          })),
    },

    vaultDocument: {
      findMany: async ({
        where,
      }: {
        where: {
          tenantId: string;
          id?: {
            in: string[];
          };
        };
      }) =>
        vaultDocuments
          .filter(
            (document) =>
              document.tenantId === where.tenantId &&
              (!where.id ||
                where.id.in.includes(document.id)),
          )
          .map((document) => ({
            id: document.id,
            name: document.name,
            status: document.status,
            expiresAt: document.expiresAt,
          })),
    },

    aiReviewJob: {
      create: async ({
        data,
      }: {
        data: Record<string, unknown>;
      }) => {
        const now = new Date();

        const job = {
          id: `job-${++sequence}`,
          score: null,
          findings: null,
          missingDocuments: null,
          error: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };

        jobs.push(job);

        return {
          id: job.id,
        };
      },

      findUnique: async ({
        where,
      }: {
        where: {
          id: string;
        };
      }) =>
        jobs.find(
          (job) => job.id === where.id,
        ) ?? null,

      findFirst: async ({
        where,
      }: {
        where: Record<string, unknown>;
      }) =>
        jobs.find((job) =>
          jobMatches(job, where),
        ) ?? null,

      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const matchingJobs = jobs.filter((job) =>
          jobMatches(job, where),
        );

        for (const job of matchingJobs) {
          Object.assign(job, data, {
            updatedAt: new Date(),
          });
        }

        return {
          count: matchingJobs.length,
        };
      },
    },
  };
}

describe("AI review API", () => {
  let app: express.Express;
  let prisma: ReturnType<
    typeof createFakePrisma
  >;
  let service: AiReviewService;

  beforeEach(() => {
    prisma = createFakePrisma();

    service = new AiReviewService(
      prisma as never,
      undefined,
      {
        autoProcess: false,
        stepDelayMs: 1,
      },
    );

    app = express();
    app.use(express.json());
    app.use("/v1", aiReviewRouter(service));
    app.use(aiReviewErrorHandler);
    app.use(authErrorHandler);
  });

  function authorization(userId: string) {
    return {
      Authorization:
        `Bearer ${accessToken(userId)}`,
      "X-Tenant-Id":
        userId === "user-2"
          ? "tenant-2"
          : "tenant-1",
    };
  }

  async function completeJob(
    jobId: string,
  ): Promise<void> {
    for (let step = 0; step <= 5; step += 1) {
      await service.processNow(jobId);
    }
  }

  it(
    "starts and completes a tenant-scoped review",
    async () => {
      const started = await request(app)
        .post("/v1/bids/card-1/ai-review")
        .set(authorization("user-1"))
        .send({
          review_type: "full",
          document_ids: ["document-1"],
        })
        .expect(202);

      expect(started.body).toMatchObject({
        status: "processing",
      });

      const jobId = started.body.jobId as string;

      await request(app)
        .get(`/v1/ai-review/${jobId}/findings`)
        .set(authorization("user-1"))
        .expect(409);

      await completeJob(jobId);

      const completed = await request(app)
        .get(`/v1/ai-review/${jobId}`)
        .set(authorization("user-1"))
        .expect(200);

      expect(completed.body).toMatchObject({
        jobId,
        cardId: "card-1",
        reviewType: "full",
        status: "complete",
        currentStep: 5,
        score: 85,
        error: null,
      });

      const findings = await request(app)
        .get(`/v1/ai-review/${jobId}/findings`)
        .set(authorization("user-1"))
        .expect(200);

      expect(
        findings.body.missingDocuments,
      ).toContain(
        "Tax Clearance Certificate",
      );

      expect(
        findings.body.findings[0],
      ).toMatchObject({
        severity: "Critical",
        title:
          "Tax Clearance Certificate not attached",
      });

      const report = await request(app)
        .get(`/v1/ai-review/${jobId}/report`)
        .set(authorization("user-1"))
        .expect(200);

      expect(
        report.headers["content-disposition"],
      ).toContain("attachment");

      expect(report.text).toContain(
        "Score: 85/100",
      );
    },
  );

  it(
    "rejects another tenant's card and document",
    async () => {
      await request(app)
        .post("/v1/bids/card-2/ai-review")
        .set(authorization("user-1"))
        .send({
          review_type: "basic",
        })
        .expect(404);

      await request(app)
        .post("/v1/bids/card-1/ai-review")
        .set(authorization("user-1"))
        .send({
          review_type: "full",
          document_ids: ["document-2"],
        })
        .expect(400);
    },
  );

  it(
    "does not expose a job to another tenant",
    async () => {
      const started = await request(app)
        .post("/v1/bids/card-1/ai-review")
        .set(authorization("user-1"))
        .send({
          review_type: "basic",
        })
        .expect(202);

      await request(app)
        .get(
          `/v1/ai-review/${started.body.jobId}`,
        )
        .set(authorization("user-2"))
        .expect(404);
    },
  );

  it(
    "requires authentication and tenant context",
    async () => {
      await request(app)
        .post("/v1/bids/card-1/ai-review")
        .set("X-Tenant-Id", "tenant-1")
        .send({
          review_type: "basic",
        })
        .expect(401);

      await request(app)
        .post("/v1/bids/card-1/ai-review")
        .set(
          "Authorization",
          `Bearer ${accessToken("user-1")}`,
        )
        .send({
          review_type: "basic",
        })
        .expect(400);
    },
  );

  it(
    "rejects duplicate document IDs",
    async () => {
      await request(app)
        .post("/v1/bids/card-1/ai-review")
        .set(authorization("user-1"))
        .send({
          review_type: "full",
          document_ids: [
            "document-1",
            "document-1",
          ],
        })
        .expect(400);
    },
  );
});
