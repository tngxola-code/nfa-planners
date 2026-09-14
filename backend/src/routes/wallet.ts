import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { Router } from "express";
import { z } from "zod";
import {
  InsufficientCreditsError,
} from "../lib/walletLedger.js";
import { requireAuth } from "../middleware/auth.js";
import {
  WalletAccessError,
  type WalletService,
} from "../services/walletService.js";

function tenantIdFrom(req: Request): string {
  const tenantId =
    req.header("x-tenant-id")?.trim();

  if (!tenantId) {
    throw new WalletAccessError(
      "x-tenant-id header is required.",
      400,
    );
  }

  return tenantId;
}

function idempotencyKeyFrom(
  req: Request,
): string {
  const key =
    req.header("idempotency-key")?.trim();

  if (!key) {
    throw new WalletAccessError(
      "idempotency-key header is required.",
      400,
    );
  }

  if (key.length > 200) {
    throw new WalletAccessError(
      "idempotency-key must not exceed 200 characters.",
      400,
    );
  }

  return key;
}

const adjustmentSchema = z
  .object({
    credits: z
      .number()
      .int()
      .safe()
      .refine(
        (credits) => credits !== 0,
        "credits must not be zero",
      ),
    description: z
      .string()
      .trim()
      .min(1)
      .max(500),
  })
  .strict();

const transactionQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),
});

export function walletRouter(
  service: WalletService,
): Router {
  const router = Router();

  router.use(requireAuth);

  router.get(
    "/wallet",
    async (req, res, next) => {
      try {
        res.json({
          data: await service.wallet(
            tenantIdFrom(req),
            req.user!.id,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/wallet/transactions",
    async (req, res, next) => {
      try {
        const query =
          transactionQuerySchema.parse(
            req.query,
          );

        res.json({
          data: await service.transactions(
            tenantIdFrom(req),
            req.user!.id,
            query.limit,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/wallet/adjustments",
    async (req, res, next) => {
      try {
        const body = adjustmentSchema.parse(
          req.body ?? {},
        );

        const result = await service.adjust(
          tenantIdFrom(req),
          req.user!.id,
          {
            ...body,
            idempotencyKey:
              idempotencyKeyFrom(req),
          },
        );

        res
          .status(result.replayed ? 200 : 201)
          .json({
            data: result,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export function walletErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof WalletAccessError) {
    res.status(error.status).json({
      error: error.message,
    });
    return;
  }

  if (
    error instanceof InsufficientCreditsError
  ) {
    res.status(409).json({
      error: error.message,
      balance: error.balance,
      requested: error.requested,
    });
    return;
  }

  next(error);
}
