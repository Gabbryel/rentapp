/**
 * Renumber invoices that share the same invoice number due to the old allocation race condition.
 *
 * Strategy: within each duplicate group (same `id` value), keep the OLDEST document
 * (lowest ObjectId = inserted first) at its original number, and re-number every
 * other document with a fresh unique number allocated by the current atomic allocator.
 * Also regenerates and re-uploads the PDF for each re-numbered invoice.
 *
 * Usage:
 *   npx tsx scripts/renumber-duplicate-invoices.ts           ← dry run (prints plan)
 *   npx tsx scripts/renumber-duplicate-invoices.ts --execute ← applies changes
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { InvoiceSchema, type Invoice } from "@/lib/schemas/invoice";
import { allocateInvoiceNumber } from "@/lib/invoices/numbering";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { saveBufferAsUpload } from "@/lib/storage";

const DRY_RUN = !process.argv.includes("--execute");

/**
 * Old documents stored `null` in optional fields; Zod expects `undefined`.
 * Strip all null values before parsing so schema validation passes.
 */
function coerceDoc(doc: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(doc).filter(([, v]) => v !== null));
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (pass --execute to apply) ===" : "=== EXECUTING CHANGES ===");
  console.log();

  const db = await getDb();
  const col = db.collection("invoices");

  // Find all invoice numbers shared across multiple documents.
  const dupGroups = await col
    .aggregate([
      { $group: { _id: "$id", count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  if (dupGroups.length === 0) {
    console.log("✅ No duplicate invoice numbers found. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${dupGroups.length} number(s) shared across multiple invoices.\n`);

  let totalKept = 0;
  let totalRenumbered = 0;
  let totalErrors = 0;

  for (const group of dupGroups) {
    const sharedNumber = String(group._id);
    const objectIds: ObjectId[] = (group.ids as ObjectId[]).sort((a, b) =>
      // Sort ascending so the oldest document (first inserted) comes first
      a.toString().localeCompare(b.toString()),
    );

    // Fetch full documents for all entries in the group
    const docs = await col
      .find({ _id: { $in: objectIds } }, { projection: { _id: 1, id: 1, number: 1, contractId: 1, partner: 1, partnerId: 1, owner: 1, ownerId: 1, issuedAt: 1, pdfUrl: 1 } })
      .toArray();

    // Sort docs by _id ascending to keep the oldest
    docs.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

    const [keep, ...renumber] = docs;

    console.log(`Number: ${sharedNumber}  (${docs.length} docs)`);
    console.log(`  KEEP  _id=${keep._id}  contract=${keep.contractId}  partner=${keep.partner}`);
    totalKept++;

    for (const doc of renumber) {
      try {
        // Fetch full document (we need all fields for PDF generation)
        const full = await col.findOne({ _id: doc._id }, { projection: { _id: 0 } });
        if (!full) {
          console.warn(`  ERROR _id=${doc._id}: document not found`);
          totalErrors++;
          continue;
        }

        // Parse and validate as Invoice; strip nulls first since old docs stored
        // null instead of undefined for optional fields.
        let invoice: Invoice;
        try {
          invoice = InvoiceSchema.parse(coerceDoc(full as Record<string, unknown>));
        } catch (parseErr) {
          // Last-resort fallback: proceed with raw doc
          invoice = full as unknown as Invoice;
          console.warn(`  WARN  _id=${doc._id}: schema parse failed, proceeding with raw doc. ${parseErr}`);
        }

        // Allocate a fresh unique number
        const newNumber = await (DRY_RUN
          ? Promise.resolve(`[new-number-for-${doc._id}]`)
          : allocateInvoiceNumber(invoice.ownerId ?? null, invoice.owner ?? null));

        console.log(`  RENUMBER _id=${doc._id}  contract=${doc.contractId}  partner=${doc.partner}`);
        console.log(`           ${sharedNumber} → ${newNumber}`);

        if (!DRY_RUN) {
          const updatedInvoice: Invoice = {
            ...invoice,
            id: newNumber,
            number: newNumber,
            updatedAt: new Date().toISOString(),
          };

          // Re-generate PDF with the new number
          let newPdfUrl: string | undefined;
          try {
            const pdfBytes = await renderInvoicePdf(updatedInvoice);
            const upload = await saveBufferAsUpload(
              new Uint8Array(pdfBytes),
              `${newNumber}.pdf`,
              "application/pdf",
              { contractId: updatedInvoice.contractId, partnerId: updatedInvoice.partnerId },
            );
            newPdfUrl = upload.url;
            console.log(`           PDF → ${newPdfUrl}`);
          } catch (pdfErr) {
            console.warn(`           PDF generation failed: ${pdfErr}. Proceeding without PDF.`);
          }

          // Build the final document to save
          const finalDoc: Record<string, unknown> = { ...updatedInvoice };
          if (newPdfUrl) finalDoc.pdfUrl = newPdfUrl;

          // Replace the document in-place using _id
          await col.replaceOne({ _id: doc._id }, finalDoc);
          console.log(`           ✓ Saved`);
        }

        totalRenumbered++;
      } catch (err) {
        console.error(`  ERROR _id=${doc._id}:`, err);
        totalErrors++;
      }
    }

    console.log();
  }

  console.log("─────────────────────────────────────────");
  console.log(`Kept at original number : ${totalKept}`);
  console.log(`Re-numbered             : ${totalRenumbered}`);
  if (totalErrors > 0) console.log(`Errors                  : ${totalErrors}`);
  if (DRY_RUN) {
    console.log("\nThis was a DRY RUN. Pass --execute to apply changes.");
  } else {
    console.log("\n✅ Done.");
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
