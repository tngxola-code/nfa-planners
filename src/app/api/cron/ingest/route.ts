import { NextResponse, type NextRequest } from "next/server";
import { runIngest } from "@/server/ingest/runIngest";

export const dynamic = "force-dynamic";

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET not set");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isAuthorised(request)) {
      console.warn("Cron unauthorised attempt");
      return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    }

    const report = await runIngest({
      notify: true,
      recipient: process.env.CONSOLE_AUTH_EMAIL ?? process.env.TEST_EMAIL_RECIPIENT,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Cron ingestion failed:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
