/**
 * INTERNAL / TEST-ONLY ROUTE.
 *
 * Triggers a real digest email to the console operator address so the Resend
 * integration can be verified manually. This route is UNAUTHENTICATED for
 * now: it will sit behind the console session guard once
 * feat/004-console-auth lands. Do not expose it publicly before then.
 *
 * GET is supported alongside POST so it can be triggered from a browser
 * address bar during testing.
 */

import { NextResponse } from "next/server";

import { sendDigest } from "@/server/notifications/sendDigest";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  const recipient =
    process.env.CONSOLE_AUTH_EMAIL ?? process.env.TEST_EMAIL_RECIPIENT;

  if (!recipient) {
    return NextResponse.json(
      {
        error:
          "No digest recipient configured: set CONSOLE_AUTH_EMAIL or TEST_EMAIL_RECIPIENT",
      },
      { status: 400 },
    );
  }

  try {
    const result = await sendDigest(recipient);
    return NextResponse.json({ recipient, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return handle();
}

export async function POST(): Promise<NextResponse> {
  return handle();
}
