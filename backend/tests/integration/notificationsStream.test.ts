import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { EventBus, userChannel } from "../../src/lib/eventBus.js";
import { notificationsStreamRouter } from "../../src/routes/notificationsStream.js";
import { AlertsService } from "../../src/services/alertsService.js";

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error("JWT_SECRET must be configured by vitest.setup.ts");
}

const createToken = (): string =>
  jwt.sign(
    {
      sub: "user-1",
      role: "owner",
      typ: "access",
    },
    SECRET,
    { expiresIn: "15m" },
  );

interface StoredNotification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  createdAt: Date;
}

function createFakePrisma() {
  const notifications: StoredNotification[] = [];

  return {
    __notifications: notifications,
    notification: {
      create: async ({
        data,
      }: {
        data: Omit<StoredNotification, "id" | "createdAt">;
      }): Promise<StoredNotification> => {
        const notification: StoredNotification = {
          id: `notification-${notifications.length + 1}`,
          createdAt: new Date(),
          ...data,
        };

        notifications.push(notification);
        return notification;
      },
    },
  };
}

describe("Realtime alerts", () => {
  let app: express.Express;
  let bus: EventBus;
  let prisma: ReturnType<typeof createFakePrisma>;

  beforeEach(() => {
    bus = new EventBus();
    prisma = createFakePrisma();
    app = express();

    app.use("/v1/notifications", notificationsStreamRouter(bus));
  });

  it("persists and publishes a matching tender notification", async () => {
    const received: unknown[] = [];

    const unsubscribe = bus.subscribe(userChannel("user-1"), (event) => {
      received.push(event);
    });

    const alertsService = new AlertsService(prisma as never, bus);

    await alertsService.notifyMatches(
      [{ id: "user-1" }],
      [
        {
          ocid: "ocds-x",
          title: "GIS audit",
          buyer: "CoGTA",
        },
      ],
    );

    unsubscribe();

    expect(prisma.__notifications).toHaveLength(1);
    expect(prisma.__notifications[0]).toMatchObject({
      userId: "user-1",
      kind: "match",
      title: "New matching tender: GIS audit",
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: "notification",
      payload: {
        kind: "match",
        matched: 1,
      },
    });
  });

  it("does nothing when no tenders match", async () => {
    const alertsService = new AlertsService(prisma as never, bus);

    await alertsService.notifyMatches([{ id: "user-1" }], []);

    expect(prisma.__notifications).toHaveLength(0);
  });

  it("does nothing when there are no active users", async () => {
    const alertsService = new AlertsService(prisma as never, bus);

    await alertsService.notifyMatches(
      [],
      [
        {
          ocid: "ocds-x",
          title: "GIS audit",
          buyer: "CoGTA",
        },
      ],
    );

    expect(prisma.__notifications).toHaveLength(0);
  });

  it("rejects a stream without a token", async () => {
    await request(app)
      .get("/v1/notifications/stream")
      .expect(401)
      .expect({ error: "Missing bearer token" });
  });

  it("rejects a stream with an invalid token", async () => {
    await request(app)
      .get("/v1/notifications/stream")
      .query({ access_token: "garbage" })
      .expect(401)
      .expect({ error: "Invalid or expired token" });
  });

  it("rejects a token signed with another secret", async () => {
    const invalidToken = jwt.sign(
      {
        sub: "user-1",
        role: "owner",
        typ: "access",
      },
      "another-stream-test-secret-32-bytes",
      { expiresIn: "15m" },
    );

    await request(app)
      .get("/v1/notifications/stream")
      .query({ access_token: invalidToken })
      .expect(401)
      .expect({ error: "Invalid or expired token" });
  });

  it("accepts an access token supplied in the authorization header", async () => {
    await new Promise<void>((resolve, reject) => {
      const stream = request(app)
        .get("/v1/notifications/stream")
        .set("Authorization", `Bearer ${createToken()}`)
        .buffer(false)
        .parse((response, callback) => {
          response.once("data", (chunk: Buffer) => {
            try {
              expect(chunk.toString()).toContain("event: ready");
              (response as typeof response & { destroy(): void }).destroy();
              callback(null, undefined);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });

      stream.end((error) => {
        if (
          error &&
          !error.message.includes("aborted") &&
          !error.message.includes("socket hang up")
        ) {
          reject(error);
        }
      });
    });
  });
});
