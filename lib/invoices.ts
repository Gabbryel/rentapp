import { getDb } from "@/lib/mongodb";
import { InvoiceSchema, type Invoice } from "@/lib/schemas/invoice";
import { type Contract } from "@/lib/schemas/contract";
import { saveBufferAsUpload } from "@/lib/storage";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createMessage } from "@/lib/messages";
import { allocateInvoiceNumberForOwner } from "@/lib/invoice-settings";
import { readJson, writeJson } from "@/lib/local-store";

export async function createInvoice(inv: Invoice) {
  InvoiceSchema.parse(inv);
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const idx = all.findIndex((x) => x.id === inv.id);
    if (idx >= 0) all[idx] = inv; else all.push(inv);
    await writeJson("invoices.json", all);
    return;
  }
  const db = await getDb();
  await db.collection<Invoice>("invoices").insertOne(inv);
}

export async function fetchInvoicesByContract(contractId: string): Promise<Invoice[]> {
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    return all.filter((x) => x.contractId === contractId).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  }
  try {
    const db = await getDb();
    const docs = await db
      .collection<Invoice>("invoices")
      .find({ contractId }, { projection: { _id: 0 } })
      .sort({ issuedAt: 1 })
      .toArray();
    return docs.map((d) => InvoiceSchema.parse(d));
  } catch {
    const all = await readJson<Invoice[]>("invoices.json", []);
    return all.filter((x) => x.contractId === contractId).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  }
}

export async function fetchInvoicesByPartner(partnerId: string): Promise<Invoice[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const docs = await db
    .collection<Invoice>("invoices")
    .find({ partnerId }, { projection: { _id: 0 } })
    .sort({ issuedAt: -1 })
    .toArray();
  return docs.map((d) => InvoiceSchema.parse(d));
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const found = all.find((x) => x.id === id);
    return found ? InvoiceSchema.parse(found) : null;
  }
  try {
    const db = await getDb();
    const doc = await db.collection<Invoice>("invoices").findOne({ id }, { projection: { _id: 0 } });
    return doc ? InvoiceSchema.parse(doc) : null;
  } catch {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const found = all.find((x) => x.id === id);
    return found ? InvoiceSchema.parse(found) : null;
  }
}

export async function updateInvoiceNumber(id: string, number: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const idx = all.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    const updated: Invoice = { ...all[idx], id: number, number, updatedAt: new Date().toISOString() };
    // ensure uniqueness by removing any existing entry with the new id
    const filtered = all.filter((x, i) => i !== idx && x.id !== number);
    filtered.push(updated);
    await writeJson("invoices.json", filtered);
    return true;
  }
  const db = await getDb();
  const nowIso = new Date().toISOString();
  // We need to change the primary id to match the number; emulate rename by upsert
  const doc = await db.collection<Invoice>("invoices").findOne({ id });
  if (!doc) return false;
  const newDoc = { ...(doc as any), id: number, number, updatedAt: nowIso };
  await db.collection<Invoice>("invoices").deleteOne({ id });
  const res = await db.collection<Invoice>("invoices").updateOne({ id: number }, { $set: newDoc }, { upsert: true });
  return Boolean(res.acknowledged && res.matchedCount === 1);
}

export async function deleteInvoiceById(id: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const next = all.filter((x) => x.id !== id);
    const changed = next.length !== all.length;
    if (changed) await writeJson("invoices.json", next);
    return changed;
  }
  const db = await getDb();
  const res = await db.collection<Invoice>("invoices").deleteOne({ id });
  return Boolean(res.acknowledged && res.deletedCount === 1);
}

