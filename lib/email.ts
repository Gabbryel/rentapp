import nodemailer from "nodemailer";
import dns from "node:dns/promises";

export type MailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

export type Mail = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
};

export type EmailValidationResult = {
  valid: boolean;
  email: string;
  reason?: string;
  warnings?: string[];
};

/**
 * Validates email address with syntax check and DNS MX record verification
 */
export async function validateEmailAddress(email: string): Promise<EmailValidationResult> {
  const trimmed = email.trim().toLowerCase();
  
  // Basic syntax validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      email: trimmed,
      reason: "Invalid email syntax",
    };
  }
  
  // Extract domain
  const domain = trimmed.split("@")[1];
  if (!domain) {
    return {
      valid: false,
      email: trimmed,
      reason: "Missing domain",
    };
  }
  
  // Check MX records
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        email: trimmed,
        reason: `No MX records found for domain ${domain}`,
      };
    }
    
    // Valid but add warnings if any
    const warnings: string[] = [];
    
    // Check if it's a common typo domain
    const commonTypos: Record<string, string> = {
      "gmial.com": "gmail.com",
      "gmai.com": "gmail.com",
      "yahooo.com": "yahoo.com",
      "hotmial.com": "hotmail.com",
    };
    
    if (commonTypos[domain]) {
      warnings.push(`Did you mean ${trimmed.split("@")[0]}@${commonTypos[domain]}?`);
    }
    
    return {
      valid: true,
      email: trimmed,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err: any) {
    // DNS lookup failed
    return {
      valid: false,
      email: trimmed,
      reason: `Cannot verify domain ${domain}: ${err.code || err.message}`,
    };
  }
}

/**
 * Validates multiple email addresses
 */
export async function validateEmailAddresses(emails: string[]): Promise<EmailValidationResult[]> {
  return Promise.all(emails.map(email => validateEmailAddress(email)));
}

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

export type MailDeliveryInfo = {
  accepted: string[];
  rejected: string[];
  response?: string;
  messageId?: string;
  envelope?: { from: string; to: string[] };
  smtpServer?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  sentAt: string;
  validationResults?: EmailValidationResult[];
  preValidationFailures?: string[];
};

export async function sendMail({ to, subject, text, html, attachments }: Mail): Promise<MailDeliveryInfo> {
  const from = process.env.SMTP_FROM || "no-reply@example.com";
  const sentAt = new Date().toISOString();
  const transport = getTransport();
  
  const smtpServer = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpSecure = smtpPort === 465;
  const smtpUser = process.env.SMTP_USER;
  
  // Validate email addresses before sending
  const recipients = Array.isArray(to) ? to : [to];
  const validationResults = await validateEmailAddresses(recipients);
  const invalidEmails = validationResults.filter(r => !r.valid);
  const validEmails = validationResults.filter(r => r.valid).map(r => r.email);
  
  // Log validation failures
  if (invalidEmails.length > 0) {
    console.warn("[email-validation] Invalid email addresses detected:", 
      invalidEmails.map(r => `${r.email}: ${r.reason}`).join(", ")
    );
  }
  
  // Log warnings for valid emails
  const emailsWithWarnings = validationResults.filter(r => r.valid && r.warnings && r.warnings.length > 0);
  if (emailsWithWarnings.length > 0) {
    console.warn("[email-validation] Warnings:", 
      emailsWithWarnings.map(r => `${r.email}: ${r.warnings?.join(", ")}`).join("; ")
    );
  }
  
  if (!transport) {
    console.log("[dev-mail]", { from, to: validEmails, subject, text, html, attachments: attachments?.map(a => a.filename) });
    return { 
      accepted: validEmails, 
      rejected: invalidEmails.map(r => r.email),
      sentAt,
      smtpServer: "dev-mode",
      smtpPort: 0,
      smtpSecure: false,
      response: "Development mode - email not actually sent",
      validationResults,
      preValidationFailures: invalidEmails.length > 0 ? invalidEmails.map(r => `${r.email}: ${r.reason}`) : undefined,
    };
  }
  
  // If all emails are invalid, don't attempt to send
  if (validEmails.length === 0) {
    return {
      accepted: [],
      rejected: invalidEmails.map(r => r.email),
      sentAt,
      smtpServer,
      smtpPort,
      smtpSecure,
      smtpUser,
      response: "All recipient addresses failed validation",
      validationResults,
      preValidationFailures: invalidEmails.map(r => `${r.email}: ${r.reason}`),
    };
  }
  
  // Send only to valid emails
  const result = await transport.sendMail({ from, to: validEmails, subject, text, html, attachments });
  
  return {
    accepted: result.accepted as string[],
    rejected: [...(result.rejected as string[]), ...invalidEmails.map(r => r.email)],
    response: result.response,
    messageId: result.messageId,
    envelope: result.envelope as { from: string; to: string[] },
    smtpServer,
    smtpPort,
    smtpSecure,
    smtpUser,
    sentAt,
    validationResults,
    preValidationFailures: invalidEmails.length > 0 ? invalidEmails.map(r => `${r.email}: ${r.reason}`) : undefined,
  };
}
