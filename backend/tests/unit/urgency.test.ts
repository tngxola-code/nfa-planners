import { describe, expect, it } from "vitest";
import { closingUrgency, dayKey, daysUntil } from "../../src/lib/urgency.js";

const NOW = new Date("2026-09-13T12:00:00.000Z");

describe("closingUrgency", () => {
  it("classifies deadlines within three days as critical", () => {
    expect(closingUrgency(new Date("2026-09-16T12:00:00.000Z"), NOW)).toBe(
      "critical",
    );
  });

  it("classifies deadlines within fourteen days as soon", () => {
    expect(closingUrgency(new Date("2026-09-20T12:00:00.000Z"), NOW)).toBe(
      "soon",
    );
  });

  it("classifies later deadlines as later", () => {
    expect(closingUrgency(new Date("2026-10-20T12:00:00.000Z"), NOW)).toBe(
      "later",
    );
  });

  it("excludes expired and invalid deadlines", () => {
    expect(
      closingUrgency(new Date("2026-09-12T12:00:00.000Z"), NOW),
    ).toBeNull();

    expect(closingUrgency(new Date("invalid"), NOW)).toBeNull();
  });
});

describe("daysUntil", () => {
  it("rounds partial days upward", () => {
    expect(daysUntil(new Date("2026-09-14T13:00:00.000Z"), NOW)).toBe(2);
  });

  it("returns null for missing or invalid dates", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil(new Date("invalid"), NOW)).toBeNull();
  });
});

describe("dayKey", () => {
  it("returns a UTC calendar key", () => {
    expect(dayKey(new Date("2026-09-13T23:59:59.000Z"))).toBe("2026-09-13");
  });

  it("rejects invalid dates", () => {
    expect(() => dayKey(new Date("invalid"))).toThrow(RangeError);
  });
});
