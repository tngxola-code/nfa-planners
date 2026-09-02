/**
 * Normaliser: maps eTenders OCDS releases onto the internal Opportunity
 * domain model.
 *
 * Releases are dropped (return null) when they:
 *  - lack a required field (reference / title / closingDate),
 *  - have a closing date in the past, or
 *  - score below FIT_THRESHOLD against NFA's capability profile.
 */

import { createHash, randomUUID } from "node:crypto";

import { FIT_THRESHOLD, scoreFit } from "../fit";
import type {
  Opportunity,
  OpportunityCategory,
  OcdsRelease,
} from "./types";

/**
 * Category keyword map. Checked against the OCDS classification scheme and
 * the title/description text; first match wins.
 */
const CATEGORY_KEYWORDS: Array<{ category: OpportunityCategory; keywords: string[] }> = [
  {
    category: "Town Planning",
    keywords: ["town planning", "town planner", "township establishment", "rezoning"],
  },
  {
    category: "Spatial Planning",
    keywords: ["spatial planning", "spatial development framework", "land use"],
  },
  { category: "GIS", keywords: ["gis", "geospatial", "geographic information", "mapping"] },
  { category: "Surveying", keywords: ["survey", "cadastral", "surveyor", "geomatics"] },
  {
    category: "Infrastructure",
    keywords: ["infrastructure", "roads", "stormwater", "water services", "sanitation"],
  },
  {
    category: "Human Settlements",
    keywords: ["human settlements", "housing"],
  },
];

function detectCategory(release: OcdsRelease): OpportunityCategory {
  const haystack = [
    release.classification?.scheme ?? "",
    release.title ?? "",
    release.description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category;
    }
  }
  return "Other";
}

function dedupHash(parts: {
  reference: string;
  title: string;
  client: string;
  closingDate: string;
}): string {
  return createHash("sha256")
    .update(
      `${parts.reference}|${parts.title}|${parts.client}|${parts.closingDate}`,
      "utf8",
    )
    .digest("hex");
}

/**
 * Normalise one OCDS release into an Opportunity, or return null when the
 * release should be dropped.
 *
 * @param now injectable clock for deterministic tests.
 */
export function normaliseRelease(
  release: OcdsRelease,
  now: Date = new Date(),
): Opportunity | null {
  const reference = release.tenderID?.trim();
  const title = release.title?.trim();
  const closingDateRaw = release.tenderPeriod?.endDate;

  // Required fields: reference, title, closingDate.
  if (!reference || !title || !closingDateRaw) {
    return null;
  }

  const closing = new Date(closingDateRaw);
  if (Number.isNaN(closing.getTime())) {
    return null;
  }
  // Past closing dates are dead opportunities.
  if (closing.getTime() <= now.getTime()) {
    return null;
  }

  const client = release.procuringEntity?.name?.trim() || "Unknown client";
  const description = release.description?.trim() || undefined;
  const province = release.address?.region?.trim() || undefined;
  const location =
    release.mainProcurementLocation?.name?.trim() || province;

  const fit = scoreFit({ title, description, client, location });
  if (fit.score < FIT_THRESHOLD) {
    return null;
  }

  const amount = release.tender?.value?.amount;
  const currency = release.tender?.value?.currency?.trim();
  const estimatedValue =
    typeof amount === "number" && Number.isFinite(amount)
      ? `${amount}${currency ? ` ${currency}` : ""}`.trim()
      : undefined;

  const documentUrls = (release.documents ?? [])
    .map((doc) => doc.url?.trim())
    .filter((url): url is string => Boolean(url));

  const published = release.date ? new Date(release.date) : null;
  const publishedDate =
    published && !Number.isNaN(published.getTime())
      ? published.toISOString()
      : undefined;

  const closingDate = closing.toISOString();

  return {
    id: randomUUID(),
    reference,
    title,
    description,
    client,
    location,
    province,
    category: detectCategory(release),
    closingDate,
    publishedDate,
    source: "OCDS",
    sourceUrl: documentUrls[0],
    documentUrls,
    estimatedValue,
    contactEmail: release.procuringEntity?.contactPoint?.email?.trim() || undefined,
    contactPhone: release.procuringEntity?.contactPoint?.telephone?.trim() || undefined,
    fitScore: fit.score,
    fitReason: fit.reason,
    hash: dedupHash({ reference, title, client, closingDate }),
    ingestedAt: now.toISOString(),
    status: "active",
  };
}
