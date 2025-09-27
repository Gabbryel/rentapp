import nodemailer from "nodemailer";

export type Mail = { to: string | string[]; subject: string; text?: string; html?: string };

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) return null;
  const port = Number(SMTP_PORT);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendMail({ to, subject, text, html }: Mail) {
  const from = process.env.SMTP_FROM || "no-reply@example.com";
  const transport = getTransport();
  if (!transport) {
    console.log("[dev-mail]", { from, to, subject, text, html });
    return { accepted: Array.isArray(to) ? to : [to], rejected: [] };
  }
  return transport.sendMail({ from, to, subject, text, html });
}
