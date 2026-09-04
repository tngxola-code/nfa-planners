/**
 * Deterministic, rules-based capability-fit scorer for NFA Planners.
 *
 * Scores a tender against NFA's capability profile using weighted keyword
 * matching. Pure and offline: no I/O, no randomness, no clock access, so it
 * is trivially unit-testable.
 *
 * Expanded to cover all NFA service areas.
 */

/** NFA's core capability profile – aligned with the 16-capability model. */
export const NFA_CAPABILITIES = [
  "Town and Regional Planning",
  "Spatial Planning",
  "Land Surveying and Geomatics",
  "GIS and Geospatial Intelligence",
  "Township Establishment",
  "Human Settlements",
  "Development Planning and IDP",
  "Land Audits and Advisory",
  "Infrastructure Planning",
  "Project Management",
  "Policy and Public Participation",
  "Environmental and Resilience",
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
    capability: "Spatial Planning",
    keywords: [
      "spatial planning",
      "spatial development framework",
      "sdf",
      "precinct plan",
      "nodal development",
      "land use management",
      "land use scheme",
      "wall-to-wall scheme",
    ],
  },
  {
    capability: "Land Surveying and Geomatics",
    keywords: [
      "land surveying",
      "land surveyor",
      "cadastral",
      "geomatics",
      "topographic survey",
      "pegging",
      "beacon",
      "sectional title survey",
      "general plan",
    ],
  },
  {
    capability: "GIS and Geospatial Intelligence",
    keywords: [
      "gis",
      "geographic information system",
      "geospatial",
      "spatial data",
      "aerial photography",
      "orthophoto",
      "lidar",
      "remote sensing",
      "digital mapping",
      "data capturing of properties",
    ],
  },
  {
    capability: "Township Establishment",
    keywords: [
      "township establishment",
      "township register",
      "subdivision",
      "consolidation",
      "rezoning",
      "land use application",
      "spluma",
      "removal of restrictive conditions",
      "street closure",
      "servitude",
    ],
  },
  {
    capability: "Human Settlements",
    keywords: [
      "human settlement",
      "informal settlement",
      "upgrading of informal settlements",
      "uisp",
      "housing sector plan",
      "settlement upgrading",
      "in-situ upgrading",
      "title deed",
      "security of tenure",
    ],
  },
  {
    capability: "Development Planning and IDP",
    keywords: [
      "integrated development plan",
      "idp",
      "development framework",
      "local economic development",
      "growth and development strategy",
      "small town regeneration",
      "small town rehabilitation",
      "rural development",
    ],
  },
  {
    capability: "Land Audits and Advisory",
    keywords: [
      "land audit",
      "land availability",
      "land release",
      "state land",
      "due diligence",
      "highest and best use",
      "feasibility study",
      "land assembly",
      "property portfolio",
    ],
  },
  {
    capability: "Infrastructure Planning",
    keywords: [
      "infrastructure planning",
      "infrastructure development",
      "bulk infrastructure",
      "bulk services",
      "stormwater",
      "sanitation",
      "water services",
      "roads",
      "electrification",
      "housing",
    ],
  },
  {
    capability: "Project Management",
    keywords: [
      "programme management",
      "project management",
      "professional service provider",
      "panel of consultants",
      "panel of professional",
      "built environment professionals",
    ],
  },
  {
    capability: "Policy and Public Participation",
    keywords: [
      "policy development",
      "policy review",
      "public participation",
      "stakeholder engagement",
      "by-law",
      "sector plan",
    ],
  },
  {
    capability: "Environmental and Resilience",
    keywords: [
      "environmental planning",
      "climate resilience",
      "flood risk",
      "disaster management",
      "green infrastructure",
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

/** Location patterns for Eastern Cape and National. */
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

  const clamped = Math.max(0, Math.min(100, score));

  const reason =
    reasonParts.length === 0
      ? "No capability keywords, government client or location signals matched. Score 0/100."
      : `Matched: ${reasonParts.join("; ")}. Score ${clamped}/100 (threshold ${FIT_THRESHOLD}).`;

  return { score: clamped, reason, matchedCapabilities };
}
