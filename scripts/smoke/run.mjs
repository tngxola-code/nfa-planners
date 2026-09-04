/**
 * Offline smoke tests for the NFA Planners console.
 *
 * Dependency-light by design: plain Node, no network, no installed packages
 * required. Later branches (scheduler, ingestion) add their smoke checks here.
 *
 * Run with: npm run test:smoke
 */
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
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
