import { NextResponse } from 'next/server';
import { fetchOcdsReleases } from '@/lib/ocds/client';
import { normaliseRelease } from '@/lib/ocds/normalise';
import { upsertOpportunities } from '@/server/repositories/opportunities';
import { sendDigest } from '@/server/notifications/sendDigest';
import type { Opportunity } from '@/lib/ocds/types';

export async function GET(request: Request) {
  // Simple auth: check a secret header to prevent public access
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const releases = await fetchOcdsReleases();
    const opportunities = releases
      .map(r => normaliseRelease(r))
      .filter((o): o is Opportunity => o !== null);

    const { inserted, updated } = await upsertOpportunities(opportunities);

    let digestSent = 0;
    if (inserted > 0) {
      // sendDigest requires a recipient email
      const recipient = process.env.CONSOLE_AUTH_EMAIL || 'admin@nfa.co.za';
      // sendDigest returns { sent: number } or void; we'll handle both
      const result = await sendDigest(recipient);
      digestSent = result?.sent ?? 0;
    }

    return NextResponse.json({
      inserted,
      updated,
      digestSent,
      totalReleases: releases.length,
    });
  } catch (error) {
    console.error('Ingestion failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
