export const STAGES = [
  "new",
  "reviewing",
  "interested",
  "in_progress",
  "submitted",
  "won_lost",
] as const;

export type Stage = (typeof STAGES)[number];

export type CalendarUrgency = "critical" | "soon" | "later";

export interface CardDto {
  id: string;
  ocid: string;
  title: string;
  buyer: string;
  valueZar: string | null;
  stage: Stage;
  ownerId: string | null;
  closingAt: string | null;
  closingInDays: number | null;
  compulsoryBriefing: boolean;
  createdAt: string;
}

export interface PipelineColumn {
  stage: Stage;
  count: number;
  cards: CardDto[];
}

export interface CalendarEvent {
  day: string;
  label: string;
  ocid: string;
  urgency: CalendarUrgency;
}
