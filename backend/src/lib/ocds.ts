export interface OcdsDocument {
  id?: string;
  title?: string;
  url?: string;
  documentType?: string;
  format?: string;
  datePublished?: string;
}

export interface OcdsParty {
  id?: string;
  name?: string;
  roles?: string[];
}

export interface OcdsAward {
  id?: string;
  status?: string;
  date?: string;
}

export interface OcdsRelease {
  ocid: string;
  id?: string;
  date?: string;
  tender?: {
    title?: string;
    description?: string | null;
    status?: string;
    value?: {
      amount?: number;
      currency?: string;
    };
    tenderPeriod?: {
      startDate?: string;
      endDate?: string;
    };
    procurementMethod?: string;
    documents?: OcdsDocument[];
  };
  parties?: OcdsParty[];
  buyer?: {
    id?: string;
    name?: string;
  };
  awards?: OcdsAward[];
}

export interface ParsedTenderDocument {
  sourceDocumentId: string | null;
  name: string;
  docType: string | null;
  url: string;
  publishedAt: Date | null;
}

export interface ParsedTender {
  ocid: string;
  sourceReleaseId: string | null;
  title: string;
  buyer: string;
  valueZar: string | null;
  description: string | null;
  publishedAt: Date | null;
  closingAt: Date | null;
  awardedAt: Date | null;
  cancelledAt: Date | null;
  compulsoryBriefing: boolean;
  documents: ParsedTenderDocument[];
  sourceUpdatedAt: Date | null;
}

export interface IngestConfig {
  matchKeywords: string[];
  isNewWindowHours: number;
  now?: Date;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function earliestDate(values: Array<Date | null>): Date | null {
  const dates = values.filter((value): value is Date => value !== null);

  if (!dates.length) return null;

  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function parseZarValue(
  value:
    | {
        amount?: number;
        currency?: string;
      }
    | undefined,
): string | null {
  if (
    value?.currency?.toUpperCase() !== "ZAR" ||
    typeof value.amount !== "number" ||
    !Number.isFinite(value.amount) ||
    value.amount < 0
  ) {
    return null;
  }

  return String(value.amount);
}

function resolveBuyer(release: OcdsRelease): string {
  const referencedParty = release.buyer?.id
    ? release.parties?.find((party) => party.id === release.buyer?.id)
    : undefined;

  return (
    release.buyer?.name?.trim() ||
    referencedParty?.name?.trim() ||
    release.parties
      ?.find((party) => party.roles?.includes("buyer"))
      ?.name?.trim() ||
    "Unknown buyer"
  );
}

function normalizeHttpUrl(value: string | undefined): string | null {
  const candidate = value?.trim();

  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

function parseDocuments(
  documents: OcdsDocument[] | undefined,
): ParsedTenderDocument[] {
  const unique = new Map<string, ParsedTenderDocument>();

  for (const document of documents ?? []) {
    const url = normalizeHttpUrl(document.url);

    if (!url || unique.has(url)) continue;

    unique.set(url, {
      sourceDocumentId: document.id?.trim() || null,
      name: document.title?.trim() || document.id?.trim() || "Document",
      docType: document.documentType?.trim() || null,
      url,
      publishedAt: parseDate(document.datePublished),
    });
  }

  return [...unique.values()];
}

export function parseRelease(
  release: OcdsRelease,
  _config: IngestConfig,
): ParsedTender {
  const ocid = release.ocid?.trim();

  if (!ocid) {
    throw new Error("OCDS release is missing a valid ocid");
  }

  const tender = release.tender ?? {};
  const sourceUpdatedAt = parseDate(release.date);

  const awardedAt = earliestDate(
    (release.awards ?? [])
      .filter((award) => award.status === "active")
      .map((award) => parseDate(award.date)),
  );

  const text = `${tender.title ?? ""} ${tender.description ?? ""}`;

  const compulsoryBriefing =
    /\b(compulsory|mandatory)\b/i.test(text) &&
    /\b(briefing|site meeting|clarification meeting)\b/i.test(text);

  return {
    ocid,
    sourceReleaseId: release.id?.trim() || null,
    title: tender.title?.trim() || "Untitled tender",
    buyer: resolveBuyer(release),
    valueZar: parseZarValue(tender.value),
    description: tender.description?.trim() || null,
    publishedAt: parseDate(tender.tenderPeriod?.startDate) ?? sourceUpdatedAt,
    closingAt: parseDate(tender.tenderPeriod?.endDate),
    awardedAt,
    cancelledAt: tender.status === "cancelled" ? sourceUpdatedAt : null,
    compulsoryBriefing,
    documents: parseDocuments(tender.documents),
    sourceUpdatedAt,
  };
}

export function isMatch(parsed: ParsedTender, config: IngestConfig): boolean {
  const text = `${parsed.title} ${parsed.description ?? ""}`
    .normalize("NFKC")
    .toLowerCase();

  return config.matchKeywords.some((keyword) => {
    const normalized = keyword.normalize("NFKC").trim().toLowerCase();

    return normalized.length > 0 && text.includes(normalized);
  });
}

export function isTenderNew(
  publishedAt: Date | null,
  config: IngestConfig,
): boolean {
  if (!publishedAt) return false;

  const now = config.now ?? new Date();
  const ageMs = now.getTime() - publishedAt.getTime();

  return ageMs >= 0 && ageMs <= config.isNewWindowHours * 3_600_000;
}

export function makeIngestConfig(
  env: NodeJS.ProcessEnv = process.env,
): IngestConfig {
  const configuredWindow = Number(env.INGEST_NEW_WINDOW_HOURS ?? 48);

  return {
    matchKeywords: (
      env.INGEST_MATCH_KEYWORDS ??
      "spatial planning,gis,survey,town planning,settlement,infrastructure,land use"
    )
      .split(",")
      .map((value) => value.normalize("NFKC").trim().toLowerCase())
      .filter(Boolean),
    isNewWindowHours:
      Number.isFinite(configuredWindow) && configuredWindow > 0
        ? configuredWindow
        : 48,
  };
}
