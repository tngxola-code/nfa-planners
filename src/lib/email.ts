import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDigestEmail(
  recipient: string,
  report: { ingested: number; errors: string[]; skipped: any[] }
) {
  const subject = `NFA Opportunity Digest – ${new Date().toLocaleDateString()}`;
  const html = `
    <h1>NFA Opportunity Ingest Report</h1>
    <p>New opportunities ingested: ${report.ingested}</p>
    <p>Skipped: ${report.skipped.length}</p>
    <p>Errors: ${report.errors.length}</p>
    ${report.errors.length ? `<pre>${report.errors.join("\n")}</pre>` : ""}
    <hr />
    <p>This is an automated message from the NFA Console.</p>
  `;

  try {
    await resend.emails.send({
      from: "NFA Console <noreply@yourdomain.com>",
      to: recipient,
      subject,
      html,
    });
  } catch (error) {
    console.error("Failed to send email digest:", error);
    throw error;
  }
}
