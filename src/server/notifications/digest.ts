/**
 * Digest email renderer.
 *
 * Pure function: no I/O, no clock access (inject `now` in tests), no network.
 * Produces an NFA-branded HTML email plus a plain-text fallback.
 *
 * NOTE: relative imports only in src/server — the offline smoke loader
 * transpiles TS→CJS without Next's "@/" path-alias resolution.
 */

import type { Opportunity } from "../../lib/ocds/types";

/** Public console origin used for per-opportunity links in emails. */
export const CONSOLE_BASE_URL = "https://console.nfaplanners.com";

/** Fit score at/above which an opportunity is badged as a high match. */
export const HIGH_MATCH_BADGE_THRESHOLD = 80;

/** Closings within this window are highlighted red in the digest. */
export const URGENT_CLOSING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

// NFA palette: navy header, low-saturation body.
const NAVY = "#0F1B2D";
const SLATE_TEXT = "#3D4B5C";
const MUTED = "#7A8794";
const BORDER = "#DDE3EA";
const URGENT_RED = "#B3261E";
const BADGE_GOLD = "#8A6D1F";
const BADGE_BG = "#F5EFD8";

export interface DigestEmail {
  subject: string;
  html: string;
  /** Plain-text fallback for clients that block HTML. */
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatClosingDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function opportunityConsoleUrl(reference: string): string {
  return `${CONSOLE_BASE_URL}/opportunities/${encodeURIComponent(reference)}`;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function renderRow(opportunity: Opportunity, nowMs: number): string {
  const closingMs = Date.parse(opportunity.closingDate);
  const urgent =
    !Number.isNaN(closingMs) && closingMs - nowMs <= URGENT_CLOSING_WINDOW_MS;

  const closingStyle = urgent
    ? `color:${URGENT_RED};font-weight:600;`
    : `color:${SLATE_TEXT};`;

  const badge =
    opportunity.fitScore >= HIGH_MATCH_BADGE_THRESHOLD
      ? `<span style="display:inline-block;background:${BADGE_BG};color:${BADGE_GOLD};border-radius:10px;padding:1px 8px;font-size:11px;font-weight:600;">&#9733; High Match</span> `
      : "";

  const url = opportunityConsoleUrl(opportunity.reference);

  return `<tr>
  <td style="padding:12px 16px;border-bottom:1px solid ${BORDER};">
    <a href="${escapeHtml(url)}" style="color:${NAVY};font-weight:600;text-decoration:none;">${escapeHtml(opportunity.title)}</a><br/>
    <span style="color:${MUTED};font-size:12px;">${escapeHtml(opportunity.reference)}</span>
  </td>
  <td style="padding:12px 16px;border-bottom:1px solid ${BORDER};color:${SLATE_TEXT};">${escapeHtml(opportunity.client)}</td>
  <td style="padding:12px 16px;border-bottom:1px solid ${BORDER};color:${SLATE_TEXT};">${escapeHtml(opportunity.location ?? opportunity.province ?? "—")}</td>
  <td style="padding:12px 16px;border-bottom:1px solid ${BORDER};${closingStyle}">${escapeHtml(formatClosingDate(opportunity.closingDate))}</td>
  <td style="padding:12px 16px;border-bottom:1px solid ${BORDER};white-space:nowrap;">${badge}<span style="color:${SLATE_TEXT};">${opportunity.fitScore}/100</span></td>
</tr>`;
}

function renderHtml(opportunities: Opportunity[], nowMs: number): string {
  const headerCell = (label: string) =>
    `<th align="left" style="padding:10px 16px;color:#C7D0DA;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #2A3A4E;">${label}</th>`;

  const body =
    opportunities.length === 0
      ? `<p style="color:${SLATE_TEXT};padding:24px 16px;">No new opportunities matched NFA&rsquo;s capability profile in this run.</p>`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr>${headerCell("Opportunity")}${headerCell("Client")}${headerCell("Location")}${headerCell("Closing")}${headerCell("Fit")}</tr>
  ${opportunities.map((opp) => renderRow(opp, nowMs)).join("\n")}
</table>`;

  return `<!DOCTYPE html>
<html lang="en-ZA">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F4F6F8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:760px;margin:0 auto;padding:24px 12px;">
    <div style="background:${NAVY};border-radius:8px 8px 0 0;padding:20px 24px;">
      <div style="color:#FFFFFF;font-size:18px;font-weight:700;">NFA Planners</div>
      <div style="color:#C7D0DA;font-size:12px;margin-top:2px;">Opportunity-intelligence digest</div>
    </div>
    <div style="background:#FFFFFF;border:1px solid ${BORDER};border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
      <p style="color:${SLATE_TEXT};padding:16px 16px 4px;margin:0;">
        ${opportunities.length} new opportunit${opportunities.length === 1 ? "y" : "ies"} matched NFA&rsquo;s capability profile, sorted by fit score.
      </p>
      ${body}
      <p style="color:${MUTED};font-size:12px;padding:16px;margin:0;">
        Sent by the NFA Planners console. Closing dates in red are within 3 days.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function renderText(opportunities: Opportunity[]): string {
  if (opportunities.length === 0) {
    return [
      "NFA Planners — opportunity digest",
      "",
      "No new opportunities matched NFA's capability profile in this run.",
    ].join("\n");
  }

  const lines = [
    `NFA Planners — ${opportunities.length} new opportunit${opportunities.length === 1 ? "y" : "ies"}`,
    "",
  ];
  for (const opp of opportunities) {
    const highMatch = opp.fitScore >= HIGH_MATCH_BADGE_THRESHOLD ? " [HIGH MATCH]" : "";
    lines.push(
      `* ${opp.title}${highMatch}`,
      `  Ref: ${opp.reference} | Client: ${opp.client} | Location: ${opp.location ?? opp.province ?? "-"}`,
      `  Closing: ${formatClosingDate(opp.closingDate)} | Fit: ${opp.fitScore}/100`,
      `  ${opportunityConsoleUrl(opp.reference)}`,
      "",
    );
  }
  return lines.join("\n");
}

/**
 * Render the digest email for a set of opportunities.
 *
 * Opportunities are sorted by fitScore descending. An empty list renders a
 * graceful empty-state email (callers normally skip sending instead).
 *
 * @param now injectable clock for deterministic tests.
 */
export function renderDigestEmail(
  opportunities: Opportunity[],
  now: Date = new Date(),
): DigestEmail {
  const sorted = [...opportunities].sort((a, b) => b.fitScore - a.fitScore);
  const nowMs = now.getTime();

  const subject =
    sorted.length === 0
      ? "[NFA] No new opportunities"
      : `[NFA] ${sorted.length} new opportunit${sorted.length === 1 ? "y" : "ies"} — ${truncate(sorted[0].title, 60)}`;

  return {
    subject,
    html: renderHtml(sorted, nowMs),
    text: renderText(sorted),
  };
}
