/**
 * Server-side utility to generate indexing notice PDF
 */

import { PDFDocument, rgb } from "pdf-lib";
import { loadPdfFonts } from "./pdf-fonts";

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

export async function generateIndexingNoticePdf(
  notice: IndexingNoticeData
): Promise<Uint8Array> {
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

  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;

  const pdfDoc = await PDFDocument.create();
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  const { font, fontBold } = await loadPdfFonts(pdfDoc);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const addLine = (
    text: string,
    opts?: {
      size?: number;
      bold?: boolean;
      color?: { r: number; g: number; b: number };
      leading?: number;
    }
  ) => {
    const size = opts?.size ?? 11;
    const leading = opts?.leading ?? size + 4;
    const f = opts?.bold ? fontBold : font;
    const color = opts?.color
      ? rgb(opts.color.r, opts.color.g, opts.color.b)
      : rgb(0, 0, 0);
    ensureSpace(leading);
    currentPage.drawText(text, { x: margin, y, size, font: f, color });
    y -= leading;
  };

  const addWrapped = (
    text: string,
    opts?: {
      size?: number;
      bold?: boolean;
      color?: { r: number; g: number; b: number };
      leading?: number;
    }
  ) => {
    if (!text) {
      y -= opts?.leading ?? (opts?.size ? opts.size / 2 : 6);
      return;
    }
    const size = opts?.size ?? 11;
    const leading = opts?.leading ?? size + 4;
    const f = opts?.bold ? fontBold : font;
    const words = String(text).split(/\s+/).filter((w) => w.length > 0);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = f.widthOfTextAtSize(candidate, size);
      if (width > maxWidth && line) {
        addLine(line, { ...opts, leading });
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      addLine(line, { ...opts, leading });
    }
  };

  const addSpacer = (gap = 8) => {
    ensureSpace(gap);
    y -= gap;
  };

  // Check if there's edited content - if so, use it directly
  if (typeof meta.editedContent === "string" && meta.editedContent.trim()) {
    const editedText = meta.editedContent.trim();
    // Split by lines and render as plain text
    const lines = editedText.split("\n");
    for (const line of lines) {
      if (!line.trim()) {
        addSpacer(8);
      } else {
        addWrapped(line);
      }
    }
  } else {
    // Generate default content
    // Header
    addLine(`Către: ${partnerName}`, { bold: true, size: 12 });
    addWrapped(`Adresa: ${partnerAddress}`);
    addLine(`CNP/CUI: ${partnerCui}`);
    addSpacer(12);
    addLine(`De la: ${ownerName}`, { bold: true });
    addSpacer(16);

    // Subject
    addWrapped(
      "Subiect: Indexarea chiriei în funcție de rata inflației în euro aferentă ultimului an calendaristic",
      { bold: true, size: 12 }
    );
    addSpacer(12);

    // Body
    addWrapped(`Stimate/Stimată ${representative},`);
    addSpacer(8);

    addWrapped(
      `Subscrisa ${ownerName}, prin prezenta, vă aducem la cunoștință faptul că, în conformitate cu prevederile art. 5.1. din Contractul de închiriere nr. ${contractNumber} din data de ${contractSignedAtText} (în continuare „Contractul”), chiria stabilită pentru imobilul situat în ${assetAddress} urmează să fie indexată cu rata inflației în euro aferentă ultimului an calendaristic, potrivit mecanismului de ajustare convenit de părți.`
    );
    addSpacer(8);

    addWrapped(
      `În consecință, începând cu data de ${validFromText}, chiria lunară se va ajusta după cum urmează:`
    );
    addSpacer(6);

    // Bullet points
    addWrapped(
      `    •   Chirie actuală: ${
        typeof rentEUR === "number" ? rentEUR.toFixed(2) : "{current rent amount}"
      } EUR/lună`
    );
    addWrapped(
      `    •   Rata inflației (EUR) pentru ultimul an calendaristic: ${
        typeof deltaPercent === "number"
          ? deltaPercent.toFixed(2)
          : "{inflation rate}"
      }%${note ? ` (${note})` : ""}`
    );
    addWrapped(
      `    •   Chirie indexată: ${
      typeof indexedRentEUR === "number"
        ? indexedRentEUR
        : "{rent amount indexed}"
    } EUR/lună + T.V.A. aplicabil + procent corecție curs B.N.R.`
  );
  addSpacer(8);

  addWrapped(
    "Plata chiriei indexate se va efectua în aceleași condiții, termene și în același cont prevăzute în Contract, în lipsa unei notificări contrare scrise din partea noastră."
  );
  addSpacer(8);

  addWrapped(
    "Prezenta notificare este transmisă cu respectarea dispozițiilor Contractului privind comunicările între părți și produce efecte de la data indicată mai sus."
  );
  addSpacer(12);

  addLine("Cu stimă,");
  addSpacer(16);

  addLine(`${ownerName}`);
  addSpacer(16);
  }

  return await pdfDoc.save();
}
