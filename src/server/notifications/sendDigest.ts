/**
 * Digest sender: emails active, not-yet-notified opportunities via Resend.
 *
 * SERVER-ONLY: do not import from client components (see store/fileStore.ts).
 *
 * Behaviour:
 *  - Eligible = status "active", no `notifiedAt`, and no prior successful
 *    notification for the same dedup hash (so re-ingested records with fresh
 *    ids are not re-emailed).
 *  - Zero eligible -> `{ sent: 0, skipped: true }` and nothing is sent; the
 *    Resend API key is NOT required in this path.
 *  - Otherwise the digest is rendered and sent, each opportunity gets a
 *    notification record, and the opportunities are marked `notifiedAt`.
 *  - On provider failure the notifications are recorded as "failed" (so the
 *    next run retries) and the error is thrown to the caller.
 *
 * The Resend client is imported and constructed lazily inside the function so
 * that importing this module never requires the API key (or the network).
 *
 * NOTE: relative imports only in src/server — the offline smoke loader
 * transpiles TS→CJS without Next's "@/" path-alias resolution.
 */

import { randomUUID } from "node:crypto";

import type { Opportunity } from "@/lib/ocds/types";
import type { DataDirOptions } from "../paths";
import {
  listOpportunities,
} from "../repositories/opportunities";
import {
  hasBeenNotified,
  recordNotification,
} from "../repositories/notifications";
import { renderDigestEmail } from "./digest";

const DEFAULT_FROM = "NFA Console <noreply@nfaplanners.com>";

export interface SendDigestResult {
  /** Number of opportunities included in the sent digest. */
  sent: number;
  /** True when there was nothing eligible and no email was attempted. */
  skipped: boolean;
}

async function findEligible(options?: DataDirOptions): Promise<Opportunity[]> {
  const active = await listOpportunities({ status: "active" }, options);
  const eligible: Opportunity[] = [];
  for (const opportunity of active) {
    if (opportunity.notifiedAt) continue;
    // eslint-disable-next-line no-await-in-loop -- intentional: bounded, keeps dedup checks serial
    if (await hasBeenNotified(opportunity.hash, options)) continue;
    eligible.push(opportunity);
  }
  return eligible;
}

/**
 * Send the new-opportunities digest to `recipient`.
 *
 * Throws when sending is required but impossible (missing RESEND_API_KEY or a
 * Resend API error). Never throws for the "nothing to send" case.
 */
export async function sendDigest(
  recipient: string,
  options?: DataDirOptions,
): Promise<SendDigestResult> {
  const eligible = await findEligible(options);

  if (eligible.length === 0) {
    return { sent: 0, skipped: true };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "sendDigest: RESEND_API_KEY must be set to send digest emails",
    );
  }

  // Lazy import + construction: module import must work without the key.
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  const { subject, html, text } = renderDigestEmail(eligible);
  const attemptedAt = new Date().toISOString();

  const result = await resend.emails.send({ from, to: recipient, subject, html, text });
  const providerError = result.error;

  for (const opportunity of eligible) {
    // eslint-disable-next-line no-await-in-loop -- intentional: append order matters
    await recordNotification(
      {
        id: randomUUID(),
        opportunityId: opportunity.id,
        reference: opportunity.reference,
        dedupKey: opportunity.hash,
        channel: "email",
        status: providerError ? "failed" : "sent",
        recipient,
        sentAt: providerError ? undefined : attemptedAt,
        createdAt: attemptedAt,
        error: providerError ? providerError.message : undefined,
      },
      options,
    );
  }

  if (providerError) {
    throw new Error(
      `sendDigest: Resend rejected the digest email: ${providerError.message}`,
    );
  }

  return { sent: eligible.length, skipped: false };
}
