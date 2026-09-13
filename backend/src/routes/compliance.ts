import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  ComplianceAccessError,
  type ComplianceService,
} from "../services/complianceService.js";

const requirementStatus = z.enum([
  "complete",
  "expiring",
  "missing",
]);

const exportFormat = z.enum([
  "checklist",
  "audit_trail",
]);

const documentCategory = z.enum([
  "registration",
  "tax",
  "transformation",
  "banking",
  "other",
]);

const allowedContentType = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .nullable()
  .optional();

function tenantIdFrom(req: Request): string {
  const value = req.header("x-tenant-id")?.trim();

  if (!value) {
    throw new ComplianceAccessError(
      "X-Tenant-Id header is required.",
      400,
    );
  }

  return value;
}

export function complianceRouter(
  service: ComplianceService,
): Router {
  const router = Router();

  router.use(requireAuth);

  router.get(
    "/bids/:cardId/requirements",
    async (req, res, next) => {
      try {
        res.json(
          await service.requirements(
            tenantIdFrom(req),
            req.user!.id,
            req.params.cardId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/bids/:cardId/requirements/:requirementId",
    async (req, res, next) => {
      try {
        const patch = z
          .object({
            status: requirementStatus.optional(),
            ownerId: z.string().min(1).nullable().optional(),
          })
          .strict()
          .refine(
            (value) =>
              value.status !== undefined ||
              value.ownerId !== undefined,
            {
              message:
                "At least one requirement field is required.",
            },
          )
          .parse(req.body);

        res.json(
          await service.updateRequirement(
            tenantIdFrom(req),
            req.user!.id,
            req.params.cardId,
            req.params.requirementId,
            patch,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/bids/:cardId/tasks",
    async (req, res, next) => {
      try {
        res.json({
          data: await service.tasks(
            tenantIdFrom(req),
            req.user!.id,
            req.params.cardId,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/bids/:cardId/tasks",
    async (req, res, next) => {
      try {
        const body = z
          .object({
            title: z.string().trim().min(1).max(200),
            ownerId: z.string().min(1).nullable().optional(),
            due: optionalDate,
          })
          .strict()
          .parse(req.body);

        res.status(201).json({
          data: await service.createTask(
            tenantIdFrom(req),
            req.user!.id,
            req.params.cardId,
            {
              title: body.title,
              ownerId:
                body.ownerId === undefined
                  ? req.user!.id
                  : body.ownerId,
              due: body.due ?? null,
            },
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/bids/:cardId/tasks/:taskId/toggle",
    async (req, res, next) => {
      try {
        res.json({
          data: await service.toggleTask(
            tenantIdFrom(req),
            req.user!.id,
            req.params.cardId,
            req.params.taskId,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/bids/:cardId/submission-pack",
    async (req, res, next) => {
      try {
        res.status(201).json(
          await service.generatePack(
            tenantIdFrom(req),
            req.user!.id,
            req.params.cardId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/bids/:cardId/pack/export",
    async (req, res, next) => {
      try {
        const query = z
          .object({
            format: exportFormat.default("checklist"),
          })
          .parse(req.query);

        const result = await service.exportPack(
          tenantIdFrom(req),
          req.user!.id,
          req.params.cardId,
          query.format,
        );

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${result.filename}"`,
        );
        res.type(result.contentType).send(result.body);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/vault/documents",
    async (req, res, next) => {
      try {
        res.json({
          data: await service.vaultGrouped(
            tenantIdFrom(req),
            req.user!.id,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/vault/documents",
    async (req, res, next) => {
      try {
        const body = z
          .object({
            name: z.string().trim().min(1).max(255),
            content_type: allowedContentType,
            category: documentCategory.default("other"),
            expires_at: optionalDate,
            size_bytes: z
              .number()
              .int()
              .positive()
              .max(25 * 1024 * 1024)
              .nullable()
              .optional(),
          })
          .strict()
          .parse(req.body);

        res.status(201).json(
          await service.presignUpload(
            tenantIdFrom(req),
            req.user!.id,
            {
              name: body.name,
              contentType: body.content_type,
              category: body.category,
              expiresAt: body.expires_at ?? null,
              sizeBytes: body.size_bytes ?? null,
            },
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/vault/expiring",
    async (req, res, next) => {
      try {
        const query = z
          .object({
            days: z.coerce
              .number()
              .int()
              .min(1)
              .max(365)
              .default(45),
          })
          .parse(req.query);

        res.json({
          data: await service.expiring(
            tenantIdFrom(req),
            req.user!.id,
            query.days,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export function complianceErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof ComplianceAccessError) {
    res.status(error.status).json({
      error: error.message,
    });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Invalid request.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  next(error);
}
