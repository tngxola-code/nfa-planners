/**
 * Generic, atomic JSON file persistence.
 *
 * SERVER-ONLY: this module uses node:fs and must never be imported from
 * client components. The `server-only` package is not installed, so the
 * convention is enforced structurally: everything under `src/server/` is
 * reachable only from server code (route handlers, server components,
 * scripts). Do not re-export from client-reachable modules.
 *
 * Guarantees:
 *  - Writes are atomic: data is written to a sibling tmp file and renamed
 *    over the target, so readers never see a torn file.
 *  - Writes are serialised per path via an in-process promise queue, so
 *    concurrent read-modify-write cycles (e.g. upsert batches) cannot
 *    interleave and lose updates within this process.
 *  - Parent directories are created on demand.
 *
 * Note: the queue is per-process. Multi-writer deployments (e.g. more than
 * one Node process writing the same file) are out of scope for the JSON
 * store; that is the trigger to move to Postgres.
 */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Per-file tail promise used to serialise read-modify-write cycles. */
const queues = new Map<string, Promise<unknown>>();

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/**
 * Read and parse a JSON file. Returns `fallback` when the file does not
 * exist; throws on malformed JSON or other I/O errors.
 */
export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if (isEnoent(err)) return fallback;
    throw new Error(
      `fileStore: failed to read ${filePath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function writeAtomic(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Best-effort cleanup so tmp files do not pile up.
    await fs.unlink(tmpPath).catch(() => undefined);
    throw err;
  }
}

/**
 * Serialised read-modify-write cycle for a JSON file.
 *
 * `update` receives the current parsed value (or `fallback` when the file is
 * missing) and returns the next value (or a promise of it). The optional
 * `result` selector derives the value handed back to the caller; when
 * omitted the stored value is returned.
 *
 * Concurrent calls for the same path queue up and execute one at a time, in
 * call order.
 */
export async function updateJsonFile<T, R = T>(
  filePath: string,
  fallback: T,
  update: (current: T) => T | Promise<T>,
  result?: (next: T) => R,
): Promise<R> {
  const previous = queues.get(filePath) ?? Promise.resolve();

  const run = previous.then(async () => {
    const current = await readJsonFile(filePath, fallback);
    const next = await update(current);
    await writeAtomic(filePath, next);
    return result ? result(next) : (next as unknown as R);
  });

  // Keep the queue alive even when this cycle rejects, so one failure does
  // not wedge subsequent writers.
  queues.set(
    filePath,
    run.catch(() => undefined),
  );

  return run;
}

/**
 * Serialised atomic write of a complete JSON value (no read step).
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const previous = queues.get(filePath) ?? Promise.resolve();
  const run = previous.then(() => writeAtomic(filePath, data));
  queues.set(
    filePath,
    run.catch(() => undefined),
  );
  return run;
}
