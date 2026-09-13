export type TenderStatus =
  "open" | "closed" | "awarded" | "cancelled" | "unknown";

export type FeedStatus = "ok" | "degraded" | "down";

export interface TenderDocumentDto {
  id: string;
  name: string;
  docType: string | null;
  url: string;
  sizeBytes: number | null;
  publishedAt: string | null;
}

export interface TenderSummary {
  id: string;
  source: string;
  ocid: string;
  title: string;
  buyer: string;
  province: string | null;
  category: string | null;
  valueZar: string | null;
  closingAt: string | null;
  publishedAt: string | null;
  status: TenderStatus;
  isNew: boolean;
  compulsoryBriefing: boolean;
  documentsCount: number;
}

export interface TenderDetail extends TenderSummary {
  description: string | null;
  briefing: {
    at: string;
    venue: string | null;
  } | null;
  keyDates: {
    published: string | null;
    briefing: string | null;
    closing: string | null;
    awarded: string | null;
  };
  timeline: {
    title: string;
    date: string;
    kind: "done" | "due" | "future";
  }[];
  documents: TenderDocumentDto[];
}

export interface IngestStatus {
  lastSyncAt: string | null;
  releasesProcessedLastRun: number;
  createdLastRun: number;
  updatedLastRun: number;
  matchedLastRun: number;
  skippedLastRun: number;
  failedLastRun: number;
  sourcesTracked: number;
  feedStatus: FeedStatus;
  running: boolean;
}
