import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  AiReviewAccessError,
  type AiReviewService,
} from "../services/aiReviewService.js";

function tenantIdFrom(req: Request): string {
  const tenantId =
    req.header("x-tenant-id")?.trim();

  if (!tenantId) {
    throw new AiReviewAccessError(
      "x-tenant-id header is required.",
      400,
    );
  }

  return tenantId;
}

const startReviewSchema = z
  .object({
    review_type: z.enum([
      "basic",
      "compliance",
      "full",
    ]),
    document_ids: z
      .array(z.string().trim().min(1))
      .max(100)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.document_ids &&
      new Set(value.document_ids).size !==
        value.document_ids.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["document_ids"],
        message:
          "document_ids must not contain duplicates.",
      });
    }
  });

export function aiReviewRouter(
  service: AiReviewService,
): Router {
  const router = Router();

  router.use(requireAuth);

  router.post(
    "/bids/:cardId/ai-review",
    async (req, res, next) => {
      try {
        const body = startReviewSchema.parse(
          req.body ?? {},
        );

        const started = await service.start(
          tenantIdFrom(req),
          req.user!.id,
          req.params.cardId,
          body.review_type,
          body.document_ids,
        );

        res.status(202).json({
          ...started,
          status: "processing",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/ai-review/:jobId",
    async (req, res, next) => {
      try {
        res.json(
          await service.status(
            tenantIdFrom(req),
            req.user!.id,
            req.params.jobId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/ai-review/:jobId/findings",
    async (req, res, next) => {
      try {
        res.json(
          await service.findings(
            tenantIdFrom(req),
            req.user!.id,
            req.params.jobId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/ai-review/:jobId/report",
    async (req, res, next) => {
      try {
        const report = await service.report(
          tenantIdFrom(req),
          req.user!.id,
          req.params.jobId,
        );

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${report.filename}"`,
        );
        res.setHeader(
          "Content-Type",
          "text/plain; charset=utf-8",
        );
        res.send(report.body);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export function aiReviewErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof AiReviewAccessError) {
    res.status(error.status).json({
      error: error.message,
    });
    return;
  }

  next(error);
}
