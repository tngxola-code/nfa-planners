import { fetchOcdsReleases } from "./client";
import { normaliseRelease } from "@/lib/ocds/normalise";
import { opportunityRepository } from "./repository";
import { sendDigestEmail } from "@/lib/email";

export async function runIngest({
  notify,
  recipient,
}: {
  notify?: boolean;
  recipient?: string;
} = {}) {
  // Validate required environment variables
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (notify && !process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required when notify=true");
  }

  const now = new Date();
  const report = {
    ingested: 0,
    errors: [] as string[],
    skipped: [] as { releaseId: string; reason: string }[],
    timestamp: now.toISOString(),
  };

  try {
    const releases = await fetchOcdsReleases();
    for (const release of releases) {
      try {
        const opp = normaliseRelease(release, now);
        if (opp) {
          await opportunityRepository.upsert(opp);
          report.ingested++;
        } else {
          report.skipped.push({ releaseId: release.id, reason: "normalisation returned null" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        report.errors.push(`Failed to process release ${release.id}: ${msg}`);
      }
    }

    await opportunityRepository.closePastDeadlines(now);

    if (notify && recipient) {
      try {
        await sendDigestEmail(recipient, report);
      } catch (err) {
        report.errors.push(`Notification failed: ${err}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    report.errors.push(`Ingestion pipeline failed: ${msg}`);
  }

  return report;
}

// Add this import at the top of the file:
// import { processNewMonthlyFiles } from "./bulkClient";

// At the end of the runIngest function, you can add:
// if (process.env.RUN_BULK === "true") {
//   await processNewMonthlyFiles();
// }
