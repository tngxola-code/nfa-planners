/**
 * Cron entrypoint for the ingest pipeline.
 *
 * Scheduled twice daily via vercel.json (06:00 and 18:00 SAST = 04:00 and
 * 16:00 UTC). Vercel automatically sends `Authorization: Bearer $CRON_SECRET`
 * on cron invocations when the CRON_SECRET env var is set; we verify it here.
 * Manual triggering is possible with the same header.
 *
 * The route always runs the full pipeline with notifications enabled and
 * returns the IngestReport as JSON. runIngest never throws on source or
 * notification failure — those land in report.errors — so a 200 with
 * errors[] is a completed run, not a healthy one.
 */

import { NextResponse, type NextRequest } from "next/server";

import { runIngest } from "@/server/ingest/runIngest";

export const dynamic = "force-dynamic";

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const report = await runIngest({
    notify: true,
    recipient: process.env.CONSOLE_AUTH_EMAIL ?? process.env.TEST_EMAIL_RECIPIENT,
  });
  return NextResponse.json(report);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
