import express, { type Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { createMemoryStore, type Store } from "./store.js";
import { AuthService } from "./services/authService.js";
import { UsersService } from "./services/usersService.js";
import { TendersService } from "./services/tendersService.js";
import { IngestService } from "./services/ingestService.js";
import { NotificationsService } from "./services/notificationsService.js";
import { authRouter, authErrorHandler } from "./routes/auth.js";
import { usersRouter, invitesRouter } from "./routes/users.js";
import { tendersRouter } from "./routes/tenders.js";
import { ingestRouter } from "./routes/ingest.js";
import { notificationsStreamRouter } from "./routes/notificationsStream.js";
import { AlertsService } from "./services/alertsService.js";
import { EventBus } from "./lib/eventBus.js";
import { notificationsRouter } from "./routes/notifications.js";

export interface AppOptions {
  store?: Store;
  prisma?: PrismaClient;
}

export async function createApp(options: AppOptions = {}): Promise<Express> {
  const app = express();
  const eventBus = new EventBus();

  app.locals.eventBus = eventBus;

  app.use(express.json());

  const store = options.store ?? createMemoryStore();

  await AuthService.seedOwner(store);

  const authService = new AuthService(store);
  const usersService = new UsersService(store);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/v1/auth", authRouter(authService));
  app.use("/v1/users", usersRouter(usersService));
  app.use("/v1/invites", invitesRouter(usersService));

  /*
   * Database-backed routes are mounted only when the application
   * is started with a Prisma client. Memory-store tests stay DB-free.
   */
  if (options.prisma) {
    const tendersService = new TendersService(options.prisma);
    const alertsService = new AlertsService(options.prisma, eventBus);

    const ingestService = new IngestService(
      options.prisma,
      undefined,
      async (matches) => {
        const users = await options.prisma!.user.findMany({
          where: {
            status: "active",
          },
          select: {
            id: true,
          },
        });

        await alertsService.notifyMatches(users, matches);
      },
    );
    const notificationsService = new NotificationsService(options.prisma);

    app.use("/v1/tenders", tendersRouter(tendersService));
    app.use("/v1/ingest", ingestRouter(ingestService));

    app.use("/v1/notifications", notificationsStreamRouter(eventBus));
    app.use("/v1/notifications", notificationsRouter(notificationsService));
  }

  app.use(authErrorHandler);

  return app;
}
