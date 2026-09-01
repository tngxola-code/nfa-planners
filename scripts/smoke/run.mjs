/**
 * Offline smoke tests for the NFA Planners console.
 *
 * Dependency-light by design: plain Node, no network, no installed packages
 * required. Later branches (scheduler, ingestion) add their smoke checks here.
 *
 * Run with: npm run test:smoke
 */
import { readFile } from "node:fs/promises";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
  mkdtempSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------------------
// TS module loader for lib smoke tests.
//
// The smoke runner stays plain Node (no test framework); TypeScript sources
// under src/lib are transpiled to CommonJS in a temp dir using the locally
// installed `typescript` package, then loaded via require. Requires
// `npm ci` to have been run first.
// ---------------------------------------------------------------------------

let tsModulePromise;
async function loadTypeScript() {
  if (!tsModulePromise) {
    tsModulePromise = import("typescript").catch((err) => {
      throw new Error(
        `smoke tests for src/lib require the local typescript package (run npm ci): ${err.message}`,
      );
    });
  }
  return tsModulePromise;
}

const transpileCache = new Map();

/**
 * Transpile a TypeScript source file from src/ (plus its local imports) to
 * CJS in a shared temp dir and return the loaded module.
 */
async function loadTsModule(relPath) {
  const ts = await loadTypeScript();
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "nfa-smoke-ts-"));

  // Bare package imports in transpiled modules (e.g. `jose`) must resolve:
  // Node walks up from the temp dir, so link the repo's node_modules in.
  // Lazily-imported packages (resend, bcryptjs) stay lazy regardless.
  const nodeModulesLink = path.join(tmpRoot, "node_modules");
  if (!existsSync(nodeModulesLink) && existsSync(path.join(repoRoot, "node_modules"))) {
    symlinkSync(path.join(repoRoot, "node_modules"), nodeModulesLink, "junction");
  }

  const emit = (rel) => {
    const abs = path.join(repoRoot, rel);
    const source = readFileSync(abs, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: path.basename(rel),
    });
    // Mirror the layout relative to src/ so relative imports keep resolving.
    const dest = path.join(tmpRoot, path.relative(path.join(repoRoot, "src"), abs)).replace(/\.ts$/, ".js");
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, outputText);
    return dest;
  };

  // Emit every TS file under src/lib that the graph may need.
  const emitted = new Map();
  for (const rel of await listTsFiles(path.join(repoRoot, "src"))) {
    emitted.set(rel, emit(rel));
  }

  const requireFromTmp = createRequire(path.join(tmpRoot, "index.cjs"));
  const entry = emitted.get(relPath);
  if (!entry) throw new Error(`loadTsModule: no such source file: ${relPath}`);
  return requireFromTmp(entry);
}

