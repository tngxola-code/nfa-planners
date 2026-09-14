export type ReviewType =
  | "basic"
  | "compliance"
  | "full";

export type ReviewStatus =
  | "processing"
  | "complete"
  | "failed";

export type Severity =
  | "Critical"
  | "High"
  | "Medium"
  | "Low";

export const REVIEW_STEPS = [
  "Reading tender requirements",
  "Analysing documents",
  "Checking compliance",
  "Scoring risks",
  "Generating recommendations",
] as const;

export interface Finding {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  summary: string;
  fix: string;
}

export interface JobStatusDto {
  jobId: string;
  cardId: string;
  reviewType: ReviewType;
  status: ReviewStatus;
  currentStep: number;
  activeStepLabel: string | null;
  score: number | null;
  error: string | null;
}

export interface JobResult extends JobStatusDto {
  findings: Finding[];
  missingDocuments: string[];
}
