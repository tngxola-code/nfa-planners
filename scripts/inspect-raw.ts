/**
 * Inspect raw OCDS data to see available fields.
 * Run: npx tsx scripts/inspect-raw.ts
 */

async function main() {
  const baseUrl = "https://ocds-api.etenders.gov.za/api/OCDSReleases";
  const dateFrom = "2026-07-01";
  const dateTo = new Date().toISOString().slice(0, 10);
  const url = `${baseUrl}?dateFrom=${dateFrom}&dateTo=${dateTo}&PageSize=5`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const releases = data.releases || [];
  if (releases.length === 0) {
    console.log("No releases found.");
    return;
  }

  console.log("First release (full):");
  console.log(JSON.stringify(releases[0], null, 2));

  console.log("\n--- Tender object:");
  const tender = releases[0].tender || {};
  console.log(JSON.stringify(tender, null, 2));

  // Also show the classification if present
  if (tender.classification) {
    console.log("\n--- Classification:");
    console.log(JSON.stringify(tender.classification, null, 2));
  }
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
