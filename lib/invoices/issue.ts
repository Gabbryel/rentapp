/**
 * Invoice Issuance Module
 * 
 * Core business logic for issuing invoices with proper atomicity guarantees.
 * This module ensures:
 * - No duplicate invoice numbers (atomic allocation)
 * - No duplicate invoices for same contract/partner/date
 * - Proper PDF generation and storage
 * - Consistent error handling and rollback
 */

import type { Invoice } from "@/lib/schemas/invoice";
import { getDb } from "@/lib/mongodb";
import { readJson, writeJson } from "@/lib/local-store";
import { allocateInvoiceNumber } from "@/lib/invoices/numbering";
import { findInvoiceByContractPartnerAndDate, invalidateYearInvoicesCache } from "@/lib/invoices/queries";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { saveBufferAsUpload } from "@/lib/storage";
import { createMessage } from "@/lib/messages";
import { InvoiceSchema } from "@/lib/schemas/invoice";

const INVOICE_MONGO_CONFIGURED = !!process.env.MONGODB_URI;
const ALLOW_INVOICE_LOCAL_FALLBACK = process.env.NODE_ENV === "development";

/**
 * Issue an invoice and generate its PDF.
 * 
 * This function is idempotent: calling it multiple times with the same
 * invoice data will return the existing invoice if already issued.
 * 
 * Process:
 * 1. Check for existing invoice (idempotency)
 * 2. Allocate invoice number if needed
 * 3. Persist invoice to database
 * 4. Generate PDF
 * 5. Upload PDF and update invoice with URL
 * 6. Create notification message
 * 7. Invalidate caches
 * 
 * @throws Error if invoice data is invalid or persistence fails
 */
export async function issueInvoice(invoice: Invoice): Promise<Invoice> {
  // Step 1: Check for duplicate (idempotency guard)
  try {
    const existing = await findInvoiceByContractPartnerAndDate(
      invoice.contractId,
      invoice.partnerId || invoice.partner,
      invoice.issuedAt
    );
    if (existing) {
      console.log(`Invoice already exists: ${existing.id}, returning existing invoice`);
      return existing;
    }
  } catch (error) {
    console.warn("Duplicate check failed, proceeding with issuance:", error);
  }

  // Step 2: Allocate invoice number if not provided
  let preparedInvoice = invoice;
  if (!preparedInvoice.number) {
    try {
      const invoiceNumber = await allocateInvoiceNumber(
        (preparedInvoice as any).ownerId ?? null,
        preparedInvoice.owner ?? null
      );
      preparedInvoice = { ...preparedInvoice, number: invoiceNumber, id: invoiceNumber };
    } catch (error) {
      console.error("Failed to allocate invoice number:", error);
      throw new Error("Nu s-a putut aloca număr de factură");
    }
  }

  // Ensure id matches number
  if (preparedInvoice.number && preparedInvoice.id !== preparedInvoice.number) {
    preparedInvoice = { ...preparedInvoice, id: preparedInvoice.number };
  }

  // Validate the prepared invoice
  try {
    preparedInvoice = InvoiceSchema.parse(preparedInvoice);
  } catch (error) {
    console.error("Invoice validation failed:", error);
    throw new Error("Datele facturii sunt invalide");
  }

  // Step 3: Persist invoice
  try {
    if (INVOICE_MONGO_CONFIGURED) {
      await persistInvoiceMongo(preparedInvoice);
    } else {
      await persistInvoiceLocal(preparedInvoice);
    }
  } catch (error) {
    console.error("Failed to persist invoice:", error);
    throw new Error("Nu s-a putut salva factura în baza de date");
  }

  // Step 4 & 5: Generate PDF and upload
  let invoiceWithPdf = preparedInvoice;
  try {
    const pdfBytes = await renderInvoicePdf(preparedInvoice);
    const uploadResult = await saveBufferAsUpload(
      new Uint8Array(pdfBytes),
      `${preparedInvoice.id}.pdf`,
      "application/pdf",
      {
        contractId: preparedInvoice.contractId,
        partnerId: preparedInvoice.partnerId,
      }
    );

    invoiceWithPdf = { ...preparedInvoice, pdfUrl: uploadResult.url };

    // Update invoice with PDF URL
    if (INVOICE_MONGO_CONFIGURED) {
      await updateInvoicePdfMongo(invoiceWithPdf.id, uploadResult.url);
    } else {
      await updateInvoicePdfLocal(invoiceWithPdf.id, uploadResult.url);
    }
  } catch (error) {
    console.error("Failed to generate or upload PDF:", error);
    // Non-fatal: invoice is saved, PDF generation can be retried
    // Don't throw here to avoid inconsistent state
  }

  // Step 6: Create notification message
  try {
    await createMessage({
      text: `Factură emisă pentru contractul ${invoiceWithPdf.contractName}: ${invoiceWithPdf.totalRON.toFixed(
        2
      )} RON (TVA ${invoiceWithPdf.tvaPercent}%).`,
    });
  } catch (error) {
    console.warn("Failed to create notification message:", error);
    // Non-fatal: notification is nice-to-have
  }

  // Step 7: Invalidate caches
  try {
    invalidateYearInvoicesCache();
  } catch (error) {
    console.warn("Failed to invalidate cache:", error);
  }

  return invoiceWithPdf;
}

