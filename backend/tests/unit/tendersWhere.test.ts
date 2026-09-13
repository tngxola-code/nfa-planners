import { describe, expect, it } from "vitest";
import { buildSearchWhere } from "../../src/services/tendersService.js";

const NOW = new Date("2026-09-13T10:00:00Z");

function conditions(query: Parameters<typeof buildSearchWhere>[0]) {
  const where = buildSearchWhere(query, NOW);
  return Array.isArray(where.AND) ? where.AND : [];
}

describe("buildSearchWhere", () => {
  it("derives open status from closingAt", () => {
    expect(conditions({ status: "open" })).toContainEqual({
      awardedAt: null,
      cancelledAt: null,
      closingAt: { gt: NOW },
    });
  });

  it("derives closed status from an expired deadline", () => {
    expect(conditions({ status: "closed" })).toContainEqual({
      awardedAt: null,
      cancelledAt: null,
      closingAt: { lte: NOW },
    });
  });

  it("derives awarded status", () => {
    expect(conditions({ status: "awarded" })).toContainEqual({
      awardedAt: { not: null },
      cancelledAt: null,
    });
  });

  it("derives cancelled status", () => {
    expect(conditions({ status: "cancelled" })).toContainEqual({
      cancelledAt: { not: null },
    });
  });

  it("derives unknown status when lifecycle dates are absent", () => {
    expect(conditions({ status: "unknown" })).toContainEqual({
      closingAt: null,
      awardedAt: null,
      cancelledAt: null,
    });
  });

  it("uses Decimal-compatible numeric filters", () => {
    expect(
      conditions({
        value_min: 1_000_000,
        value_max: 50_000_000,
      }),
    ).toContainEqual({
      valueZar: {
        gte: 1_000_000,
        lte: 50_000_000,
      },
    });
  });

  it("combines search and status using AND", () => {
    const where = buildSearchWhere(
      {
        q: "tshwane",
        status: "open",
      },
      NOW,
    );

    expect(where.AND).toHaveLength(2);
    expect(conditions({ q: "tshwane" })[0]).toEqual({
      OR: [
        {
          title: {
            contains: "tshwane",
            mode: "insensitive",
          },
        },
        {
          buyer: {
            contains: "tshwane",
            mode: "insensitive",
          },
        },
        {
          ocid: {
            equals: "tshwane",
            mode: "insensitive",
          },
        },
      ],
    });
  });

  it("builds the seven-day closing-soon window", () => {
    expect(conditions({ closing_soon: true })).toContainEqual({
      awardedAt: null,
      cancelledAt: null,
      closingAt: {
        gt: NOW,
        lte: new Date("2026-09-20T10:00:00Z"),
      },
    });
  });

  it("supports explicit false for briefing filters", () => {
    expect(conditions({ has_briefing: false })).toContainEqual({
      briefingAt: null,
    });
  });
});
