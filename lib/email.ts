import nodemailer from "nodemailer";

export type Mail = { to: string | string[]; subject: string; text?: string; html?: string };

function getTransport() {
  let { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env as Record<string, string | undefined>;
  // Sensible defaults for Gmail if only user/pass are provided
  if (!SMTP_HOST && SMTP_USER && /@gmail\.com$/i.test(SMTP_USER)) {
    SMTP_HOST = "smtp.gmail.com";
  }
  if (!SMTP_PORT && SMTP_USER && /@gmail\.com$/i.test(SMTP_USER)) {
    SMTP_PORT = "465"; // default SSL port for Gmail
  }
  if (!SMTP_FROM && SMTP_USER) SMTP_FROM = SMTP_USER;
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
