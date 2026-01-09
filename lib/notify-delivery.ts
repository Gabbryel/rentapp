import { sendMail } from "@/lib/email";

// Optional channels controlled by env
// Slack: SLACK_WEBHOOK_URL
// Twilio SMS: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_TO (comma-separated recipients)
// Signal (via signal-cli REST API): SIGNAL_REST_URL, SIGNAL_FROM, SIGNAL_TO (comma-separated recipients)

async function deliverEmail(to: string[] | string, subject: string, text: string) {
  try {
    await sendMail({ to, subject, text });
  } catch (e) {
    console.error("notify: email error", e);
  }
}

async function deliverSlack(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  } catch (e) {
    console.error("notify: slack error", e);
  }
}

async function deliverSms(text: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const toList = (process.env.TWILIO_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!sid || !token || !from || toList.length === 0) return;
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    for (const to of toList) {
      const body = new URLSearchParams({ To: to, From: from, Body: text });
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
    }
  } catch (e) {
    console.error("notify: sms error", e);
  }
}

async function deliverSignal(text: string) {
  const base = process.env.SIGNAL_REST_URL; // e.g. http://localhost:8080
  const from = process.env.SIGNAL_FROM; // signal number
  const toList = (process.env.SIGNAL_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!base || !from || toList.length === 0) return;
  try {
    await fetch(`${base}/v2/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: from, recipients: toList, message: text }),
    });
  } catch (e) {
    console.error("notify: signal error", e);
  }
}

export async function deliverAllChannels(subject: string, text: string, toEmails: string[]) {
  // Email to specific users
  if (toEmails.length > 0) await deliverEmail(toEmails, subject, text);
  // Slack/SMS/Signal broadcast to configured recipients
  const broadcast = `(${subject})\n${text}`;
  await Promise.all([deliverSlack(broadcast), deliverSms(broadcast), deliverSignal(broadcast)]);
}
