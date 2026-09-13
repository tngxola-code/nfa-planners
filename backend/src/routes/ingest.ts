import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { IngestService } from "../services/ingestService.js";

export function ingestRouter(service: IngestService): Router {
  const router = Router();

  router.use(requireAuth);

  router.post("/run", async (req, res, next) => {
    try {
      if (req.user?.role !== "owner") {
        res.status(403).json({
          error: "Owner role required",
        });
        return;
      }

      const result = await service.run();
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/status", async (_req, res, next) => {
    try {
      res.json(await service.status());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
