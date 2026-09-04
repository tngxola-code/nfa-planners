import { scoreFit } from "../src/lib/fit";

async function main() {
  const baseUrl = "https://ocds-api.etenders.gov.za/api/OCDSReleases";
  const dateFrom = "2026-07-01";
  const dateTo = new Date().toISOString().slice(0, 10);
  const url = `${baseUrl}?dateFrom=${dateFrom}&dateTo=${dateTo}&PageSize=100`;
  console.log(`Fetching: ${url}`);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const releases = data.releases || [];
  console.log(`[test] ${releases.length} releases fetched`);

  const scored = releases.map((release: any) => {
    const tender = release.tender || {};
    // Use tender.title first, fallback to release.title or description
    const title = tender.title || release.title || release.description || "";
    const description = tender.description || release.description || "";
    const client = tender.procuringEntity?.name || release.buyer?.name || "";
    const location = tender.province || tender.deliveryLocation || "";

    const result = scoreFit({ title, description, client, location });
    return {
      title,
      reference: tender.id || release.ocid || "N/A",
      score: result.score,
      reason: result.reason,
      matched: result.matchedCapabilities,
    };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);
  console.log(`\n--- Top 10 matches (threshold: 40) ---`);
  const top = sorted.filter(s => s.score >= 40).slice(0, 10);
  if (top.length === 0) {
    console.log("No opportunities above threshold 40. Showing all scores > 0:");
    const aboveZero = sorted.filter(s => s.score > 0);
    aboveZero.slice(0, 15).forEach((item, i) => {
      console.log(`${i+1}. [${item.score}%] ${item.reference}`);
      console.log(`   ${item.title}`);
      console.log(`   ${item.reason}`);
      console.log("");
    });
  } else {
    top.forEach((item, i) => {
      console.log(`${i+1}. [${item.score}%] ${item.reference}`);
      console.log(`   ${item.title}`);
      console.log(`   ${item.reason}`);
      console.log(`   Matched: ${item.matched.join(", ")}`);
      console.log("");
    });
  }
}

main().catch(console.error);
