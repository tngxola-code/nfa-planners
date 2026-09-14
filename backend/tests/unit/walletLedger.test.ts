import {
  describe,
  expect,
  it,
} from "vitest";
import {
  InsufficientCreditsError,
  applyCreditChange,
} from "../../src/lib/walletLedger.js";

describe("wallet ledger calculations", () => {
  it("adds purchased credits", () => {
    expect(
      applyCreditChange(
        {
          balance: 100,
          lifetimePurchased: 100,
          lifetimeUsed: 0,
        },
        50,
      ),
    ).toEqual({
      balance: 150,
      lifetimePurchased: 150,
      lifetimeUsed: 0,
    });
  });

  it("deducts consumed credits", () => {
    expect(
      applyCreditChange(
        {
          balance: 100,
          lifetimePurchased: 100,
          lifetimeUsed: 0,
        },
        -40,
      ),
    ).toEqual({
      balance: 60,
      lifetimePurchased: 100,
      lifetimeUsed: 40,
    });
  });

  it("rejects an insufficient balance", () => {
    expect(() =>
      applyCreditChange(
        {
          balance: 20,
          lifetimePurchased: 20,
          lifetimeUsed: 0,
        },
        -21,
      ),
    ).toThrow(InsufficientCreditsError);
  });

  it("rejects zero and unsafe values", () => {
    expect(() =>
      applyCreditChange(
        {
          balance: 0,
          lifetimePurchased: 0,
          lifetimeUsed: 0,
        },
        0,
      ),
    ).toThrow(
      "Credits must be a non-zero safe integer.",
    );

    expect(() =>
      applyCreditChange(
        {
          balance: 0,
          lifetimePurchased: 0,
          lifetimeUsed: 0,
        },
        Number.MAX_VALUE,
      ),
    ).toThrow(
      "Credits must be a non-zero safe integer.",
    );
  });
});
