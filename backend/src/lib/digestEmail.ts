import type { NotificationDto } from "../types/notification.js";

export interface EmailSender {
  send(to: string, subject: string, html: string): Promise<void>;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");

  if (!local || !domain) {
    return "<invalid-address>";
  }

  return `${local.slice(0, 1)}***@${domain}`;
}

export const consoleEmailSender: EmailSender = {
  async send(to, subject) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("A production email sender has not been configured");
    }

    console.info(`[email:development] "${subject}" -> ${maskEmail(to)}`);
  },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function buildDigestEmail(
  userName: string,
  notifications: NotificationDto[],
): { subject: string; html: string } {
  const count = notifications.length;

  const items = notifications
    .map(
      (notification) => `
<li style="margin:0 0 12px">
  <strong>${escapeHtml(notification.title)}</strong><br/>
  <span style="color:#5B6472">${escapeHtml(notification.body)}</span><br/>
  <small style="color:#8A93A3">${escapeHtml(
    displayDate(notification.createdAt),
  )} UTC</small>
</li>`,
    )
    .join("");

  const subject =
    `NFA Console digest - ${count} ` + `update${count === 1 ? "" : "s"}`;

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#1B2A4A">Hello ${escapeHtml(userName)},</h2>
  <p style="color:#5B6472">Here is what is new in your opportunity console:</p>
  <ul style="padding-left:18px">${items}</ul>
  <hr style="border:none;border-top:1px solid #E7E5DF"/>
  <p style="color:#8A93A3;font-size:12px">
    You are receiving this because email notifications are enabled.
    Sign in to manage your preferences.
  </p>
</body>
</html>`,
  };
}
