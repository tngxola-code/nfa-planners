import type {
  ExportFormat,
  Readiness,
} from "../lib/compliance.js";

export type {
  ExportFormat,
  Readiness,
  RequirementStatus,
} from "../lib/compliance.js";

export interface RequirementDto {
  id: string;
  name: string;
  detail: string | null;
  status: string;
  ownerId: string | null;
  sortOrder: number;
}

export interface RequirementsResponse {
  requirements: RequirementDto[];
  readiness: Readiness;
}

export interface TaskDto {
  id: string;
  title: string;
  done: boolean;
  ownerId: string | null;
  due: string | null;
}

export interface VaultDocumentDto {
  id: string;
  category: string;
  name: string;
  ext: string | null;
  contentType: string | null;
  status: string;
  expiresAt: string | null;
  version: string;
  sizeBytes: number | null;
  createdAt: string;
}

export interface PresignResult {
  documentId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  storageKey: string;
}

export interface PackExport {
  format: ExportFormat;
  filename: string;
  contentType: "text/plain; charset=utf-8";
  body: string;
}
