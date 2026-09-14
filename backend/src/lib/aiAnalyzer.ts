import type {
  Finding,
  ReviewType,
  Severity,
} from "../types/aiReview.js";

export interface AnalysisInput {
  bidTitle: string;
  requirements: Array<{
    name: string;
    status: string;
  }>;
  vaultDocuments: Array<{
    id: string;
    name: string;
    status: string;
    expiresAt: Date | null;
  }>;
  now?: Date;
}

export interface AnalysisOutput {
  score: number;
  findings: Finding[];
  missingDocuments: string[];
}

export interface AiAnalyzer {
  analyze(
    input: AnalysisInput,
    reviewType: ReviewType,
  ): Promise<AnalysisOutput>;
}

interface RequirementRule {
  severity: Severity;
  category: string;
  fix: string;
}

const requirementRules: Record<
  string,
  RequirementRule
> = {
  "Tax Clearance Certificate": {
    severity: "Critical",
    category: "Compliance",
    fix:
      "Generate a current SARS tax compliance PIN " +
      "and attach it before the closing date.",
  },
  "B-BBEE Certificate": {
    severity: "High",
    category: "Eligibility",
    fix:
      "Renew the B-BBEE certificate or attach a " +
      "valid sworn EME/QSE affidavit.",
  },
  "Briefing Attendance": {
    severity: "Critical",
    category: "Eligibility",
    fix:
      "Confirm attendance at the compulsory briefing. " +
      "Non-attendance may disqualify the bid.",
  },
};

const severityWeights: Record<Severity, number> = {
  Critical: 15,
  High: 8,
  Medium: 3,
  Low: 0,
};

export function scoreFindings(
  findings: Array<{ severity: Severity }>,
): number {
  const deductions = findings.reduce(
    (total, finding) =>
      total + severityWeights[finding.severity],
    0,
  );

  return Math.max(0, 100 - deductions);
}

export const ruleBasedAnalyzer: AiAnalyzer = {
  async analyze(input, reviewType) {
    const now = input.now ?? new Date();
    const findings: Finding[] = [];
    let sequence = 0;

    const createFinding = (
      finding: Omit<Finding, "id">,
    ): Finding => ({
      id: `finding-${++sequence}`,
      ...finding,
    });

    if (reviewType !== "basic") {
      for (const requirement of input.requirements) {
        const rule =
          requirementRules[requirement.name];

        if (
          requirement.status === "missing" &&
          rule
        ) {
          findings.push(
            createFinding({
              severity: rule.severity,
              category: rule.category,
              title:
                `${requirement.name} not attached`,
              summary:
                `No valid ${requirement.name} was ` +
                "detected in the submission pack.",
              fix: rule.fix,
            }),
          );
        } else if (
          requirement.status === "expiring"
        ) {
          findings.push(
            createFinding({
              severity: "Medium",
              category: "Compliance",
              title:
                `${requirement.name} expires soon`,
              summary:
                `${requirement.name} is within its ` +
                "renewal window.",
              fix:
                `Renew ${requirement.name} and attach ` +
                "the updated copy.",
            }),
          );
        }
      }
    }

    if (reviewType === "full") {
      for (const document of input.vaultDocuments) {
        const expiredByDate =
          document.expiresAt !== null &&
          document.expiresAt <= now;

        if (
          document.status === "expired" ||
          expiredByDate
        ) {
          findings.push(
            createFinding({
              severity: "High",
              category: "Document Quality",
              title:
                `${document.name} is out of date`,
              summary:
                `${document.name} expired before the ` +
                "evaluation window.",
              fix:
                "Renew the document and rerun the review.",
            }),
          );
        }
      }
    }

    const missingDocuments = input.requirements
      .filter(
        (requirement) =>
          requirement.status === "missing",
      )
      .map((requirement) => requirement.name);

    return {
      score: scoreFindings(findings),
      findings,
      missingDocuments,
    };
  },
};
