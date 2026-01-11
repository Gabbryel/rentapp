/**
 * Server-side utility to generate indexing notice HTML
 */

import { escapeHtml } from "@/lib/utils/html";

function fmtDate(dateIso?: string) {
  if (!dateIso) return "";
  const d = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear());
  return `${dd}.${mm}.${yy}`;
}

export type IndexingNoticeData = {
  id?: string;
  at?: string;
  meta?: Record<string, unknown> | null;
  userEmail?: string | null;
  contractName?: string;
};

export function buildIndexingNoticeHtml(notice: IndexingNoticeData): string {
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

  const indexedRentEUR =
    typeof meta.newRentEUR === "number"
      ? (meta.newRentEUR as number)
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

  const letterText = `Către: ${partnerName}
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
    }%
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
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="doc">${escapeHtml(letterText)}</div>
      <div class="meta">Perioadă: ${escapeHtml(fromMonth)} → ${escapeHtml(
    toMonth
  )}</div>
    </div>
  </body>
</html>`;
}