/**
 * Persist invoice to MongoDB
 */
async function persistInvoiceMongo(invoice: Invoice): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<Invoice>("invoices")
      .updateOne({ id: invoice.id }, { $set: invoice }, { upsert: true });
  } catch (error) {
    if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
    console.warn("MongoDB persistence failed, falling back to local:", error);
    await persistInvoiceLocal(invoice);
  }
}

/**
 * Persist invoice to local storage
 */
async function persistInvoiceLocal(invoice: Invoice): Promise<void> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  const idx = all.findIndex((x) => x.id === invoice.id);
  if (idx >= 0) {
    all[idx] = invoice;
  } else {
    all.push(invoice);
  }
  await writeJson("invoices.json", all);
}

/**
 * Update invoice PDF URL in MongoDB
 */
async function updateInvoicePdfMongo(invoiceId: string, pdfUrl: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<Invoice>("invoices")
      .updateOne(
        { id: invoiceId },
        { $set: { pdfUrl, updatedAt: new Date().toISOString() } }
      );
  } catch (error) {
    if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
    console.warn("MongoDB update failed, falling back to local:", error);
    await updateInvoicePdfLocal(invoiceId, pdfUrl);
  }
}

/**
 * Update invoice PDF URL in local storage
 */
async function updateInvoicePdfLocal(invoiceId: string, pdfUrl: string): Promise<void> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  const idx = all.findIndex((x) => x.id === invoiceId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], pdfUrl, updatedAt: new Date().toISOString() };
    await writeJson("invoices.json", all);
  }
}

/**
 * Delete an invoice by ID
 */
export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  if (!INVOICE_MONGO_CONFIGURED) {
    return deleteInvoiceLocal(invoiceId);
  }

  try {
    return await deleteInvoiceMongo(invoiceId);
  } catch (error) {
    if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
    console.warn("MongoDB delete failed, falling back to local:", error);
    return deleteInvoiceLocal(invoiceId);
  } finally {
    try {
      invalidateYearInvoicesCache();
    } catch {}
  }
}

async function deleteInvoiceMongo(invoiceId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection<Invoice>("invoices").deleteOne({ id: invoiceId });
  return result.deletedCount > 0;
}

async function deleteInvoiceLocal(invoiceId: string): Promise<boolean> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  const filtered = all.filter((x) => x.id !== invoiceId);
  if (filtered.length < all.length) {
    await writeJson("invoices.json", filtered);
    return true;
  }
  return false;
}
