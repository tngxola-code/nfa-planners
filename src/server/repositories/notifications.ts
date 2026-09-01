/**
 * Notification repository over `data/notifications.json`.
 *
 * SERVER-ONLY: do not import from client components (see store/fileStore.ts).
 *
 * Storage layout: a flat JSON array of NotificationRecord entries, appended
 * as digest emails are attempted. `dedupKey` carries the opportunity's
 * stable content hash, so "have we already emailed about this opportunity?"
 * survives re-ingestion (which refreshes the opportunity id).
 *
 * NOTE: relative imports only in src/server — the offline smoke loader
 * transpiles TS→CJS without Next's "@/" path-alias resolution.
 */

import path from "node:path";

import { resolveDataDir, type DataDirOptions } from "../paths";
import { readJsonFile, updateJsonFile } from "../store/fileStore";

const NOTIFICATIONS_FILE = "notifications.json";

export type NotificationChannel = "email";
export type NotificationStatus = "sent" | "failed" | "pending";

export interface NotificationRecord {
  id: string;
  /** Opportunity id at sent time (may change across re-ingestions). */
  opportunityId: string;
  /** Buyer-side reference, for display/debugging. */
  reference: string;
  /** Stable dedup key — the opportunity's content hash. */
  dedupKey: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient: string;
  /** ISO-8601 timestamp of successful delivery to the provider. */
  sentAt?: string;
  createdAt: string;
  /** Provider error message when status is "failed". */
  error?: string;
}

function notificationsPath(options?: DataDirOptions): string {
  return path.join(resolveDataDir(options?.dataDir), NOTIFICATIONS_FILE);
}

/** List all notification records, oldest first. */
export async function listNotifications(
  options?: DataDirOptions,
): Promise<NotificationRecord[]> {
  return readJsonFile<NotificationRecord[]>(notificationsPath(options), []);
}

/** Append a notification record. Returns the stored record. */
export async function recordNotification(
  record: NotificationRecord,
  options?: DataDirOptions,
): Promise<NotificationRecord> {
  await updateJsonFile<NotificationRecord[]>(
    notificationsPath(options),
    [],
    (current) => [...current, record],
  );
  return record;
}

/**
 * Whether an opportunity (by stable content hash) has already been
 * successfully emailed. Failed attempts do not suppress retries.
 */
export async function hasBeenNotified(
  hash: string,
  options?: DataDirOptions,
): Promise<boolean> {
  const records = await listNotifications(options);
  return records.some(
    (record) => record.dedupKey === hash && record.status === "sent",
  );
}
