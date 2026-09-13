import { describe, expect, it } from "vitest";
import {
  isMatch,
  isTenderNew,
  parseRelease,
  type IngestConfig,
  type OcdsRelease,
} from "../../src/lib/ocds.js";

const NOW = new Date("2026-09-13T10:00:00Z");

const CONFIG: IngestConfig = {
  matchKeywords: ["gis", "spatial planning"],
  isNewWindowHours: 48,
  now: NOW,
};

const BASE: OcdsRelease = {
  ocid: "ocds-9d2tz1-TSH-0042",
  id: "release-1",
  date: "2026-09-12T08:00:00Z",
  tender: {
    title: "GIS Land Parcel Audit",
    description: "Rural wards spatial audit",
    status: "active",
    value: {
      amount: 4_200_000.5,
      currency: "ZAR",
    },
    tenderPeriod: {
      startDate: "2026-09-12T08:00:00Z",
      endDate: "2026-09-20T16:00:00Z",
    },
    documents: [
      {
        id: "d1",
        title: "Tender notice.pdf",
        url: "https://example.test/notice.pdf",
        documentType: "notice",
        datePublished: "2026-09-12T08:00:00Z",
      },
      {
        id: "d2",
        title: "No URL",
      },
      {
        id: "d3",
        title: "Unsafe",
        url: "javascript:alert(1)",
      },
    ],
  },
  buyer: {
    id: "buyer-1",
  },
  parties: [
    {
      id: "buyer-1",
      name: "City of Tshwane",
      roles: ["buyer"],
    },
  ],
};

describe("parseRelease", () => {
  it("maps a release without losing decimal precision intentionally", () => {
    const parsed = parseRelease(BASE, CONFIG);

    expect(parsed.ocid).toBe(BASE.ocid);
    expect(parsed.sourceReleaseId).toBe("release-1");
    expect(parsed.title).toBe("GIS Land Parcel Audit");
    expect(parsed.buyer).toBe("City of Tshwane");
    expect(parsed.valueZar).toBe("4200000.5");
    expect(parsed.closingAt?.toISOString()).toBe("2026-09-20T16:00:00.000Z");
    expect(parsed.awardedAt).toBeNull();
    expect(parsed.cancelledAt).toBeNull();
    expect(parsed.documents).toHaveLength(1);
    expect(parsed.documents[0].sourceDocumentId).toBe("d1");
  });

  it("uses active award dates instead of tender complete status", () => {
    const parsed = parseRelease(
      {
        ...BASE,
        awards: [
          {
            id: "award-1",
            status: "active",
            date: "2026-09-21T12:00:00Z",
          },
        ],
      },
      CONFIG,
    );

    expect(parsed.awardedAt?.toISOString()).toBe("2026-09-21T12:00:00.000Z");
  });

  it("does not interpret complete tender status as an award", () => {
    const parsed = parseRelease(
      {
        ...BASE,
        tender: {
          ...BASE.tender,
          status: "complete",
        },
      },
      CONFIG,
    );

    expect(parsed.awardedAt).toBeNull();
  });

  it("captures cancellation", () => {
    const parsed = parseRelease(
      {
        ...BASE,
        tender: {
          ...BASE.tender,
          status: "cancelled",
        },
      },
      CONFIG,
    );

    expect(parsed.cancelledAt?.toISOString()).toBe("2026-09-12T08:00:00.000Z");
  });

  it("detects compulsory briefings", () => {
    const parsed = parseRelease(
      {
        ...BASE,
        tender: {
          ...BASE.tender,
          description: "A mandatory site meeting will be held.",
        },
      },
      CONFIG,
    );

    expect(parsed.compulsoryBriefing).toBe(true);
  });

  it("drops non-ZAR values", () => {
    const parsed = parseRelease(
      {
        ...BASE,
        tender: {
          ...BASE.tender,
          value: {
            amount: 100,
            currency: "USD",
          },
        },
      },
      CONFIG,
    );

    expect(parsed.valueZar).toBeNull();
  });

  it("handles a missing tender block", () => {
    const parsed = parseRelease(
      {
        ocid: "ocds-test-empty",
      },
      CONFIG,
    );

    expect(parsed.title).toBe("Untitled tender");
    expect(parsed.buyer).toBe("Unknown buyer");
  });
});

describe("matching and NEW window", () => {
  it("matches capability keywords case-insensitively", () => {
    expect(isMatch(parseRelease(BASE, CONFIG), CONFIG)).toBe(true);
  });

  it("rejects unrelated tenders", () => {
    const parsed = parseRelease(
      {
        ...BASE,
        tender: {
          ...BASE.tender,
          title: "Catering services",
          description: null,
        },
      },
      CONFIG,
    );

    expect(isMatch(parsed, CONFIG)).toBe(false);
  });

  it("derives NEW within 48 hours", () => {
    expect(isTenderNew(new Date("2026-09-12T08:00:00Z"), CONFIG)).toBe(true);
  });

  it("rejects future publication dates as NEW", () => {
    expect(isTenderNew(new Date("2026-09-14T08:00:00Z"), CONFIG)).toBe(false);
  });
});
