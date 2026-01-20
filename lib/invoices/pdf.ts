/**
 * Invoice PDF Generation Module
 * 
 * Separates PDF rendering logic from business logic.
 * Generates simple invoice PDFs with all required information.
 */

import { PDFDocument, rgb } from "pdf-lib";
import type { Invoice } from "@/lib/schemas/invoice";
import { loadPdfFonts } from "@/lib/pdf-fonts";

/**
 * Renders an invoice as a PDF buffer
 */
export async function renderInvoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait in points
  const { font, fontBold } = await loadPdfFonts(pdfDoc);
  const margin = 40;
  let y = 800;

  const text = (
    content: string,
    opts?: { size?: number; bold?: boolean; color?: { r: number; g: number; b: number } }
  ) => {
    const size = opts?.size ?? 12;
    const f = opts?.bold ? fontBold : font;
    const color = opts?.color ? rgb(opts.color.r, opts.color.g, opts.color.b) : rgb(0, 0, 0);
    page.drawText(content, { x: margin, y, size, font: f, color });
    y -= size + 6;
  };

  // Header
  text("Factură", { size: 20, bold: true });
  text(`Număr: ${invoice.number || invoice.id}`);
  text(`Data emiterii: ${invoice.issuedAt}`);
  text("");

  // Contract and parties
  text(`Contract: ${invoice.contractName} (ID ${invoice.contractId})`, { bold: true });
  text(`Vânzător: ${invoice.owner}`);
  text(`Cumpărător: ${invoice.partner}`);
  text("");

  // Amounts
  text(`Suma (EUR): ${invoice.amountEUR.toFixed(2)}`);
  text(
    `Corecție: ${invoice.correctionPercent}% → EUR după corecție: ${invoice.correctedAmountEUR.toFixed(2)}`
  );
  text(`Curs RON/EUR: ${invoice.exchangeRateRON.toFixed(4)}`);
  text(`Bază RON: ${invoice.netRON.toFixed(2)}`);
  text(`TVA ${invoice.tvaPercent}%: ${invoice.vatRON.toFixed(2)} RON`);
  text("");

  // Total
  text(`TOTAL: ${invoice.totalRON.toFixed(2)} RON`, { size: 14, bold: true });

  if (invoice.dueDays > 0) {
    const issuedDate = new Date(invoice.issuedAt);
    const dueDate = new Date(issuedDate);
    dueDate.setDate(dueDate.getDate() + invoice.dueDays);
    text(`Termen plată: ${dueDate.toISOString().slice(0, 10)} (${invoice.dueDays} zile)`);
  }

  if (invoice.note) {
    text("");
    text(`Notă: ${invoice.note}`);
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
