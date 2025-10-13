import { sendMail } from "@/lib/email";

function appBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function layout({ title, preheader, bodyHtml }: { title: string; preheader?: string; bodyHtml: string }) {
  const brand = "RentApp";
  const color = "#0f172a"; // slate-900
  const accent = "#0ea5e9"; // sky-500
  const pre = preheader ? `<span class="preheader" style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preheader}</span>` : "";
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>${title}</title>
  <style>
    body{background:#f8fafc;margin:0;padding:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;}
    .container{max-width:560px;margin:24px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
    .header{background:${color};color:#fff;padding:16px 20px;font-weight:700}
    .content{padding:20px;color:#0f172a;font-size:14px;line-height:1.6}
    .btn{display:inline-block;background:${accent};color:#fff!important;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}
    .muted{color:#64748b;font-size:12px}
    .footer{padding:12px 20px;text-align:center;color:#94a3b8;font-size:12px}
  </style>
  ${pre}
  </head>
<body>
  <div class="container">
    <div class="header">${brand}</div>
    <div class="content">${bodyHtml}</div>
    <div class="footer">© ${new Date().getFullYear()} ${brand}</div>
  </div>
</body>
</html>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${appBaseUrl()}/verify?token=${encodeURIComponent(token)}`;
  const html = layout({
    title: "Verificați contul",
    preheader: "Confirmați adresa de email pentru a finaliza contul",
    bodyHtml: `
      <h2>Confirmare adresă email</h2>
      <p>Vă mulțumim pentru înregistrare. Pentru a finaliza contul, vă rugăm să confirmați adresa de email.</p>
      <p><a class="btn" href="${url}">Verificați adresa de email</a></p>
      <p class="muted">Dacă butonul nu funcționează, copiați și lipiți următorul link în browser:<br/>${url}</p>
    `,
  });
  return sendMail({ to, subject: "Verificați contul", html, text: `Confirmați contul: ${url}` });
}

export async function sendResetEmail(to: string, token: string) {
  const url = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const html = layout({
    title: "Resetare parolă",
    preheader: "Cereți o nouă parolă pentru contul dvs.",
    bodyHtml: `
      <h2>Resetare parolă</h2>
      <p>Ați primit acest email deoarece a fost solicitată resetarea parolei pentru contul dvs.</p>
      <p><a class="btn" href="${url}">Setați o parolă nouă</a></p>
      <p class="muted">Dacă nu ați inițiat această acțiune, ignorați acest mesaj.</p>
      <p class="muted">Linkul expiră în aproximativ 2 ore. Dacă butonul nu funcționează, folosiți linkul: ${url}</p>
    `,
  });
  return sendMail({ to, subject: "Resetare parolă", html, text: `Resetați parola: ${url}` });
}

export async function sendInviteEmail(to: string, token: string) {
  const url = `${appBaseUrl()}/register?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`;
  const html = layout({
    title: "Invitație alăturare cont",
    preheader: "Ați fost invitat(ă) să vă creați un cont",
    bodyHtml: `
      <h2>Bun venit!</h2>
      <p>Ați fost invitat(ă) să vă creați un cont în aplicația RentApp.</p>
      <p><a class="btn" href="${url}">Creați contul</a></p>
      <p class="muted">Dacă butonul nu funcționează, copiați și lipiți linkul: ${url}</p>
    `,
  });
  return sendMail({ to, subject: "Invitație de înregistrare", html, text: `Creați contul: ${url}` });
}