export function computeInvoiceFromContract(opts: {
  contract: Contract;
  issuedAt: string; // YYYY-MM-DD
  number?: string;
  amountEUROverride?: number; // for yearly entries or special cases
}): Invoice {
  const c = opts.contract;
  const dueDays = typeof c.paymentDueDays === "number" ? c.paymentDueDays : 0;
  const amountEUR = Number((opts.amountEUROverride ?? c.amountEUR) ?? 0);
  const rate = Number(c.exchangeRateRON ?? 0);
  const corrPct = Number(c.correctionPercent ?? 0);
  const tvaPct = Number(c.tvaPercent ?? 0);
  const correctedAmountEUR = amountEUR * (1 + corrPct / 100);
  const netRON = correctedAmountEUR * rate;
  const vatRON = netRON * (tvaPct / 100);
  const totalRON = netRON + vatRON;

  const nowIso = new Date().toISOString().slice(0, 10);
  const inv: Invoice = InvoiceSchema.parse({
    // Temporary id; will be overwritten with the invoice number at issuance
    id: opts.number || `${c.id}-${opts.issuedAt}`,
    contractId: c.id,
    contractName: c.name,
    issuedAt: opts.issuedAt,
    dueDays,
    ownerId: c.ownerId,
    owner: c.owner,
    partnerId: c.partnerId || c.partner, // keep at least some identifier
    partner: c.partner,
    amountEUR,
    correctionPercent: corrPct,
    correctedAmountEUR,
    exchangeRateRON: rate,
    netRON,
    tvaPercent: tvaPct,
    vatRON,
    totalRON,
    number: opts.number,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return inv;
}

export async function renderInvoicePdf(inv: Invoice): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait in points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 40;
  let y = 800;

  const text = (s: string, opts?: { size?: number; bold?: boolean; color?: { r: number; g: number; b: number } }) => {
    const size = opts?.size ?? 12;
    const f = opts?.bold ? fontBold : font;
    const color = opts?.color ? rgb(opts.color.r, opts.color.g, opts.color.b) : rgb(0, 0, 0);
    page.drawText(s, { x: margin, y, size, font: f, color });
    y -= size + 6;
  };

  text("Factura", { size: 20, bold: true });
  text(`Număr: ${inv.number || inv.id}`);
  text(`Data emiterii: ${inv.issuedAt}`);
  text("");
  text(`Contract: ${inv.contractName} (ID ${inv.contractId})`, { bold: true });
  text(`Vânzător: ${inv.owner}`);
  text(`Cumpărător: ${inv.partner}`);
  text("");
  text(`Suma (EUR): ${inv.amountEUR.toFixed(2)}`);
  text(`Corecție: ${inv.correctionPercent}% → EUR după corecție: ${inv.correctedAmountEUR.toFixed(2)}`);
  text(`Curs RON/EUR: ${inv.exchangeRateRON.toFixed(4)}`);
  text(`Bază RON: ${inv.netRON.toFixed(2)}`);
  text(`TVA (${inv.tvaPercent}%): ${inv.vatRON.toFixed(2)} RON`);
  text(`Total de plată: ${inv.totalRON.toFixed(2)} RON`, { bold: true });

  return await pdfDoc.save();
}

export async function issueInvoiceAndGeneratePdf(inv: Invoice): Promise<Invoice> {
  // Global guard: only one invoice per contract per issued date
  try {
    const dupe = await findInvoiceByContractAndDate(inv.contractId, inv.issuedAt);
    if (dupe) return dupe;
  } catch {}
  // Persist invoice, generate PDF, save PDF, update invoice with url
  let useMongo = Boolean(process.env.MONGODB_URI);
  let db: Awaited<ReturnType<typeof getDb>> | null = null;
  if (useMongo) {
    try {
      db = await getDb();
    } catch {
      // Fallback to local store when DB is not reachable
      useMongo = false;
      db = null;
    }
  }
  // Upsert by id to avoid duplicates
  let toSave: Invoice = inv;
  if (!toSave.number) {
    try {
      const num = await allocateInvoiceNumberForOwner(toSave.ownerId ?? null, toSave.owner ?? null);
      // id must be the invoice number
      toSave = { ...toSave, number: num, id: num };
    } catch {}
  }
  // If number exists but id doesn't match, align them
  if (toSave.number && toSave.id !== toSave.number) {
    toSave = { ...toSave, id: toSave.number };
  }
  if (useMongo) {
    await db!.collection<Invoice>("invoices").updateOne({ id: toSave.id }, { $set: toSave }, { upsert: true });
  } else {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const idx = all.findIndex((x) => x.id === toSave.id);
    if (idx >= 0) all[idx] = toSave; else all.push(toSave);
    await writeJson("invoices.json", all);
  }

  // Generate a simple PDF receipt/invoice
  const pdfBytes = await renderInvoicePdf(toSave);
  const saved = await saveBufferAsUpload(new Uint8Array(pdfBytes), `${inv.id}.pdf`, "application/pdf", {
    contractId: inv.contractId,
    partnerId: inv.partnerId,
  });

  const updated: Invoice = { ...toSave, pdfUrl: saved.url };
  if (useMongo) {
    await db!.collection<Invoice>("invoices").updateOne(
      { id: toSave.id },
      { $set: { pdfUrl: saved.url, updatedAt: new Date().toISOString() } }
    );
  } else {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const idx = all.findIndex((x) => x.id === updated.id);
    if (idx >= 0) all[idx] = updated; else all.push(updated);
    await writeJson("invoices.json", all);
  }

  await createMessage({
    text: `Factură emisă pentru contractul ${inv.contractName}: ${inv.totalRON.toFixed(2)} RON (TVA ${inv.tvaPercent}%).`,
  });

  return updated;
}

export async function listInvoicesForContract(contractId: string): Promise<Invoice[]> {
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    return all.filter((x) => x.contractId === contractId).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }
  try {
    const db = await getDb();
    const docs = await db
      .collection<Invoice>("invoices")
      .find({ contractId }, { projection: { _id: 0 } })
      .sort({ issuedAt: -1 })
      .toArray();
    return docs.map((d) => InvoiceSchema.parse(d));
  } catch {
    const all = await readJson<Invoice[]>("invoices.json", []);
    return all.filter((x) => x.contractId === contractId).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }
}

