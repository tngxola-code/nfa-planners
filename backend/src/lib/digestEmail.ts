import type { NotificationDto } from "../types/notification.js";

export interface EmailSender {
  send(to: string, subject: string, html: string): Promise<void>;
}

/**
 * Development sender. Replace through dependency injection when
 * SendGrid, SES or another provider is introduced.
 */
export const consoleEmailSender: EmailSender = {
  async send(to, subject) {
    console.log(`[email] "${subject}" -> ${to}`);
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

export function buildDigestEmail(
  userName: string,
  notifications: NotificationDto[],
): {
  subject: string;
  html: string;
} {
  const items = notifications
    .map(
      (notification) => `<li style="margin:0 0 8px">
  <strong>${escapeHtml(notification.title)}</strong><br/>
  <span style="color:#5B6472">${escapeHtml(notification.body)}</span><br/>
  <small style="color:#8A93A3">${escapeHtml(
    notification.createdAt.slice(0, 16).replace("T", " "),
  )}</small>
</li>`,
    )
    .join("");

  const count = notifications.length;

  return {
    subject: `NFA Console digest — ${count} update${count === 1 ? "" : "s"}`,
    html: `<!doctype html>
<html>
<body style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#1B2A4A">Hello ${escapeHtml(userName)},</h2>
  <p style="color:#5B6472">Here's what's new in your opportunity console:</p>
  <ul style="padding-left:18px">${items}</ul>
  <hr style="border:none;border-top:1px solid #E7E5DF"/>
  <p style="color:#8A93A3;font-size:12px">
    You're receiving this because email notifications are enabled.
    Sign in to manage preferences.
  </p>
</body>
</html>`,
  };
}
