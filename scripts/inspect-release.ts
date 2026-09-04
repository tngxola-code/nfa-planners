import { fetchReleases } from "../src/lib/ocds/client";

async function main() {
  const now = new Date();
  const dateFrom = "2026-07-01";
  const dateTo = now.toISOString().slice(0, 10);
  const releases = await fetchReleases({ dateFrom, dateTo, pageSize: 5 });
  if (releases.length > 0) {
    console.log(JSON.stringify(releases[0], null, 2));
  } else {
    console.log("No releases.");
  }
}

main().catch(console.error);
