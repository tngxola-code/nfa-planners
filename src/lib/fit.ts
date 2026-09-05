/**
 * Deterministic, rules-based capability-fit scorer for NFA Planners.
 *
 * Scores a tender against NFA's capability profile using weighted keyword
 * matching. Pure and offline: no I/O, no randomness, no clock access, so it
 * is trivially unit-testable.
 */

/** NFA's core capability profile. */
export const NFA_CAPABILITIES = [
  "Town and Regional Planning",
  "Land Surveying",
  "GIS / Geospatial Intelligence",
  "Infrastructure Planning",
] as const;

export type NfaCapability = (typeof NFA_CAPABILITIES)[number];

/**
 * Releases scoring below this threshold are dropped during normalisation.
 */
export const FIT_THRESHOLD = 40;

export interface FitInput {
  title: string;
  description?: string;
  client?: string;
  location?: string;
}

export interface FitResult {
  /** 0-100, clamped. */
  score: number;
  /** Human-readable explanation of how the score was reached. */
  reason: string;
  matchedCapabilities: string[];
}

interface CapabilityRule {
  capability: NfaCapability;
  keywords: string[];
}

const CAPABILITY_RULES: CapabilityRule[] = [
  {
    capability: "Town and Regional Planning",
    keywords: [
      "town planning",
      "town planner",
      "regional planning",
      "township establishment",
      "land use",
      "land-use",
      "rezoning",
      "subdivision",
      "precinct plan",
      "layout plan",
      "development application",
      "urban design",
      "urban planning",
    ],
  },
  {
    capability: "Land Surveying",
    keywords: [
      "land surveying",
      "land surveyor",
      "cadastral",
      "cadastre",
      "surveying",
      "surveyor",
      "topographic survey",
      "boundary survey",
      "geomatics",
      "site survey",
    ],
  },
  {
    capability: "GIS / Geospatial Intelligence",
    keywords: [
      "gis",
      "geographic information",
      "geospatial",
      "spatial data",
      "spatial planning",
      "spatial development framework",
      "mapping",
      "remote sensing",
      "aerial imagery",
    ],
  },
  {
    capability: "Infrastructure Planning",
    keywords: [
      "infrastructure planning",
      "infrastructure development",
      "bulk infrastructure",
      "bulk services",
      "infrastructure",
      "stormwater",
      "sanitation",
      "water services",
      "roads",
      "electrification",
      "human settlements",
      "housing",
    ],
  },
];

/** Government / institutional client indicators. */
const GOVERNMENT_CLIENT_PATTERNS = [
  "department",
  "ministry",
  "municipality",
  "municipal",
  "metro",
  "metropolitan",
  "provincial",
  "province",
  "national",
  "government",
  "authority",
  "agency",
  "district",
  "public works",
  "state",
];

const EASTERN_CAPE_PATTERNS = [
  "eastern cape",
  "east london",
  "gqeberha",
  "port elizabeth",
  "mthatha",
  "umtata",
  "buffalo city",
  "nelson mandela bay",
  "king williams town",
  "gqebherha",
  "butterworth",
  "kariega",
  "uitenhage",
];

const NATIONAL_PATTERNS = ["south africa", "national", "republic of south africa"];

/** Points per keyword found in the title. */
const TITLE_KEYWORD_POINTS = 20;
/** Points per keyword found only in the description. */
const DESCRIPTION_KEYWORD_POINTS = 8;
/** Maximum contribution of any single capability. */
const CAPABILITY_CAP = 40;
const GOVERNMENT_CLIENT_BONUS = 15;
const EASTERN_CAPE_BONUS = 10;
const NATIONAL_BONUS = 5;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word (phrase) match, case-insensitive. */
function containsKeyword(haystack: string, keyword: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(keyword).replace(/\s+/g, "\\s+")}\\b`, "i");
  return pattern.test(haystack);
}

function matchesAny(haystack: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => containsKeyword(haystack, keyword));
}

/**
 * Score how well a tender fits NFA's capability profile.
 */
export function scoreFit(input: FitInput): FitResult {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const client = input.client ?? "";
  const location = input.location ?? "";

  const reasonParts: string[] = [];
  const matchedCapabilities: string[] = [];
  let score = 0;

  for (const rule of CAPABILITY_RULES) {
    const titleHits = matchesAny(title, rule.keywords);
    const descriptionHits = matchesAny(description, rule.keywords).filter(
      (keyword) => !titleHits.includes(keyword),
    );
    const raw =
      titleHits.length * TITLE_KEYWORD_POINTS +
      descriptionHits.length * DESCRIPTION_KEYWORD_POINTS;
    if (raw > 0) {
      const contribution = Math.min(raw, CAPABILITY_CAP);
      score += contribution;
      matchedCapabilities.push(rule.capability);
      const found = [...titleHits, ...descriptionHits].join(", ");
      reasonParts.push(`${rule.capability} +${contribution} (${found})`);
    }
  }

  // Only add client/location bonuses if at least one capability matched.
  if (matchedCapabilities.length > 0) {
    // Government / institutional client bonus: check the client field first,
    // fall back to the title (buyers are often named in the title only).
    const clientHaystack = `${client} ${title}`;
    if (GOVERNMENT_CLIENT_PATTERNS.some((pattern) => containsKeyword(clientHaystack, pattern))) {
      score += GOVERNMENT_CLIENT_BONUS;
      reasonParts.push(`government/institutional client +${GOVERNMENT_CLIENT_BONUS}`);
    }

    // Location bonus: Eastern Cape presence outweighs a generic national one.
    const locationHaystack = `${location} ${title} ${description}`;
    if (EASTERN_CAPE_PATTERNS.some((pattern) => containsKeyword(locationHaystack, pattern))) {
      score += EASTERN_CAPE_BONUS;
      reasonParts.push(`Eastern Cape location +${EASTERN_CAPE_BONUS}`);
    } else if (NATIONAL_PATTERNS.some((pattern) => containsKeyword(locationHaystack, pattern))) {
      score += NATIONAL_BONUS;
      reasonParts.push(`national location +${NATIONAL_BONUS}`);
    }
  }

  const clamped = Math.max(0, Math.min(100, score));

  const reason =
    reasonParts.length === 0
      ? "No capability keywords, government client or location signals matched. Score 0/100."
      : `Matched: ${reasonParts.join("; ")}. Score ${clamped}/100 (threshold ${FIT_THRESHOLD}).`;

  return { score: clamped, reason, matchedCapabilities };
}
