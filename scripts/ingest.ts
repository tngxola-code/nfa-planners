/**
 * Minimal ingest test – fetches releases, scores them, and prints top matches.
 * No persistence, no email.
 * Run: npm run ingest:dry
 */

import { fetchReleases } from "../src/lib/ocds/client";
import { toOpportunities } from "../src/lib/ocds/normalise";
import { STORE_THRESHOLD } from "../src/lib/fit";

async function main() {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const dateFrom = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);

  console.log(`[ingest] window ${dateFrom} -> ${dateTo}`);

  try {
    const releases = await fetchReleases({ dateFrom, dateTo, pageSize: 50 });
    console.log(`[ingest] ${releases.length} releases returned`);

    const opportunities = toOpportunities(releases, { now, minScore: STORE_THRESHOLD });
    console.log(`[ingest] ${opportunities.length} opportunities scored above ${STORE_THRESHOLD}`);

    // Sort by fitScore descending and show top 10
    const sorted = [...opportunities].sort((a, b) => b.fitScore - a.fitScore);
    console.log("\n--- Top 10 matches ---");
    if (sorted.length === 0) {
      console.log("No opportunities scored above threshold.");
    } else {
      sorted.slice(0, 10).forEach((opp, i) => {
        console.log(`${i+1}. [${opp.fitScore}%] ${opp.reference} – ${opp.title}`);
        console.log(`   ${opp.fitReason || "N/A"}`);
      });
    }
  } catch (err) {
    console.error("Ingest failed:", err);
    process.exit(1);
  }
}

main();
