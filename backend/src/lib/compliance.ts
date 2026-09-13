export type RequirementStatus = "complete" | "expiring" | "missing";
export type ExportFormat = "checklist" | "audit_trail";

export interface Readiness {
  met: number;
  total: number;
  pct: number;
  label: "Tender ready" | "Almost ready" | "Needs work";
}

export interface PackManifestItem {
  name: string;
  source: "requirement" | "vault" | "checklist";
  present: boolean;
}

export interface PackManifest {
  bidTitle: string;
  generatedAt: string;
  items: PackManifestItem[];
  missing: string[];
}

export function readiness(
  requirements: Array<{ status: string }>,
): Readiness {
  const total = requirements.length;
  const met = requirements.filter(
    (requirement) => requirement.status === "complete",
  ).length;
  const pct = total === 0 ? 0 : Math.round((met / total) * 100);

  return {
    met,
    total,
    pct,
    label:
      pct >= 90
        ? "Tender ready"
        : pct >= 70
          ? "Almost ready"
          : "Needs work",
  };
}

export function buildPackManifest(
  bidTitle: string,
  requirements: Array<{ name: string; status: string }>,
  vaultDocuments: Array<{ name: string }>,
  generatedAt = new Date(),
): PackManifest {
  const items: PackManifestItem[] = [
    ...requirements.map((requirement) => ({
      name: requirement.name,
      source: "requirement" as const,
      present: requirement.status === "complete",
    })),
    ...vaultDocuments.map((document) => ({
      name: document.name,
      source: "vault" as const,
      present: true,
    })),
    {
      name: "Compliance checklist (auto-generated)",
      source: "checklist",
      present: true,
    },
  ];

  return {
    bidTitle,
    generatedAt: generatedAt.toISOString(),
    items,
    missing: items
      .filter((item) => !item.present)
      .map((item) => item.name),
  };
}

export function renderExport(
  manifest: PackManifest,
  format: ExportFormat,
): string {
  const heading =
    format === "audit_trail"
      ? "NFA Console - Submission audit trail"
      : "Submission checklist";

  const lines =
    format === "audit_trail"
      ? manifest.items.map(
          (item) =>
            `${item.present ? "OK" : "MISSING"} | ${item.source} | ${item.name}`,
        )
      : manifest.items.map(
          (item) => `[${item.present ? "x" : " "}] ${item.name}`,
        );

  return [
    heading,
    `Bid: ${manifest.bidTitle}`,
    `Generated: ${manifest.generatedAt}`,
    "",
    ...lines,
  ].join("\n");
}
