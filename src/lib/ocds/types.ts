/**
 * Opportunity domain model and OCDS release types.
 *
 * The OCDS types mirror the eTenders OCDS API shape. The live API is
 * unreliable, so every field that is not strictly part of a release's
 * identity is modelled as genuinely optional. Runtime validators are pure
 * TypeScript (no zod).
 */

// ---------------------------------------------------------------------------
// OCDS release types (eTenders OCDS API shape)
// ---------------------------------------------------------------------------

export interface OcdsContactPoint {
  email?: string;
  telephone?: string;
}

export interface OcdsProcuringEntity {
  name: string;
  contactPoint?: OcdsContactPoint;
}

export interface OcdsTenderPeriod {
  endDate?: string;
}

export interface OcdsTenderValue {
  amount?: number;
  currency?: string;
}

export interface OcdsTender {
  value?: OcdsTenderValue;
}

export interface OcdsDocument {
  url: string;
  title?: string;
}

export interface OcdsClassification {
  scheme?: string;
}

export interface OcdsLocation {
  name?: string;
}

export interface OcdsAddress {
  region?: string;
}

/**
 * A single OCDS release as returned by the eTenders OCDS API.
 * `id`, `tenderID`, `title`, `description`, `date` and `procuringEntity`
 * form the core release payload; everything else may legitimately be absent.
 */
export interface OcdsRelease {
  id: string;
  tenderID: string;
  title: string;
  description: string;
  date: string;
  procuringEntity: OcdsProcuringEntity;
  tenderPeriod?: OcdsTenderPeriod;
  tender?: OcdsTender;
  documents?: OcdsDocument[];
  classification?: OcdsClassification;
  mainProcurementLocation?: OcdsLocation;
  address?: OcdsAddress;
}

// ---------------------------------------------------------------------------
// Internal domain model
// ---------------------------------------------------------------------------

export const OPPORTUNITY_CATEGORIES = [
  "Town Planning",
  "Spatial Planning",
  "GIS",
  "Surveying",
  "Infrastructure",
  "Human Settlements",
  "Other",
] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export type OpportunityStatus = "active" | "closed";

/**
 * Canonical opportunity record used throughout the console.
 */
export interface Opportunity {
  /** Internal identifier (uuid). */
  id: string;
  /** Buyer-side reference (OCDS tenderID). */
  reference: string;
  title: string;
  description?: string;
  /** Procuring entity / buyer name. */
  client: string;
  location?: string;
  province?: string;
  category?: OpportunityCategory;
  /** ISO-8601 closing date/time for submissions. */
  closingDate: string;
  /** ISO-8601 publication date, when known. */
  publishedDate?: string;
  /** Ingestion source, e.g. "OCDS". */
  source: "OCDS" | string;
  sourceUrl?: string;
  documentUrls: string[];
  /** Human-readable estimate, e.g. "1500000 ZAR". */
  estimatedValue?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Capability-fit score, 0-100. */
  fitScore: number;
  fitReason?: string;
  /** Stable sha256 dedup hash of reference|title|client|closingDate. */
  hash: string;
  /** ISO-8601 timestamp of ingestion. */
  ingestedAt: string;
  /** ISO-8601 timestamp when a digest email including this record was sent. */
  notifiedAt?: string;
  status: OpportunityStatus;
}

// ---------------------------------------------------------------------------
// Runtime validators (pure TS, no new deps)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}

/** Structural check for the eTenders OCDS release shape. */
export function isOcdsRelease(value: unknown): value is OcdsRelease {
  if (!isRecord(value)) return false;
  // Core fields must be present and string-typed.
  if (
    typeof value.id !== "string" ||
    typeof value.tenderID !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.date !== "string"
  ) {
    return false;
  }

  const {
    procuringEntity,
    tenderPeriod,
    tender,
    documents,
    classification,
    mainProcurementLocation,
    address,
  } = value;

  if (!isRecord(procuringEntity) || typeof procuringEntity.name !== "string") {
    return false;
  }
  if (procuringEntity.contactPoint !== undefined) {
    if (!isRecord(procuringEntity.contactPoint)) return false;
    if (
      !optionalString(procuringEntity.contactPoint.email) ||
      !optionalString(procuringEntity.contactPoint.telephone)
    ) {
      return false;
    }
  }

  if (tenderPeriod !== undefined) {
    if (!isRecord(tenderPeriod) || !optionalString(tenderPeriod.endDate)) return false;
  }

  if (tender !== undefined) {
    if (!isRecord(tender)) return false;
    if (tender.value !== undefined) {
      if (!isRecord(tender.value)) return false;
      if (!optionalNumber(tender.value.amount) || !optionalString(tender.value.currency)) {
        return false;
      }
    }
  }

  if (documents !== undefined) {
    if (!Array.isArray(documents)) return false;
    for (const doc of documents) {
      if (!isRecord(doc) || typeof doc.url !== "string" || !optionalString(doc.title)) {
        return false;
      }
    }
  }

  if (classification !== undefined) {
    if (!isRecord(classification) || !optionalString(classification.scheme)) return false;
  }

  if (mainProcurementLocation !== undefined) {
    if (!isRecord(mainProcurementLocation) || !optionalString(mainProcurementLocation.name)) {
      return false;
    }
  }

  if (address !== undefined) {
    if (!isRecord(address) || !optionalString(address.region)) return false;
  }

  return true;
}

export function isOpportunityCategory(value: unknown): value is OpportunityCategory {
  return (
    typeof value === "string" &&
    (OPPORTUNITY_CATEGORIES as readonly string[]).includes(value)
  );
}

/** Structural check for the internal Opportunity model. */
export function isOpportunity(value: unknown): value is Opportunity {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.reference !== "string" ||
    typeof value.title !== "string" ||
    typeof value.client !== "string" ||
    typeof value.closingDate !== "string" ||
    typeof value.source !== "string" ||
    typeof value.fitScore !== "number" ||
    typeof value.hash !== "string" ||
    typeof value.ingestedAt !== "string"
  ) {
    return false;
  }
  if (value.status !== "active" && value.status !== "closed") return false;
  if (!Array.isArray(value.documentUrls)) return false;
  if (!value.documentUrls.every((url) => typeof url === "string")) return false;
  if (value.category !== undefined && !isOpportunityCategory(value.category)) return false;
  if (
    !optionalString(value.description) ||
    !optionalString(value.location) ||
    !optionalString(value.province) ||
    !optionalString(value.publishedDate) ||
    !optionalString(value.sourceUrl) ||
    !optionalString(value.estimatedValue) ||
    !optionalString(value.contactEmail) ||
    !optionalString(value.contactPhone) ||
    !optionalString(value.fitReason) ||
    !optionalString(value.notifiedAt)
  ) {
    return false;
  }
  return true;
}
