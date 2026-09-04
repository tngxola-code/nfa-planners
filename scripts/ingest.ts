import { fetchOcdsReleases } from '../src/lib/ocds/client';
import { normaliseRelease } from '../src/lib/ocds/normalise';
import { upsertOpportunities } from '../src/server/repositories/opportunities';
import type { Opportunity } from '../src/lib/ocds/types';

async function main() {
  // Optionally override dateFrom/dateTo via env or command line
  const dateFrom = process.env.INGEST_DATE_FROM || undefined;
  const dateTo = process.env.INGEST_DATE_TO || undefined;

  console.log(`[ingest] fetching releases (dateFrom: ${dateFrom ?? 'default 90 days ago'}, dateTo: ${dateTo ?? 'today'})`);

  try {
    const releases = await fetchOcdsReleases({ dateFrom, dateTo, limit: 100 });
    console.log(`[ingest] fetched ${releases.length} releases`);

    const opportunities = releases
      .map(r => normaliseRelease(r))
      .filter((o): o is Opportunity => o !== null);

    console.log(`[ingest] normalised ${opportunities.length} opportunities`);

    const { inserted, updated } = await upsertOpportunities(opportunities);
    console.log(`[ingest] inserted ${inserted}, updated ${updated}`);
  } catch (err) {
    console.error('Ingest failed:', err);
    process.exit(1);
  }
}

main().catch(console.error);
