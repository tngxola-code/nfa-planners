import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NotificationsService } from "../services/notificationsService.js";

const queryBoolean = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean());

const listSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  unread_only: queryBoolean.optional(),
});

const readSchema = z.object({
  ids: z.array(z.string().trim().min(1)).max(100).optional(),
});

const digestSchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
});

export function notificationsRouter(service: NotificationsService): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const query = listSchema.parse(req.query);

      res.json(
        await service.list(req.user!.id, {
          cursor: query.cursor,
          limit: query.limit,
          unreadOnly: query.unread_only,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/read", async (req, res, next) => {
    try {
      const { ids } = readSchema.parse(req.body ?? {});

      res.json({
        updated: await service.markRead(req.user!.id, ids),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/digest/send", requireRole("owner"), async (req, res, next) => {
    try {
      const { hours } = digestSchema.parse(req.body ?? {});

      res.json(await service.sendDigest(hours));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
