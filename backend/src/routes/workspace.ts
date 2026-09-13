import { Router, type Request } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  WorkspaceAccessError,
  WorkspaceService,
} from "../services/workspaceService.js";
import { STAGES } from "../types/workspace.js";

const calendarQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
});

const moveCardSchema = z.object({
  stage: z.enum(STAGES),
  ownerId: z.union([z.string().trim().min(1), z.null()]).optional(),
});

function tenantIdFrom(request: Request): string {
  const tenantId = request.header("x-tenant-id")?.trim();

  if (!tenantId) {
    throw new WorkspaceAccessError(400, "X-Tenant-Id header is required");
  }

  return tenantId;
}

export function workspaceRouter(service: WorkspaceService): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/pipeline", async (req, res, next) => {
    try {
      const tenantId = tenantIdFrom(req);

      res.json(await service.pipeline(tenantId, req.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/calendar", async (req, res, next) => {
    try {
      const tenantId = tenantIdFrom(req);
      const { days } = calendarQuerySchema.parse(req.query);

      res.json(await service.calendar(tenantId, req.user!.id, days));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/cards/:cardId", async (req, res, next) => {
    try {
      const tenantId = tenantIdFrom(req);
      const { stage, ownerId } = moveCardSchema.parse(req.body ?? {});

      res.json(
        await service.moveCard(
          tenantId,
          req.user!.id,
          req.params.cardId,
          stage,
          ownerId,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function workspaceErrorHandler(
  error: unknown,
  _req: Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  if (error instanceof WorkspaceAccessError) {
    res.status(error.status).json({
      error: error.message,
    });
    return;
  }

  next(error);
}
