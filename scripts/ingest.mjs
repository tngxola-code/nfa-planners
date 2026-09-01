/**
 * CLI ingest runner: `npm run ingest [-- --notify] [-- --recipient=you@x.com]`
 *
 * Runs the full pipeline (fetch -> normalise -> upsert -> optional digest)
 * and prints the resulting IngestReport as JSON.
 *
 * Exit code contract:
 *  - 0 when the run completed, EVEN IF the source fetch failed (the report's
 *    `errors` array carries the failure — a failed source is not a crashed
 *    runner);
 *  - 1 only on an unexpected crash (runIngest itself threw).
 *
 * TypeScript sources are transpiled to CJS in a temp dir using the locally
 * installed `typescript` package (same approach as the smoke runner), so no
 * build step is required. Requires `npm ci` / `npm install` first.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- minimal .env loading (no dotenv dependency) ---------------------------
for (const name of [".env.local", ".env"]) {
  const file = path.join(repoRoot, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

// --- TS -> CJS transpile loader (mirrors scripts/smoke/run.mjs) ------------
async function loadServerModule(relPath) {
  const ts = await import("typescript").catch((err) => {
    throw new Error(`ingest requires the local typescript package (run npm ci): ${err.message}`);
  });

  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "nfa-ingest-ts-"));

  async function* walk(dir, prefix) {
    const { readdir } = await import("node:fs/promises");
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) yield* walk(path.join(dir, entry.name), rel);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) yield rel;
    }
  }

  const emitted = new Map();
  for await (const rel of walk(path.join(repoRoot, "src"), "src")) {
    const abs = path.join(repoRoot, rel);
    const { outputText } = ts.transpileModule(readFileSync(abs, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: path.basename(rel),
    });
    const dest = path
      .join(tmpRoot, path.relative(path.join(repoRoot, "src"), abs))
      .replace(/\.ts$/, ".js");
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, outputText);
    emitted.set(rel, dest);
  }

  const entry = emitted.get(relPath);
  if (!entry) throw new Error(`no such source file: ${relPath}`);
  return createRequire(path.join(tmpRoot, "index.cjs"))(entry);
}

// --- main -------------------------------------------------------------------
const args = process.argv.slice(2);
const notify = args.includes("--notify");
const recipientArg = args.find((a) => a.startsWith("--recipient="));
const recipient = recipientArg ? recipientArg.slice("--recipient=".length) : undefined;

try {
  const { runIngest } = await loadServerModule("src/server/ingest/runIngest.ts");
  const report = await runIngest({ notify, recipient });
  console.log(JSON.stringify(report, null, 2));
  // Exit 0: the run completed; any source/notification failures are carried
  // in report.errors by design.
  process.exit(0);
} catch (err) {
  console.error("ingest runner crashed unexpectedly:");
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
}
