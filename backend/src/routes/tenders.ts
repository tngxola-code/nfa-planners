import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  TendersService,
  type TenderSearchQuery,
} from "../services/tendersService.js";

const queryBoolean = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean());

const searchSchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    province: z
      .union([
        z.array(z.string()),
        z.string().transform((value) => value.split(",")),
      ])
      .transform((values) =>
        values.map((value) => value.trim()).filter(Boolean),
      )
      .optional(),
    category: z.string().trim().min(1).optional(),
    status: z
      .enum(["open", "closed", "awarded", "cancelled", "unknown"])
      .optional(),
    published_within: z.enum(["24h", "7d", "30d", "all"]).optional(),
    value_min: z.coerce.number().nonnegative().optional(),
    value_max: z.coerce.number().nonnegative().optional(),
    has_briefing: queryBoolean.optional(),
    compulsory_briefing_only: queryBoolean.optional(),
    closing_soon: queryBoolean.optional(),
    sort: z.enum(["newest", "closing", "value"]).optional(),
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine(
    (value) =>
      value.value_min === undefined ||
      value.value_max === undefined ||
      value.value_min <= value.value_max,
    {
      message: "value_min must be less than or equal to value_max",
      path: ["value_min"],
    },
  );

const saveSchema = z.object({
  stage: z
    .enum([
      "new",
      "reviewing",
      "qualified",
      "bid",
      "submitted",
      "won",
      "lost",
      "archived",
    ])
    .default("new"),
});

export function tendersRouter(service: TendersService): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const query = searchSchema.parse(req.query) as TenderSearchQuery;

      res.json(await service.search(query));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:ocid/documents", async (req, res, next) => {
    try {
      const detail = await service.detail(req.params.ocid);

      if (!detail) {
        res.status(404).json({
          error: "Tender not found",
        });
        return;
      }

      res.json({ data: detail.documents });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:ocid/save", async (req, res, next) => {
    try {
      const { stage } = saveSchema.parse(req.body ?? {});
      const user = req.user;
      const tenantId = req.header("x-tenant-id")?.trim();

      if (!user) {
        res.status(401).json({
          error: "Authentication required",
        });
        return;
      }

      if (!tenantId) {
        res.status(400).json({
          error: "x-tenant-id header is required",
        });
        return;
      }

      const card = await service.save(
        tenantId,
        req.params.ocid,
        user.id,
        stage,
      );

      if (!card) {
        res.status(404).json({
          error: "Tender not found",
        });
        return;
      }

      res.status(201).json({
        cardId: card.id,
        ocid: req.params.ocid,
        stage: card.stage,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:ocid", async (req, res, next) => {
    try {
      const detail = await service.detail(req.params.ocid);

      if (!detail) {
        res.status(404).json({
          error: "Tender not found",
        });
        return;
      }

      res.json(detail);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
