import { describe, expect, it } from "vitest";
import {
  buildPackManifest,
  readiness,
  renderExport,
} from "../../src/lib/compliance.js";
import { newStorageKey } from "../../src/lib/storage.js";

describe("readiness", () => {
  it("computes completion percentage and label", () => {
    const result = readiness([
      { status: "complete" },
      { status: "complete" },
      { status: "missing" },
    ]);

    expect(result).toEqual({
      met: 2,
      total: 3,
      pct: 67,
      label: "Needs work",
    });
  });

  it("supports ready, almost-ready, and empty states", () => {
    expect(
      readiness(
        Array.from({ length: 9 }, () => ({
          status: "complete",
        })).concat([{ status: "missing" }]),
      ).label,
    ).toBe("Tender ready");

    expect(
      readiness(
        Array.from({ length: 7 }, () => ({
          status: "complete",
        })).concat(
          Array.from({ length: 3 }, () => ({
            status: "missing",
          })),
        ),
      ).label,
    ).toBe("Almost ready");

    expect(readiness([])).toEqual({
      met: 0,
      total: 0,
      pct: 0,
      label: "Needs work",
    });
  });
});

describe("buildPackManifest", () => {
  it("records the bid title, missing requirements, and documents", () => {
    const generatedAt = new Date("2026-09-13T12:00:00.000Z");

    const manifest = buildPackManifest(
      "Bulk water meters",
      [
        { name: "Tax PIN", status: "complete" },
        { name: "B-BBEE", status: "missing" },
      ],
      [{ name: "CIPC certificate" }],
      generatedAt,
    );

    expect(manifest.bidTitle).toBe("Bulk water meters");
    expect(manifest.generatedAt).toBe(
      "2026-09-13T12:00:00.000Z",
    );
    expect(manifest.items).toHaveLength(4);
    expect(manifest.missing).toEqual(["B-BBEE"]);
  });
});

describe("renderExport", () => {
  const manifest = buildPackManifest(
    "Bid 017",
    [
      { name: "Tax PIN", status: "complete" },
      { name: "B-BBEE", status: "missing" },
    ],
    [],
    new Date("2026-09-13T12:00:00.000Z"),
  );

  it("renders an audit trail", () => {
    const output = renderExport(manifest, "audit_trail");

    expect(output).toContain("Bid: Bid 017");
    expect(output).toContain("OK | requirement | Tax PIN");
    expect(output).toContain(
      "MISSING | requirement | B-BBEE",
    );
  });

  it("renders a checklist", () => {
    const output = renderExport(manifest, "checklist");

    expect(output).toContain("[x] Tax PIN");
    expect(output).toContain("[ ] B-BBEE");
  });
});

describe("newStorageKey", () => {
  it("isolates documents under the tenant path", () => {
    const key = newStorageKey("tenant-1", "PDF");

    expect(key).toMatch(
      /^vault\/tenant-1\/[a-f0-9-]+\.pdf$/,
    );
  });

  it("rejects an invalid tenant path", () => {
    expect(() => newStorageKey("../", "pdf")).toThrow(
      "Invalid storage path segment.",
    );
  });
});
