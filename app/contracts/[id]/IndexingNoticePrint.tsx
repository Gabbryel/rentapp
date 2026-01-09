"use client";

import * as React from "react";

export type IndexingNoticePrintable = {
  id?: string;
  at?: string;
  meta?: Record<string, unknown> | null;
  userEmail?: string | null;
  contractName?: string;
  sendHistory?: Array<{
    sentAt: string;
    to: string;
    subject?: string;
    validFrom?: string;
    newRentEUR?: number;
    deltaPercent?: number;
    messageId?: string;
    serverResponse?: string;
    accepted?: string[];
    rejected?: string[];
    smtpServer?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
  }>;
};

function escapeHtml(input: unknown) {
  const s = String(input ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function fmtDate(dateIso?: string) {
  if (!dateIso) return "";
  const d = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear());
  return `${dd}.${mm}.${yy}`;
}

export default React.forwardRef<
  { triggerPrint: () => void },
  { notice: IndexingNoticePrintable }
>(function IndexingNoticePrint({ notice }, ref) {
  const buildHtml = React.useCallback(() => {
    const meta = (notice?.meta ?? {}) as Record<string, unknown>;

    const fromMonth = String(meta.fromMonth || meta.from || "?");
    const toMonth = String(meta.toMonth || meta.to || "?");
    const deltaPercent =
      typeof meta.deltaPercent === "number" ? meta.deltaPercent : undefined;
    const rentEUR = typeof meta.rentEUR === "number" ? meta.rentEUR : undefined;
    const metaValidFrom =
      typeof meta.validFrom === "string" ? String(meta.validFrom) : "";

    const contractNumber =
      (typeof meta.contractNumber === "string" && meta.contractNumber.trim()) ||
      "{contract number}";
    const contractSignedAtIso =
      typeof meta.contractSignedAt === "string"
        ? String(meta.contractSignedAt).slice(0, 10)
        : "";
    const contractSignedAtText = contractSignedAtIso
      ? fmtDate(contractSignedAtIso)
      : "{contract begining date}";

    const issuedAtIso =
      typeof notice?.at === "string" ? notice.at.slice(0, 10) : "";

    const effectiveValidFromIso = (() => {
      const v = metaValidFrom ? metaValidFrom.slice(0, 10) : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedAtIso)) return "";
      const d = new Date(`${issuedAtIso}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return "";
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
        .toISOString()
        .slice(0, 10);
    })();

    const partnerName =
      (typeof meta.partnerName === "string" && meta.partnerName.trim()) ||
      "{partner}";
    const partnerAddress =
      (typeof meta.partnerAddress === "string" && meta.partnerAddress.trim()) ||
      "{partner address}";
    const partnerCui =
      (typeof meta.partnerCui === "string" && meta.partnerCui.trim()) ||
      "{partner CUI}";
    const ownerName =
      (typeof meta.ownerName === "string" && meta.ownerName.trim()) ||
      "{owner}";
    const representative =
      (typeof meta.partnerRepresentative === "string" &&
        meta.partnerRepresentative.trim()) ||
      "{representative}";

    const assetAddress =
      (typeof meta.assetAddress === "string" && meta.assetAddress.trim()) ||
      "[adresa imobilului]";

    const note = typeof meta.note === "string" ? meta.note.trim() : "";

    const indexedRentEUR =
      typeof meta.newRentEUR === "number"
        ? Math.ceil(meta.newRentEUR as number)
        : typeof rentEUR === "number" && typeof deltaPercent === "number"
        ? Math.ceil(rentEUR * (1 + deltaPercent / 100))
        : undefined;

    const validFromText = effectiveValidFromIso
      ? fmtDate(effectiveValidFromIso)
      : "[data de aplicare]";

    const nextMonthText = (() => {
      if (!effectiveValidFromIso) return "{next month}";
      const d = new Date(`${effectiveValidFromIso}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return "{next month}";
      try {
        return new Intl.DateTimeFormat("ro-RO", {
          month: "long",
          year: "numeric",
        }).format(d);
      } catch {
        return "{next month}";
      }
    })();

    const letterText =
      typeof meta.editedContent === "string" && meta.editedContent.trim()
        ? meta.editedContent.trim()
        : `Către: ${partnerName}
Adresa: ${partnerAddress}
CNP/CUI: ${partnerCui}

De la: ${ownerName}


Subiect: Indexarea chiriei în funcție de rata inflației în euro aferentă ultimului an calendaristic

Stimate/Stimată ${representative},

Subscrisa ${ownerName}, prin prezenta, vă aducem la cunoștință faptul că, în conformitate cu prevederile art. 5.1. din Contractul de închiriere nr. ${contractNumber} din data de ${contractSignedAtText} (în continuare „Contractul”), chiria stabilită pentru imobilul situat în ${assetAddress} urmează să fie indexată cu rata inflației în euro aferentă ultimului an calendaristic, potrivit mecanismului de ajustare convenit de părți.

În consecință, începând cu data de ${validFromText}, chiria lunară se va ajusta după cum urmează:
    •   Chirie actuală: ${
      typeof rentEUR === "number" ? rentEUR.toFixed(2) : "{current rent amount}"
    } EUR/lună
    •   Rata inflației (EUR) pentru ultimul an calendaristic: ${
      typeof deltaPercent === "number"
        ? deltaPercent.toFixed(2)
        : "{inflation rate}"
    }%${note ? ` (${note})` : ""}
    •   Chirie indexată: ${
      typeof indexedRentEUR === "number"
        ? indexedRentEUR
        : "{rent amount indexed}"
    } EUR/lună + T.V.A. aplicabil + procent corecție curs B.N.R.

Plata chiriei indexate se va efectua în aceleași condiții, termene și în același cont prevăzute în Contract, în lipsa unei notificări contrare scrise din partea noastră.

Prezenta notificare este transmisă cu respectarea dispozițiilor Contractului privind comunicările între părți și produce efecte de la data indicată mai sus.

Cu stimă,
${ownerName}`;

    const title = `Notificare indexare – ${notice.contractName || ""}`.trim();

    // Build delivery information section
    const sendHistoryHtml =
      notice.sendHistory && notice.sendHistory.length > 0
        ? `
      <div class="delivery-section">
        <h3>Informații despre livrare</h3>
        ${notice.sendHistory
          .map((send, idx) => {
            const sentDate = new Date(send.sentAt);
            const sentFormatted = sentDate.toLocaleString("ro-RO", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return `
          <div class="delivery-entry">
            <div class="delivery-header">Trimitere #${idx + 1} – ${escapeHtml(
              sentFormatted
            )}</div>
            <div class="delivery-grid">
              <div class="delivery-row">
                <span class="label">Destinatar:</span>
                <span class="value">${escapeHtml(send.to)}</span>
              </div>
              ${
                send.subject
                  ? `
              <div class="delivery-row">
                <span class="label">Subiect:</span>
                <span class="value">${escapeHtml(send.subject)}</span>
              </div>`
                  : ""
              }
              ${
                send.validFrom
                  ? `
              <div class="delivery-row">
                <span class="label">Valabil de la:</span>
                <span class="value">${escapeHtml(send.validFrom)}</span>
              </div>`
                  : ""
              }
              ${
                send.newRentEUR
                  ? `
              <div class="delivery-row">
                <span class="label">Chirie nouă:</span>
                <span class="value">${send.newRentEUR.toFixed(2)} EUR</span>
              </div>`
                  : ""
              }
              ${
                send.deltaPercent
                  ? `
              <div class="delivery-row">
                <span class="label">Procent indexare:</span>
                <span class="value">+${send.deltaPercent.toFixed(2)}%</span>
              </div>`
                  : ""
              }
            </div>
            
            ${
              send.smtpServer || send.messageId || send.serverResponse
                ? `
            <div class="server-section">
              <div class="server-header">Detalii tehnice server</div>
              <div class="delivery-grid">
                ${
                  send.smtpServer
                    ? `
                <div class="delivery-row">
                  <span class="label">Server SMTP:</span>
                  <span class="value mono">${escapeHtml(send.smtpServer)}:${
                        send.smtpPort
                      }${send.smtpSecure ? " (SSL)" : ""}</span>
                </div>`
                    : ""
                }
                ${
                  send.smtpUser
                    ? `
                <div class="delivery-row">
                  <span class="label">Utilizator:</span>
                  <span class="value mono">${escapeHtml(send.smtpUser)}</span>
                </div>`
                    : ""
                }
                ${
                  send.messageId
                    ? `
                <div class="delivery-row">
                  <span class="label">Message ID:</span>
                  <span class="value mono small">${escapeHtml(
                    send.messageId
                  )}</span>
                </div>`
                    : ""
                }
                ${
                  send.accepted && send.accepted.length > 0
                    ? `
                <div class="delivery-row">
                  <span class="label success">✓ Acceptat:</span>
                  <span class="value mono">${escapeHtml(
                    send.accepted.join(", ")
                  )}</span>
                </div>`
                    : ""
                }
                ${
                  send.rejected && send.rejected.length > 0
                    ? `
                <div class="delivery-row">
                  <span class="label error">✗ Respins:</span>
                  <span class="value mono">${escapeHtml(
                    send.rejected.join(", ")
                  )}</span>
                </div>`
                    : ""
                }
                ${
                  send.serverResponse
                    ? `
                <div class="delivery-row">
                  <span class="label">Răspuns server:</span>
                  <span class="value mono small">${escapeHtml(
                    send.serverResponse
                  )}</span>
                </div>`
                    : ""
                }
              </div>
            </div>`
                : ""
            }
          </div>`;
          })
          .join("")}
      </div>`
        : "";

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: Arial, sans-serif;
        color: #111827;
        background: #ffffff;
        padding: 28px;
      }
      .wrap { max-width: 820px; margin: 0 auto; }
      .doc { white-space: pre-wrap; font-size: 14px; line-height: 1.55; }
      .meta { margin-top: 14px; font-size: 12px; color: #6b7280; }
      
      .delivery-section {
        margin-top: 32px;
        padding-top: 24px;
        border-top: 2px solid #e5e7eb;
      }
      .delivery-section h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: #374151;
      }
      .delivery-entry {
        margin-bottom: 20px;
        padding: 16px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        page-break-inside: avoid;
      }
      .delivery-header {
        font-size: 13px;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
      }
      .delivery-grid {
        display: grid;
        gap: 8px;
      }
      .delivery-row {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 12px;
        font-size: 12px;
        line-height: 1.4;
      }
      .label {
        font-weight: 500;
        color: #6b7280;
      }
      .label.success {
        color: #059669;
      }
      .label.error {
        color: #dc2626;
      }
      .value {
        color: #111827;
        word-break: break-word;
      }
      .value.mono {
        font-family: 'Courier New', monospace;
      }
      .value.small {
        font-size: 10px;
      }
      .server-section {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px dashed #d1d5db;
      }
      .server-header {
        font-size: 11px;
        font-weight: 600;
        color: #6b7280;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      @media print {
        body { padding: 16px; }
        .delivery-entry { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="doc">${escapeHtml(letterText)}</div>
      <div class="meta">Perioadă: ${escapeHtml(fromMonth)} → ${escapeHtml(
      toMonth
    )}</div>
      ${sendHistoryHtml}
    </div>
  </body>
</html>`;
  }, [notice]);

  const onPrint = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const html = buildHtml();
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }, [buildHtml]);

  const onView = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const html = buildHtml();
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  }, [buildHtml]);

  React.useImperativeHandle(
    ref,
    () => ({
      triggerPrint: onPrint,
    }),
    [onPrint]
  );

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onView}
        className="rounded-md border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
      >
        Vezi
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="rounded-md border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
      >
        Printează
      </button>
    </div>
  );
});
