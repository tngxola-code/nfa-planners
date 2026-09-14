import {
  Prisma,
  type PrismaClient,
  type Wallet,
  type WalletTransaction,
} from "@prisma/client";
import {
  applyCreditChange,
} from "../lib/walletLedger.js";
import type {
  WalletAdjustmentInput,
  WalletDto,
  WalletMutationResult,
  WalletTransactionDto,
  WalletTransactionType,
} from "../types/wallet.js";

export class WalletAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WalletAccessError";
  }
}

function toWalletDto(wallet: Wallet): WalletDto {
  return {
    walletId: wallet.id,
    tenantId: wallet.tenantId,
    balance: wallet.balance,
    lifetimePurchased:
      wallet.lifetimePurchased,
    lifetimeUsed: wallet.lifetimeUsed,
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

function toTransactionDto(
  transaction: WalletTransaction,
): WalletTransactionDto {
  return {
    id: transaction.id,
    type:
      transaction.type as WalletTransactionType,
    description: transaction.description,
    credits: transaction.credits,
    balanceAfter: transaction.balanceAfter,
    status: transaction.status,
    actorId: transaction.actorId,
    createdAt:
      transaction.createdAt.toISOString(),
  };
}

export class WalletService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  private async requireMembership(
    tenantId: string,
    userId: string,
  ) {
    const membership =
      await this.prisma.member.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId,
          },
        },
        select: {
          id: true,
          role: true,
        },
      });

    if (!membership) {
      throw new WalletAccessError(
        "Tenant membership required.",
        403,
      );
    }

    return membership;
  }

  private async requireAdministrator(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const membership =
      await this.requireMembership(
        tenantId,
        userId,
      );

    if (
      membership.role !== "owner" &&
      membership.role !== "admin"
    ) {
      throw new WalletAccessError(
        "Tenant owner or administrator required.",
        403,
      );
    }
  }

  private async ensureWallet(
    client: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<Wallet> {
    return client.wallet.upsert({
      where: {
        tenantId,
      },
      create: {
        tenantId,
      },
      update: {},
    });
  }

  async wallet(
    tenantId: string,
    userId: string,
  ): Promise<WalletDto> {
    await this.requireMembership(
      tenantId,
      userId,
    );

    const wallet = await this.prisma.$transaction(
      (transaction) =>
        this.ensureWallet(
          transaction,
          tenantId,
        ),
    );

    return toWalletDto(wallet);
  }

  async transactions(
    tenantId: string,
    userId: string,
    limit = 50,
  ): Promise<WalletTransactionDto[]> {
    await this.requireMembership(
      tenantId,
      userId,
    );

    const rows =
      await this.prisma.walletTransaction.findMany({
        where: {
          tenantId,
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        take: limit,
      });

    return rows.map(toTransactionDto);
  }

  private async mutate(
    tenantId: string,
    userId: string,
    type: WalletTransactionType,
    input: WalletAdjustmentInput,
  ): Promise<WalletMutationResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const previous =
          await transaction.walletTransaction
            .findUnique({
              where: {
                tenantId_idempotencyKey: {
                  tenantId,
                  idempotencyKey:
                    input.idempotencyKey,
                },
              },
            });

        if (previous) {
          const existingWallet =
            await transaction.wallet.findUnique({
              where: {
                id: previous.walletId,
              },
            });

          if (!existingWallet) {
            throw new WalletAccessError(
              "Wallet transaction is inconsistent.",
              500,
            );
          }

          return {
            wallet: toWalletDto(existingWallet),
            transaction:
              toTransactionDto(previous),
            replayed: true,
          };
        }

        const wallet = await this.ensureWallet(
          transaction,
          tenantId,
        );

        const next = applyCreditChange(
          {
            balance: wallet.balance,
            lifetimePurchased:
              wallet.lifetimePurchased,
            lifetimeUsed:
              wallet.lifetimeUsed,
          },
          input.credits,
        );

        const updatedWallet =
          await transaction.wallet.update({
            where: {
              id: wallet.id,
            },
            data: next,
          });

        const walletTransaction =
          await transaction.walletTransaction
            .create({
              data: {
                walletId: wallet.id,
                tenantId,
                actorId: userId,
                type,
                description:
                  input.description,
                credits: input.credits,
                balanceAfter: next.balance,
                idempotencyKey:
                  input.idempotencyKey,
              },
            });

        return {
          wallet: toWalletDto(updatedWallet),
          transaction:
            toTransactionDto(walletTransaction),
          replayed: false,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
      },
    );
  }

  async adjust(
    tenantId: string,
    userId: string,
    input: WalletAdjustmentInput,
  ): Promise<WalletMutationResult> {
    await this.requireAdministrator(
      tenantId,
      userId,
    );

    return this.mutate(
      tenantId,
      userId,
      "adjustment",
      input,
    );
  }

  async spend(
    tenantId: string,
    userId: string,
    type: Extract<
      WalletTransactionType,
      "unlock" | "submission_pack"
    >,
    input: WalletAdjustmentInput,
  ): Promise<WalletMutationResult> {
    await this.requireMembership(
      tenantId,
      userId,
    );

    if (input.credits >= 0) {
      throw new WalletAccessError(
        "Wallet spending requires negative credits.",
        400,
      );
    }

    return this.mutate(
      tenantId,
      userId,
      type,
      input,
    );
  }
}
