import { NextResponse, type NextRequest } from "next/server";
import { processNewMonthlyFiles } from "@/server/ingest/bulkClient";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  try {
    await processNewMonthlyFiles();
    return NextResponse.json({ ok: true, message: "Bulk files processed" });
  } catch (error) {
    console.error("Bulk ingestion failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
