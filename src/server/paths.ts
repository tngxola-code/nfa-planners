/**
 * Shared data-directory resolution for the JSON repositories.
 *
 * SERVER-ONLY: do not import from client components (see fileStore.ts).
 *
 * Resolution order:
 *  1. explicit `override` argument (tests use this with a temp dir),
 *  2. `NFA_DATA_DIR` environment variable,
 *  3. `<process.cwd()>/data` (the committed `data/` directory at repo root).
 */

import path from "node:path";

export interface DataDirOptions {
  /** Explicit data directory override; wins over NFA_DATA_DIR. */
  dataDir?: string;
}

export function resolveDataDir(override?: string): string {
  return (
    override ?? process.env.NFA_DATA_DIR ?? path.join(process.cwd(), "data")
  );
}
