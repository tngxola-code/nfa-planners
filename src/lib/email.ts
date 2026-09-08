import { Resend } from 'resend';

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export async function sendDigestEmail(recipient: string, report: any) {
  const resend = getResend();
  const subject = `NFA Digest: ${report.ingested || 0} opportunities ingested`;
  const html = `<p>Ingested ${report.ingested || 0} opportunities.</p>
                <p>Errors: ${(report.errors || []).length}</p>`;
  await resend.emails.send({
    from: 'NFA Console <noreply@yourdomain.com>',
    to: recipient,
    subject,
    html,
  });
}
