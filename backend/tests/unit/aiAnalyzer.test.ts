import {
  describe,
  expect,
  it,
} from "vitest";
import {
  ruleBasedAnalyzer,
  scoreFindings,
} from "../../src/lib/aiAnalyzer.js";

describe("AI review analyzer", () => {
  it("applies deterministic severity deductions", () => {
    expect(
      scoreFindings([
        { severity: "Critical" },
        { severity: "High" },
        { severity: "Medium" },
        { severity: "Low" },
      ]),
    ).toBe(74);
  });

  it("returns no findings for a basic review", async () => {
    const result = await ruleBasedAnalyzer.analyze(
      {
        bidTitle: "Water meters",
        requirements: [
          {
            name: "Tax Clearance Certificate",
            status: "missing",
          },
        ],
        vaultDocuments: [],
      },
      "basic",
    );

    expect(result.score).toBe(100);
    expect(result.findings).toEqual([]);
    expect(result.missingDocuments).toEqual([
      "Tax Clearance Certificate",
    ]);
  });

  it("identifies missing compliance documents", async () => {
    const result = await ruleBasedAnalyzer.analyze(
      {
        bidTitle: "Water meters",
        requirements: [
          {
            name: "Tax Clearance Certificate",
            status: "missing",
          },
          {
            name: "B-BBEE Certificate",
            status: "complete",
          },
        ],
        vaultDocuments: [],
      },
      "compliance",
    );

    expect(result.score).toBe(85);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      severity: "Critical",
      category: "Compliance",
      title:
        "Tax Clearance Certificate not attached",
    });
  });

  it("detects expired selected documents", async () => {
    const result = await ruleBasedAnalyzer.analyze(
      {
        bidTitle: "Water meters",
        requirements: [],
        vaultDocuments: [
          {
            id: "document-1",
            name: "Company registration",
            status: "valid",
            expiresAt:
              new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        now: new Date("2026-09-13T00:00:00.000Z"),
      },
      "full",
    );

    expect(result.score).toBe(92);
    expect(result.findings[0]).toMatchObject({
      severity: "High",
      title: "Company registration is out of date",
    });
  });
});