/** Find an invoice by contract and exact issued date (YYYY-MM-DD) */
export async function findInvoiceByContractAndDate(
  contractId: string,
  issuedAt: string
): Promise<Invoice | null> {
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const found = all.find((x) => x.contractId === contractId && x.issuedAt === issuedAt);
    return found ? InvoiceSchema.parse(found) : null;
  }
  try {
    const db = await getDb();
    const doc = await db
      .collection<Invoice>("invoices")
      .findOne({ contractId, issuedAt }, { projection: { _id: 0 } });
    return doc ? InvoiceSchema.parse(doc) : null;
  } catch {
    const all = await readJson<Invoice[]>("invoices.json", []);
    const found = all.find((x) => x.contractId === contractId && x.issuedAt === issuedAt);
    return found ? InvoiceSchema.parse(found) : null;
  }
}

/** List all invoices for a specific month (1-12). Sorted ascending by date. */
export async function listInvoicesForMonth(year: number, month: number): Promise<Invoice[]> {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const start = `${y}-${m}-01`;
  // endExclusive = first day of next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endExclusive = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;

  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    return all
      .filter((x) => x.issuedAt >= start && x.issuedAt < endExclusive)
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  }
  try {
    const db = await getDb();
    const docs = await db
      .collection<Invoice>("invoices")
      .find({ issuedAt: { $gte: start, $lt: endExclusive } }, { projection: { _id: 0 } })
      .sort({ issuedAt: 1 })
      .toArray();
    return docs.map((d) => InvoiceSchema.parse(d));
  } catch {
    const all = await readJson<Invoice[]>("invoices.json", []);
    return all
      .filter((x) => x.issuedAt >= start && x.issuedAt < endExclusive)
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  }
}
