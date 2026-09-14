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
  authErrorHandler,
} from "../../src/routes/auth.js";
import {
  walletErrorHandler,
  walletRouter,
} from "../../src/routes/wallet.js";
import {
  WalletService,
} from "../../src/services/walletService.js";

const { signingKey } = vi.hoisted(() => {
  const value = "x".repeat(64);

  Object.assign(process.env, {
    JWT_SECRET: value,
  });

  return {
    signingKey: value,
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
    signingKey,
    {
      expiresIn: "15m",
    },
  );
}

function createFakePrisma() {
  const memberships = [
    {
      id: "member-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "owner",
    },
    {
      id: "member-2",
      tenantId: "tenant-1",
      userId: "user-2",
      role: "viewer",
    },
    {
      id: "member-3",
      tenantId: "tenant-2",
      userId: "user-3",
      role: "owner",
    },
  ];

  const wallets: Array<Record<string, any>> = [];
  const transactions: Array<Record<string, any>> = [];

  let walletSequence = 0;
  let transactionSequence = 0;

  const walletClient = {
    upsert: async ({
      where,
      create,
    }: any) => {
      const existing = wallets.find(
        (wallet) =>
          wallet.tenantId === where.tenantId,
      );

      if (existing) {
        return existing;
      }

      const now = new Date();

      const wallet = {
        id: `wallet-${++walletSequence}`,
        tenantId: create.tenantId,
        balance: 0,
        lifetimePurchased: 0,
        lifetimeUsed: 0,
        createdAt: now,
        updatedAt: now,
      };

      wallets.push(wallet);
      return wallet;
    },

    findUnique: async ({
      where,
    }: any) => {
      if (where.id) {
        return (
          wallets.find(
            (wallet) => wallet.id === where.id,
          ) ?? null
        );
      }

      if (where.tenantId) {
        return (
          wallets.find(
            (wallet) =>
              wallet.tenantId === where.tenantId,
          ) ?? null
        );
      }

      return null;
    },

    update: async ({
      where,
      data,
    }: any) => {
      const wallet = wallets.find(
        (candidate) =>
          candidate.id === where.id,
      );

      if (!wallet) {
        throw new Error("Wallet not found.");
      }

      Object.assign(wallet, data, {
        updatedAt: new Date(),
      });

      return wallet;
    },
  };

  const transactionClient = {
    findUnique: async ({
      where,
    }: any) => {
      const key =
        where.tenantId_idempotencyKey;

      return (
        transactions.find(
          (transaction) =>
            transaction.tenantId ===
              key.tenantId &&
            transaction.idempotencyKey ===
              key.idempotencyKey,
        ) ?? null
      );
    },

    findMany: async ({
      where,
      take,
    }: any) =>
      transactions
        .filter(
          (transaction) =>
            transaction.tenantId ===
            where.tenantId,
        )
        .sort(
          (left, right) =>
            right.createdAt.getTime() -
            left.createdAt.getTime(),
        )
        .slice(0, take),

    create: async ({
      data,
    }: any) => {
      const transaction = {
        id:
          `transaction-${++transactionSequence}`,
        status: "completed",
        createdAt: new Date(),
        ...data,
      };

      transactions.push(transaction);
      return transaction;
    },
  };

  const client = {
    wallet: walletClient,
    walletTransaction: transactionClient,
  };

  return {
    __wallets: wallets,
    __transactions: transactions,

    member: {
      findUnique: async ({
        where,
      }: any) => {
        const key = where.tenantId_userId;

        return (
          memberships.find(
            (membership) =>
              membership.tenantId ===
                key.tenantId &&
              membership.userId === key.userId,
          ) ?? null
        );
      },
    },

    wallet: walletClient,
    walletTransaction: transactionClient,

    $transaction: async (
      operation: (transaction: any) =>
        Promise<any>,
    ) => operation(client),
  };
}

describe("Wallet API", () => {
  let app: express.Express;
  let prisma: ReturnType<
    typeof createFakePrisma
  >;

  beforeEach(() => {
    prisma = createFakePrisma();

    const service = new WalletService(
      prisma as never,
    );

    app = express();
    app.use(express.json());
    app.use("/v1", walletRouter(service));
    app.use(walletErrorHandler);
    app.use(authErrorHandler);
  });

  function authorization(
    userId: string,
    tenantId: string,
  ) {
    return {
      Authorization:
        `Bearer ${accessToken(userId)}`,
      "X-Tenant-Id": tenantId,
    };
  }

  it(
    "creates a zero-balance tenant wallet",
    async () => {
      const response = await request(app)
        .get("/v1/wallet")
        .set(
          authorization(
            "user-1",
            "tenant-1",
          ),
        )
        .expect(200);

      expect(response.body.data).toMatchObject({
        tenantId: "tenant-1",
        balance: 0,
        lifetimePurchased: 0,
        lifetimeUsed: 0,
      });

      expect(prisma.__wallets).toHaveLength(1);
    },
  );

  it(
    "records an idempotent EFT adjustment",
    async () => {
      const auth = authorization(
        "user-1",
        "tenant-1",
      );

      const first = await request(app)
        .post("/v1/wallet/adjustments")
        .set(auth)
        .set(
          "Idempotency-Key",
          "eft-payment-001",
        )
        .send({
          credits: 50000,
          description:
            "One-time licence - EFT cleared",
        })
        .expect(201);

      expect(first.body.data).toMatchObject({
        replayed: false,
        wallet: {
          balance: 50000,
          lifetimePurchased: 50000,
          lifetimeUsed: 0,
        },
        transaction: {
          type: "adjustment",
          credits: 50000,
          balanceAfter: 50000,
        },
      });

      const replay = await request(app)
        .post("/v1/wallet/adjustments")
        .set(auth)
        .set(
          "Idempotency-Key",
          "eft-payment-001",
        )
        .send({
          credits: 50000,
          description:
            "One-time licence - EFT cleared",
        })
        .expect(200);

      expect(replay.body.data.replayed).toBe(
        true,
      );

      expect(prisma.__transactions).toHaveLength(
        1,
      );

      expect(prisma.__wallets[0].balance).toBe(
        50000,
      );
    },
  );

  it(
    "returns tenant-scoped transaction history",
    async () => {
      await request(app)
        .post("/v1/wallet/adjustments")
        .set(
          authorization(
            "user-1",
            "tenant-1",
          ),
        )
        .set("Idempotency-Key", "tenant-1-eft")
        .send({
          credits: 100,
          description: "Tenant 1 payment",
        })
        .expect(201);

      await request(app)
        .post("/v1/wallet/adjustments")
        .set(
          authorization(
            "user-3",
            "tenant-2",
          ),
        )
        .set("Idempotency-Key", "tenant-2-eft")
        .send({
          credits: 200,
          description: "Tenant 2 payment",
        })
        .expect(201);

      const tenantOne = await request(app)
        .get("/v1/wallet/transactions")
        .set(
          authorization(
            "user-1",
            "tenant-1",
          ),
        )
        .expect(200);

      expect(tenantOne.body.data).toHaveLength(
        1,
      );

      expect(
        tenantOne.body.data[0].description,
      ).toBe("Tenant 1 payment");
    },
  );

  it(
    "rejects adjustments by non-administrators",
    async () => {
      await request(app)
        .post("/v1/wallet/adjustments")
        .set(
          authorization(
            "user-2",
            "tenant-1",
          ),
        )
        .set("Idempotency-Key", "viewer-change")
        .send({
          credits: 100,
          description: "Unauthorised credit",
        })
        .expect(403);

      expect(prisma.__transactions).toHaveLength(
        0,
      );
    },
  );

  it(
    "rejects insufficient credits",
    async () => {
      const response = await request(app)
        .post("/v1/wallet/adjustments")
        .set(
          authorization(
            "user-1",
            "tenant-1",
          ),
        )
        .set(
          "Idempotency-Key",
          "negative-adjustment",
        )
        .send({
          credits: -1,
          description: "Invalid deduction",
        })
        .expect(409);

      expect(response.body).toMatchObject({
        balance: 0,
        requested: 1,
      });

      expect(prisma.__transactions).toHaveLength(
        0,
      );
    },
  );

  it(
    "requires authentication, tenant and idempotency headers",
    async () => {
      await request(app)
        .get("/v1/wallet")
        .set("X-Tenant-Id", "tenant-1")
        .expect(401);

      await request(app)
        .get("/v1/wallet")
        .set(
          "Authorization",
          `Bearer ${accessToken("user-1")}`,
        )
        .expect(400);

      await request(app)
        .post("/v1/wallet/adjustments")
        .set(
          authorization(
            "user-1",
            "tenant-1",
          ),
        )
        .send({
          credits: 100,
          description: "Missing key",
        })
        .expect(400);
    },
  );

  it(
    "rejects invalid adjustments and membership",
    async () => {
      await request(app)
        .post("/v1/wallet/adjustments")
        .set(
          authorization(
            "user-1",
            "tenant-1",
          ),
        )
        .set("Idempotency-Key", "zero-credit")
        .send({
          credits: 0,
          description: "Invalid",
        })
        .expect(400);

      await request(app)
        .get("/v1/wallet")
        .set(
          authorization(
            "user-1",
            "tenant-2",
          ),
        )
        .expect(403);
    },
  );
});
