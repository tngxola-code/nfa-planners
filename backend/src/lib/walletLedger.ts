export class InsufficientCreditsError extends Error {
  constructor(
    readonly balance: number,
    readonly requested: number,
  ) {
    super(
      `Insufficient credits: balance ${balance}, ` +
        `requested ${requested}.`,
    );
    this.name = "InsufficientCreditsError";
  }
}

export interface WalletTotals {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
}

export function applyCreditChange(
  wallet: WalletTotals,
  credits: number,
): WalletTotals {
  if (!Number.isSafeInteger(credits) || credits === 0) {
    throw new Error(
      "Credits must be a non-zero safe integer.",
    );
  }

  const balance = wallet.balance + credits;

  if (balance < 0) {
    throw new InsufficientCreditsError(
      wallet.balance,
      Math.abs(credits),
    );
  }

  return {
    balance,
    lifetimePurchased:
      wallet.lifetimePurchased +
      (credits > 0 ? credits : 0),
    lifetimeUsed:
      wallet.lifetimeUsed +
      (credits < 0 ? Math.abs(credits) : 0),
  };
}
