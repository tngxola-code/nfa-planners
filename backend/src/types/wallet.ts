export const WALLET_TRANSACTION_TYPES = [
  "purchase",
  "unlock",
  "submission_pack",
  "refund",
  "adjustment",
] as const;

export type WalletTransactionType =
  (typeof WALLET_TRANSACTION_TYPES)[number];

export interface WalletDto {
  walletId: string;
  tenantId: string;
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
  updatedAt: string;
}

export interface WalletTransactionDto {
  id: string;
  type: WalletTransactionType;
  description: string;
  credits: number;
  balanceAfter: number;
  status: string;
  actorId: string;
  createdAt: string;
}

export interface WalletAdjustmentInput {
  credits: number;
  description: string;
  idempotencyKey: string;
}

export interface WalletMutationResult {
  wallet: WalletDto;
  transaction: WalletTransactionDto;
  replayed: boolean;
}