async function listTsFiles(dir, prefix = "src") {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...(await listTsFiles(path.join(dir, entry.name), rel)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Cached loader so multiple tests share one transpile.
 */
async function lib(relPath) {
  if (!transpileCache.has(relPath)) {
    transpileCache.set(relPath, await loadTsModule(relPath));
  }
  return transpileCache.get(relPath);
}

test("package.json parses and declares required scripts", async () => {
  const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  for (const script of ["dev", "build", "start", "lint", "typecheck", "test:smoke"]) {
    assert.ok(pkg.scripts?.[script], `missing script: ${script}`);
  }
});

test("app skeleton files exist", () => {
  for (const rel of [
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/globals.css",
    "next.config.mjs",
    "tailwind.config.ts",
    "tsconfig.json",
    ".env.example",
  ]) {
    assert.ok(existsSync(path.join(repoRoot, rel)), `missing file: ${rel}`);
  }
});

test("root page redirects to /console", async () => {
  const page = await readFile(path.join(repoRoot, "src/app/page.tsx"), "utf8");
  assert.match(page, /redirect\(\s*["']\/console["']\s*\)/);
});

test(".env.example documents the eTenders OCDS base URL", async () => {
  const env = await readFile(path.join(repoRoot, ".env.example"), "utf8");
  assert.match(env, /ETENDERS_OCDS_BASE_URL=https:\/\/ocds-api\.etenders\.gov\.za/);
});

// ---------------------------------------------------------------------------
// Capability fit scoring (feat/007-capability-matching)
// ---------------------------------------------------------------------------

test("fit: town-planning tender scores above threshold", async () => {
  const { scoreFit, FIT_THRESHOLD } = await lib("src/lib/fit.ts");
  const result = scoreFit({
    title: "Appointment of a town planner for township establishment and rezoning",
    description: "Spatial development framework and land use management support.",
    client: "Department of Human Settlements",
    location: "Eastern Cape",
  });
  assert.ok(
    result.score >= FIT_THRESHOLD,
    `expected score >= ${FIT_THRESHOLD}, got ${result.score} (${result.reason})`,
  );
  assert.ok(result.matchedCapabilities.length > 0, "expected at least one matched capability");
});

test("fit: unrelated catering tender scores below threshold", async () => {
  const { scoreFit, FIT_THRESHOLD } = await lib("src/lib/fit.ts");
  const result = scoreFit({
    title: "Catering services for school nutrition programme",
    description: "Supply and delivery of cooked meals and refreshments.",
    client: "Makana Local Municipality",
    location: "Eastern Cape",
  });
  assert.ok(
    result.score < FIT_THRESHOLD,
    `expected score < ${FIT_THRESHOLD}, got ${result.score} (${result.reason})`,
  );
});

test("fit: reason string is non-empty when score > 0", async () => {
  const { scoreFit } = await lib("src/lib/fit.ts");
  const result = scoreFit({ title: "GIS mapping and cadastral survey services" });
  assert.ok(result.score > 0, `expected positive score, got ${result.score}`);
  assert.ok(result.reason.length > 0, "expected a non-empty reason string");
  assert.match(result.reason, /Score \d+\/100/);
});

test("fit: score is clamped to 0-100 and deterministic", async () => {
  const { scoreFit } = await lib("src/lib/fit.ts");
  const input = {
    title: "Town planning, GIS, land surveying and infrastructure planning panel",
    description:
      "Spatial planning, geospatial mapping, cadastral surveying, township establishment, " +
      "rezoning, bulk infrastructure, housing and human settlements work.",
    client: "Eastern Cape Provincial Government Department",
    location: "Eastern Cape, South Africa",
  };
  const first = scoreFit(input);
  const second = scoreFit(input);
  assert.equal(first.score, 100, `kitchen-sink input should clamp to 100, got ${first.score}`);
  assert.deepEqual(first, second, "scorer must be deterministic");
});

// ---------------------------------------------------------------------------
// OCDS ingestion: normaliser + client (feat/008-etenders-ocds-ingestion)
// ---------------------------------------------------------------------------

const NOW = new Date("2025-01-15T09:00:00.000Z");

function fixtureRelease(overrides = {}) {
  return {
    id: "ocds-abc123-001",
    tenderID: "EC/TP/2025/014",
    title: "Appointment of a town planner for township establishment",
    description: "Town planning, rezoning and spatial development framework support.",
    date: "2025-01-10T08:00:00Z",
    procuringEntity: {
      name: "Department of Human Settlements",
      contactPoint: { email: "tenders@ecdhS.gov.za".toLowerCase(), telephone: "+27 43 555 0100" },
    },
    tenderPeriod: { endDate: "2025-02-28T11:00:00Z" },
    tender: { value: { amount: 1500000, currency: "ZAR" } },
    documents: [
      { url: "https://www.etenders.gov.za/content/EC-TP-2025-014.pdf", title: "Bid document" },
    ],
    classification: { scheme: "CPV - town planning services" },
    mainProcurementLocation: { name: "East London" },
    address: { region: "Eastern Cape" },
    ...overrides,
  };
}

test("normalise: fixture release maps to expected Opportunity", async () => {
  const { normaliseRelease } = await lib("src/lib/ocds/normalise.ts");
  const { isOpportunity } = await lib("src/lib/ocds/types.ts");
  const opportunity = normaliseRelease(fixtureRelease(), NOW);
  assert.ok(opportunity, "expected a normalised opportunity");
  assert.equal(opportunity.reference, "EC/TP/2025/014");
  assert.equal(opportunity.client, "Department of Human Settlements");
  assert.equal(opportunity.closingDate, "2025-02-28T11:00:00.000Z");
  assert.equal(opportunity.publishedDate, "2025-01-10T08:00:00.000Z");
  assert.equal(opportunity.estimatedValue, "1500000 ZAR");
  assert.equal(opportunity.province, "Eastern Cape");
  assert.equal(opportunity.location, "East London");
  assert.equal(opportunity.category, "Town Planning");
  assert.equal(opportunity.contactEmail, "tenders@ecdhs.gov.za");
  assert.equal(opportunity.contactPhone, "+27 43 555 0100");
  assert.deepEqual(opportunity.documentUrls, [
    "https://www.etenders.gov.za/content/EC-TP-2025-014.pdf",
  ]);
  assert.equal(opportunity.source, "OCDS");
  assert.equal(opportunity.status, "active");
  assert.equal(opportunity.ingestedAt, NOW.toISOString());
  assert.match(opportunity.id, /^[0-9a-f-]{36}$/);
  assert.match(opportunity.hash, /^[0-9a-f]{64}$/);
  assert.ok(isOpportunity(opportunity), "result must satisfy the Opportunity validator");
});

test("normalise: low-fit release returns null", async () => {
  const { normaliseRelease } = await lib("src/lib/ocds/normalise.ts");
  const result = normaliseRelease(
    fixtureRelease({
      title: "Catering services for school nutrition programme",
      description: "Supply and delivery of cooked meals.",
      classification: { scheme: "CPV - catering" },
      procuringEntity: { name: "Community Hall Committee" },
      address: { region: "Western Cape" },
      mainProcurementLocation: { name: "Cape Town" },
    }),
    NOW,
  );
  assert.equal(result, null, "low-fit release must be dropped");
});

test("normalise: missing closingDate returns null", async () => {
  const { normaliseRelease } = await lib("src/lib/ocds/normalise.ts");
  assert.equal(normaliseRelease(fixtureRelease({ tenderPeriod: undefined }), NOW), null);
  assert.equal(normaliseRelease(fixtureRelease({ tenderPeriod: {} }), NOW), null);
});

test("normalise: past closingDate returns null", async () => {
  const { normaliseRelease } = await lib("src/lib/ocds/normalise.ts");
  const result = normaliseRelease(
    fixtureRelease({ tenderPeriod: { endDate: "2025-01-01T00:00:00Z" } }),
    NOW,
  );
  assert.equal(result, null, "expired release must be dropped");
});

test("normalise: hash is stable across runs", async () => {
  const { normaliseRelease } = await lib("src/lib/ocds/normalise.ts");
  const first = normaliseRelease(fixtureRelease(), NOW);
  const second = normaliseRelease(fixtureRelease(), NOW);
  assert.ok(first && second);
  assert.equal(first.hash, second.hash);
  assert.notEqual(first.id, second.id, "uuid should be fresh per opportunity");
});

test("client: fetchOcdsReleases returns releases from an injected fetch", async () => {
  const { fetchOcdsReleases } = await lib("src/lib/ocds/client.ts");
  const fakeFetch = async (url) => {
    assert.match(String(url), /^https:\/\/ocds\.example\.test\/releases\?limit=5$/);
    return new Response(JSON.stringify({ releases: [fixtureRelease()] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const releases = await fetchOcdsReleases({
    baseUrl: "https://ocds.example.test",
    limit: 5,
    fetchImpl: fakeFetch,
  });
  assert.equal(releases.length, 1);
  assert.equal(releases[0].tenderID, "EC/TP/2025/014");
});

test("client: non-2xx response throws with status", async () => {
  const { fetchOcdsReleases } = await lib("src/lib/ocds/client.ts");
  const fakeFetch = async () => new Response("boom", { status: 503 });
  await assert.rejects(
    () => fetchOcdsReleases({ baseUrl: "https://ocds.example.test", fetchImpl: fakeFetch }),
    /status 503/,
  );
});

test("client: malformed JSON throws", async () => {
  const { fetchOcdsReleases } = await lib("src/lib/ocds/client.ts");
  const fakeFetch = async () =>
    new Response("this is not json", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  await assert.rejects(
    () => fetchOcdsReleases({ baseUrl: "https://ocds.example.test", fetchImpl: fakeFetch }),
    /not valid JSON/,
  );
});

test("client: unreachable host throws (no external network)", async () => {
  const { fetchOcdsReleases } = await lib("src/lib/ocds/client.ts");
  await assert.rejects(
    () =>
      fetchOcdsReleases({ baseUrl: "http://127.0.0.1:1", timeoutMs: 1000 }),
    /failed/,
  );
});

// ---------------------------------------------------------------------------
// JSON persistence: repositories (feat/006-opportunity-persistence)
// ---------------------------------------------------------------------------

function makeOpportunity(overrides = {}) {
  return {
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
    reference: "EC/TP/2025/014",
    title: "Appointment of a town planner for township establishment",
    description: "Town planning and rezoning support.",
    client: "Department of Human Settlements",
    location: "East London",
    province: "Eastern Cape",
    category: "Town Planning",
    closingDate: "2025-02-28T11:00:00.000Z",
    publishedDate: "2025-01-10T08:00:00.000Z",
    source: "OCDS",
    sourceUrl: "https://www.etenders.gov.za/content/EC-TP-2025-014.pdf",
    documentUrls: ["https://www.etenders.gov.za/content/EC-TP-2025-014.pdf"],
    estimatedValue: "1500000 ZAR",
    contactEmail: "tenders@ecdhs.gov.za",
    contactPhone: "+27 43 555 0100",
    fitScore: 75,
    fitReason: "Score 75/100",
    hash: "hash-a",
    ingestedAt: "2025-01-15T09:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

function tempDataDir() {
  return mkdtempSync(path.join(os.tmpdir(), "nfa-data-"));
}

test("store: upsert dedups by hash (insert / skip / update)", async () => {
  const {
    upsertOpportunities,
    listOpportunities,
    getOpportunityByReference,
  } = await lib("src/server/repositories/opportunities.ts");
  const dataDir = tempDataDir();
  const opts = { dataDir };

  // First upsert inserts both records.
  const first = await upsertOpportunities(
    [makeOpportunity(), makeOpportunity({ id: "22222222-2222-4222-8222-222222222222", reference: "EC/GIS/2025/001", title: "GIS mapping services", hash: "hash-b", closingDate: "2025-03-15T11:00:00.000Z", category: "GIS" })],
    opts,
  );
  assert.deepEqual(first, { inserted: 2, updated: 0, skippedDuplicates: 0 });

  // Re-upsert identical content -> all skipped.
  const second = await upsertOpportunities(
    [
      makeOpportunity({ id: "33333333-3333-4333-8333-333333333333", ingestedAt: "2025-01-16T09:00:00.000Z" }),
      makeOpportunity({ reference: "EC/GIS/2025/001", title: "GIS mapping services", hash: "hash-b", closingDate: "2025-03-15T11:00:00.000Z", category: "GIS" }),
    ],
    opts,
  );
  assert.deepEqual(second, { inserted: 0, updated: 0, skippedDuplicates: 2 });

  // Changed content under the same hash -> updated, identity preserved.
  const third = await upsertOpportunities(
    [makeOpportunity({ fitScore: 92, fitReason: "Score 92/100" })],
    opts,
  );
  assert.deepEqual(third, { inserted: 0, updated: 1, skippedDuplicates: 0 });

  const stored = await getOpportunityByReference("EC/TP/2025/014", opts);
  assert.ok(stored);
  assert.equal(stored.fitScore, 92, "updated field must be stored");
  assert.equal(
    stored.id,
    "11111111-1111-4111-8111-111111111111",
    "original id must be preserved on update",
  );
  assert.equal(
    stored.ingestedAt,
    "2025-01-15T09:00:00.000Z",
    "original ingestedAt must be preserved on update",
  );
  assert.equal((await listOpportunities({}, opts)).length, 2);
});

test("store: listOpportunities filters and sorts by closingDate asc", async () => {
  const { upsertOpportunities, listOpportunities } = await lib(
    "src/server/repositories/opportunities.ts",
  );
  const dataDir = tempDataDir();
  const opts = { dataDir };

  await upsertOpportunities(
    [
      makeOpportunity({ reference: "REF-LATE", hash: "h-late", closingDate: "2025-04-01T11:00:00.000Z", fitScore: 85 }),
      makeOpportunity({ reference: "REF-SOON", hash: "h-soon", title: "GIS mapping services", closingDate: "2025-02-01T11:00:00.000Z", category: "GIS", fitScore: 50 }),
      makeOpportunity({ reference: "REF-CLOSED", hash: "h-closed", closingDate: "2025-03-01T11:00:00.000Z", status: "closed", fitScore: 90 }),
    ],
    opts,
  );

  const all = await listOpportunities({}, opts);
  assert.deepEqual(
    all.map((o) => o.reference),
    ["REF-SOON", "REF-CLOSED", "REF-LATE"],
    "default sort must be closingDate ascending",
  );

  const activeOnly = await listOpportunities({ status: "active" }, opts);
  assert.deepEqual(activeOnly.map((o) => o.reference), ["REF-SOON", "REF-LATE"]);

  const gisOnly = await listOpportunities({ category: "GIS" }, opts);
  assert.deepEqual(gisOnly.map((o) => o.reference), ["REF-SOON"]);

  const highFit = await listOpportunities({ minFitScore: 80 }, opts);
  assert.deepEqual(highFit.map((o) => o.reference), ["REF-CLOSED", "REF-LATE"]);

  const search = await listOpportunities({ search: "gis mapping" }, opts);
  assert.deepEqual(search.map((o) => o.reference), ["REF-SOON"]);
});

test("store: countOpportunities aggregates dashboard counts", async () => {
  const { upsertOpportunities, countOpportunities } = await lib(
    "src/server/repositories/opportunities.ts",
  );
  const dataDir = tempDataDir();
  const now = new Date("2025-01-15T09:00:00.000Z");
  const opts = { dataDir, now };

  await upsertOpportunities(
    [
      // active, ingested today, closing in 3 days, high match
      makeOpportunity({ hash: "c-1", reference: "C-1", fitScore: 85, closingDate: "2025-01-18T09:00:00.000Z" }),
      // active, ingested today, closing in 30 days, low-ish match
      makeOpportunity({ hash: "c-2", reference: "C-2", fitScore: 60, closingDate: "2025-02-14T09:00:00.000Z" }),
      // active, ingested yesterday, closing in 8 days (not closing-soon), high match
      makeOpportunity({ hash: "c-3", reference: "C-3", fitScore: 90, closingDate: "2025-01-23T09:00:00.000Z", ingestedAt: "2025-01-14T09:00:00.000Z" }),
      // closed, high match (must not count toward active/closingSoon/highMatch)
      makeOpportunity({ hash: "c-4", reference: "C-4", fitScore: 95, closingDate: "2025-01-16T09:00:00.000Z", status: "closed" }),
    ],
    opts,
  );

  const counts = await countOpportunities(opts);
  assert.deepEqual(counts, { active: 3, newToday: 3, closingSoon: 1, highMatch: 2 });
});

test("store: notification repository dedups by stable key", async () => {
  const { listNotifications, recordNotification, hasBeenNotified } = await lib(
    "src/server/repositories/notifications.ts",
  );
  const dataDir = tempDataDir();
  const opts = { dataDir };

  assert.equal(await hasBeenNotified("hash-a", opts), false);

  const record = {
    id: "notif-1",
    opportunityId: "11111111-1111-4111-8111-111111111111",
    reference: "EC/TP/2025/014",
    dedupKey: "hash-a",
    channel: "email",
    status: "sent",
    recipient: "planners@nfaplanners.com",
    sentAt: "2025-01-15T10:00:00.000Z",
    createdAt: "2025-01-15T10:00:00.000Z",
  };
  await recordNotification(record, opts);

  assert.equal(await hasBeenNotified("hash-a", opts), true);
  assert.equal(await hasBeenNotified("hash-b", opts), false);

  // A failed attempt for another opportunity must not count as notified.
  await recordNotification(
    {
      ...record,
      id: "notif-2",
      reference: "EC/GIS/2025/001",
      dedupKey: "hash-b",
      status: "failed",
      sentAt: undefined,
      error: "provider 503",
    },
    opts,
  );
  assert.equal(await hasBeenNotified("hash-b", opts), false);

  const all = await listNotifications(opts);
  assert.equal(all.length, 2);
  assert.equal(all[0].id, "notif-1");
  assert.equal(all[1].status, "failed");
});

// ---------------------------------------------------------------------------
// Email digest notifications (feat/009-email-notifications)
// ---------------------------------------------------------------------------

const DIGEST_NOW = new Date("2025-01-15T09:00:00.000Z");

test("digest: subject, sorting, links, badge and urgent closing render", async () => {
  const { renderDigestEmail } = await lib("src/server/notifications/digest.ts");

  const lowerFit = makeOpportunity({
    reference: "EC/GIS/2025/001",
    title: "GIS mapping & cadastral <survey> services",
    hash: "d-1",
    fitScore: 60,
    closingDate: "2025-01-16T09:00:00.000Z", // 1 day out -> urgent red
    location: "Makhanda",
  });
  const highFit = makeOpportunity({
    reference: "EC/TP/2025/014",
    fitScore: 92,
    closingDate: "2025-02-28T11:00:00.000Z",
  });

  const { subject, html, text } = renderDigestEmail([lowerFit, highFit], DIGEST_NOW);

  assert.match(subject, /\[NFA\] 2 new opportunities — /);
  assert.ok(
    subject.includes("town planner"),
    `subject should lead with the top-fit title, got: ${subject}`,
  );

  // Sorted by fitScore desc: high-fit row must appear before the lower-fit one.
  assert.ok(
    html.indexOf("EC/TP/2025/014") < html.indexOf("EC/GIS/2025/001"),
    "rows must be sorted by fitScore descending",
  );

  // Console links and references present.
  assert.match(html, /https:\/\/console\.nfaplanners\.com\/opportunities\/EC%2FTP%2F2025%2F014/);
  assert.match(html, /https:\/\/console\.nfaplanners\.com\/opportunities\/EC%2FGIS%2F2025%2F001/);

  // High-match badge only on the >=80 item.
  assert.equal(html.match(/High Match/g).length, 1, "expected exactly one High Match badge");

  // Urgent closing (<=3 days) rendered red; the non-urgent one is not.
  assert.match(html, /#B3261E/);

  // HTML escaping of title content.
  assert.ok(html.includes("GIS mapping &amp; cadastral &lt;survey&gt; services"));
  assert.ok(!html.includes("<survey>"), "raw HTML from titles must be escaped");

  // Plain-text fallback contains the essentials.
  assert.match(text, /2 new opportunities/);
  assert.match(text, /EC\/TP\/2025\/014/);
  assert.match(text, /\[HIGH MATCH\]/);
});

test("digest: empty list renders a graceful empty state", async () => {
  const { renderDigestEmail } = await lib("src/server/notifications/digest.ts");
  const { subject, html, text } = renderDigestEmail([], DIGEST_NOW);
  assert.equal(subject, "[NFA] No new opportunities");
  assert.match(html, /No new opportunities/);
  assert.match(text, /No new opportunities/);
});

test("digest: sendDigest skips when nothing is eligible (no API key needed)", async () => {
  const { sendDigest } = await lib("src/server/notifications/sendDigest.ts");
  const { upsertOpportunities, markNotified } = await lib(
    "src/server/repositories/opportunities.ts",
  );
  const dataDir = tempDataDir();
  const opts = { dataDir };

  await upsertOpportunities(
    [
      makeOpportunity({ hash: "s-1", reference: "S-1" }),
      makeOpportunity({ hash: "s-2", reference: "S-2" }),
    ],
    opts,
  );
  await markNotified(["s-1", "s-2"], "2025-01-15T10:00:00.000Z", opts);

  const savedKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const result = await sendDigest("planners@nfaplanners.com", opts);
    assert.deepEqual(result, { sent: 0, skipped: true });
  } finally {
    if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey;
  }
});

test("digest: sendDigest skips when notifications already sent for the hash", async () => {
  const { sendDigest } = await lib("src/server/notifications/sendDigest.ts");
  const { upsertOpportunities } = await lib(
    "src/server/repositories/opportunities.ts",
  );
  const { recordNotification } = await lib(
    "src/server/repositories/notifications.ts",
  );
  const dataDir = tempDataDir();
  const opts = { dataDir };

  const opp = makeOpportunity({ hash: "s-9", reference: "S-9" });
  await upsertOpportunities([opp], opts);
  // A prior digest already covered this opportunity under a previous id;
  // notifiedAt is absent (e.g. record predates the flag) but the dedup key hit
  // must still suppress a resend.
  await recordNotification(
    {
      id: "n-old",
      opportunityId: "old-id",
      reference: "S-9",
      dedupKey: "s-9",
      channel: "email",
      status: "sent",
      recipient: "planners@nfaplanners.com",
      sentAt: "2025-01-14T06:00:00.000Z",
      createdAt: "2025-01-14T06:00:00.000Z",
    },
    opts,
  );

  const savedKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const result = await sendDigest("planners@nfaplanners.com", opts);
    assert.deepEqual(result, { sent: 0, skipped: true });
  } finally {
    if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey;
  }
});

test("digest: markNotified stamps records and is reflected in listing", async () => {
  const { upsertOpportunities, markNotified, listOpportunities } = await lib(
    "src/server/repositories/opportunities.ts",
  );
  const dataDir = tempDataDir();
  const opts = { dataDir };

  await upsertOpportunities(
    [makeOpportunity({ hash: "m-1" }), makeOpportunity({ hash: "m-2", reference: "M-2" })],
    opts,
  );
  const marked = await markNotified(["m-2"], "2025-01-15T12:00:00.000Z", opts);
  assert.equal(marked, 1);

  const all = await listOpportunities({}, opts);
  const byHash = Object.fromEntries(all.map((o) => [o.hash, o]));
  assert.equal(byHash["m-1"].notifiedAt, undefined);
  assert.equal(byHash["m-2"].notifiedAt, "2025-01-15T12:00:00.000Z");

  // Content update on a notified record must keep the stamp (no re-email).
  await upsertOpportunities(
    [makeOpportunity({ hash: "m-2", reference: "M-2", fitScore: 99, fitReason: "Score 99/100" })],
    opts,
  );
  const after = await listOpportunities({}, opts);
  const updated = after.find((o) => o.hash === "m-2");
  assert.equal(updated.fitScore, 99);
  assert.equal(updated.notifiedAt, "2025-01-15T12:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Ingest runner (feat/010-opportunity-scheduler)
// ---------------------------------------------------------------------------

/** Release fixture with a genuinely future closing date (real-clock safe). */
const FUTURE_CLOSING = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
function futureRelease(overrides = {}) {
  // NOTE: one shared closing timestamp — closingDate feeds the dedup hash, so
  // repeated calls must produce identical opportunities.
  return fixtureRelease({ tenderPeriod: { endDate: FUTURE_CLOSING }, ...overrides });
}

test("ingest: happy path normalises, persists and reports", async () => {
  const { runIngest } = await lib("src/server/ingest/runIngest.ts");
  const { listOpportunities } = await lib("src/server/repositories/opportunities.ts");
  const dataDir = tempDataDir();

  const report = await runIngest({
    dataDir,
    notify: false,
    fetchReleases: async () => [
      futureRelease(),
      futureRelease({
        id: "ocds-abc123-002",
        tenderID: "EC/CATER/2025/099",
        title: "Catering services for school nutrition programme",
        description: "Supply and delivery of cooked meals.",
        classification: { scheme: "CPV - catering" },
        procuringEntity: { name: "Community Hall Committee" },
      }),
    ],
  });

  assert.equal(report.fetched, 2);
  assert.equal(report.normalised, 1);
  assert.equal(report.droppedLowFit, 1);
  assert.equal(report.inserted, 1);
  assert.equal(report.updated, 0);
  assert.equal(report.skippedDuplicates, 0);
  assert.deepEqual(report.notified, { sent: 0, skipped: true });
  assert.deepEqual(report.errors, []);
  assert.ok(report.startedAt && report.finishedAt);
  assert.ok(report.durationMs >= 0);

  const stored = await listOpportunities({}, { dataDir });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].reference, "EC/TP/2025/014");

  // Second run: identical content -> skippedDuplicates, nothing re-inserted.
  const again = await runIngest({
    dataDir,
    fetchReleases: async () => [futureRelease()],
  });
  assert.equal(again.inserted, 0);
  assert.equal(again.skippedDuplicates, 1);
  assert.equal((await listOpportunities({}, { dataDir })).length, 1);
});

test("ingest: fetch failure yields a report with errors, no throw", async () => {
  const { runIngest } = await lib("src/server/ingest/runIngest.ts");
  const dataDir = tempDataDir();

  const report = await runIngest({
    dataDir,
    fetchReleases: async () => {
      throw new Error("OCDS request failed with status 503");
    },
  });

  assert.equal(report.fetched, 0);
  assert.equal(report.normalised, 0);
  assert.equal(report.inserted, 0);
  assert.deepEqual(report.notified, { sent: 0, skipped: true });
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /fetch failed: OCDS request failed with status 503/);
});

test("ingest: per-release normalise crash is collected, not thrown", async () => {
  const { runIngest } = await lib("src/server/ingest/runIngest.ts");
  const dataDir = tempDataDir();

  const report = await runIngest({
    dataDir,
    fetchReleases: async () => [
      futureRelease(),
      { id: "ocds-broken", tenderID: 123 }, // malformed: trim() will throw
    ],
  });

  assert.equal(report.fetched, 2);
  assert.equal(report.normalised, 1, "good release still ingested");
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /normalise failed for release ocds-broken/);
});

test("ingest: notify=true captures send failure in report.errors", async () => {
  const { runIngest } = await lib("src/server/ingest/runIngest.ts");
  const dataDir = tempDataDir();

  const savedKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const report = await runIngest({
      dataDir,
      notify: true,
      recipient: "planners@nfaplanners.com",
      fetchReleases: async () => [futureRelease()],
    });
    assert.equal(report.inserted, 1);
    assert.deepEqual(report.notified, { sent: 0, skipped: true });
    assert.ok(
      report.errors.some((e) => /notification failed:.*RESEND_API_KEY/.test(e)),
      `expected RESEND_API_KEY failure in errors, got: ${JSON.stringify(report.errors)}`,
    );
  } finally {
    if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey;
  }
});

// ---------------------------------------------------------------------------
// Console authentication (feat/004-console-auth)
//
// Only the edge-safe modules are exercised here (config, session, returnTo).
// credentials.ts needs bcryptjs + real env and is covered by the login route.
// Test secrets are generated per run — never hardcode real-looking secrets.
// ---------------------------------------------------------------------------

function makeSessionSecret(bytes = 48) {
  return randomBytes(bytes).toString("base64");
}

async function withSessionSecret(secret, fn) {
  const saved = process.env.CONSOLE_SESSION_SECRET;
  if (secret === undefined) {
    delete process.env.CONSOLE_SESSION_SECRET;
  } else {
    process.env.CONSOLE_SESSION_SECRET = secret;
  }
  try {
    await fn();
  } finally {
    if (saved === undefined) {
      delete process.env.CONSOLE_SESSION_SECRET;
    } else {
      process.env.CONSOLE_SESSION_SECRET = saved;
    }
  }
}

test("auth: session token round-trip returns the email", async () => {
  const { createSessionToken, verifySessionToken } = await lib(
    "src/server/auth/session.ts",
  );
  await withSessionSecret(makeSessionSecret(), async () => {
    const token = await createSessionToken("planners@nfaplanners.com");
    assert.equal(typeof token, "string");
    assert.deepEqual(await verifySessionToken(token), {
      email: "planners@nfaplanners.com",
    });
  });
});

test("auth: tampered token verifies to null", async () => {
  const { createSessionToken, verifySessionToken } = await lib(
    "src/server/auth/session.ts",
  );
  await withSessionSecret(makeSessionSecret(), async () => {
    const token = await createSessionToken("planners@nfaplanners.com");
    const tampered = `${token.slice(0, -2)}${token.endsWith("a") ? "b" : "a"}x`;
    assert.equal(await verifySessionToken(tampered), null);
    assert.equal(await verifySessionToken("not-a-jwt"), null);
  });
});

test("auth: token with wrong issuer verifies to null", async () => {
  const { verifySessionToken } = await lib("src/server/auth/session.ts");
  const { SignJWT } = await import("jose");
  const secret = makeSessionSecret();
  await withSessionSecret(secret, async () => {
    const now = Math.floor(Date.now() / 1000);
    const foreign = await new SignJWT({ email: "planners@nfaplanners.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("not-nfa-planners")
      .setAudience("nfa-console")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(Buffer.from(secret, "base64"));
    assert.equal(await verifySessionToken(foreign), null);
  });
});

test("auth: expired session token verifies to null", async () => {
  const { verifySessionToken } = await lib("src/server/auth/session.ts");
  const { SignJWT } = await import("jose");
  const secret = makeSessionSecret();
  await withSessionSecret(secret, async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ email: "planners@nfaplanners.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("nfa-planners")
      .setAudience("nfa-console")
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 3600)
      .sign(Buffer.from(secret, "base64"));
    assert.equal(await verifySessionToken(expired), null);
  });
});

test("auth: sanitiseReturnTo blocks open redirects and login loops", async () => {
  const { sanitiseReturnTo } = await lib("src/server/auth/returnTo.ts");
  assert.equal(sanitiseReturnTo(null), "/console");
  assert.equal(sanitiseReturnTo(""), "/console");
  assert.equal(sanitiseReturnTo("//evil.example"), "/console");
  assert.equal(sanitiseReturnTo("https://evil.example/console/x"), "/console");
  assert.equal(sanitiseReturnTo("/other-app/page"), "/console");
  assert.equal(sanitiseReturnTo("/console/login?returnTo=/console"), "/console");
  assert.equal(
    sanitiseReturnTo("/console/opportunities/ABC"),
    "/console/opportunities/ABC",
  );
  assert.equal(sanitiseReturnTo("/console/notifications"), "/console/notifications");
});

test("auth: getSessionSecret validates key material", async () => {
  const { getSessionSecret } = await lib("src/server/auth/config.ts");

  await withSessionSecret(undefined, async () => {
    assert.throws(() => getSessionSecret(), /CONSOLE_SESSION_SECRET is not set/);
  });

  await withSessionSecret(randomBytes(16).toString("base64"), async () => {
    assert.throws(
      () => getSessionSecret(),
      /at least 32 bytes of key material/,
    );
  });

  await withSessionSecret(makeSessionSecret(48), async () => {
    const key = getSessionSecret();
    assert.ok(key instanceof Uint8Array);
    assert.equal(key.length, 48);
  });
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL - ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${tests.length} smoke tests failed`);
  process.exit(1);
}
console.log(`\n${tests.length}/${tests.length} smoke tests passed`);
