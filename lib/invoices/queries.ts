/**
 * Invoice Query Module
 * 
 * Provides all read operations for invoices with consistent error handling
 * and fallback strategies between MongoDB and local storage.
 */

import { getDb } from "@/lib/mongodb";
import { readJson } from "@/lib/local-store";
import { InvoiceSchema, type Invoice } from "@/lib/schemas/invoice";

const INVOICE_MONGO_CONFIGURED = !!process.env.MONGODB_URI;
const ALLOW_INVOICE_LOCAL_FALLBACK = process.env.NODE_ENV === "development";

/**
 * Find invoice by ID
 */
export async function findInvoiceById(id: string): Promise<Invoice | null> {
  if (!INVOICE_MONGO_CONFIGURED) {
    return findInvoiceByIdLocal(id);
  }

  try {
    return await findInvoiceByIdMongo(id);
  } catch (error) {
    if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
    console.warn("Invoice query failed (MongoDB), falling back to local:", error);
    return findInvoiceByIdLocal(id);
  }
}

async function findInvoiceByIdMongo(id: string): Promise<Invoice | null> {
  const db = await getDb();
  const doc = await db
    .collection<Invoice>("invoices")
    .findOne({ id }, { projection: { _id: 0 } });
  return doc ? InvoiceSchema.parse(doc) : null;
}

async function findInvoiceByIdLocal(id: string): Promise<Invoice | null> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  const found = all.find((x) => x.id === id);
  return found ? InvoiceSchema.parse(found) : null;
}

/**
 * Find invoice by contract and issued date
 */
export async function findInvoiceByContractAndDate(
  contractId: string,
  issuedAt: string
): Promise<Invoice | null> {
  if (!INVOICE_MONGO_CONFIGURED) {
    return findInvoiceByContractAndDateLocal(contractId, issuedAt);
  }

  try {
    return await findInvoiceByContractAndDateMongo(contractId, issuedAt);
  } catch (error) {
    if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
    console.warn("Invoice query failed (MongoDB), falling back to local:", error);
    return findInvoiceByContractAndDateLocal(contractId, issuedAt);
  }
}

async function findInvoiceByContractAndDateMongo(
  contractId: string,
  issuedAt: string
): Promise<Invoice | null> {
  const db = await getDb();
  const doc = await db
    .collection<Invoice>("invoices")
    .findOne({ contractId, issuedAt }, { projection: { _id: 0 } });
  return doc ? InvoiceSchema.parse(doc) : null;
}

async function findInvoiceByContractAndDateLocal(
  contractId: string,
  issuedAt: string
): Promise<Invoice | null> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  const found = all.find((x) => x.contractId === contractId && x.issuedAt === issuedAt);
  return found ? InvoiceSchema.parse(found) : null;
}

/**
 * Find invoice by contract, partner, and issued date (most specific lookup)
 */
export async function findInvoiceByContractPartnerAndDate(
  contractId: string,
  partnerIdOrName: string,
  issuedAt: string
): Promise<Invoice | null> {
  if (!INVOICE_MONGO_CONFIGURED) {
    return findInvoiceByContractPartnerAndDateLocal(contractId, partnerIdOrName, issuedAt);
  }

  try {
    return await findInvoiceByContractPartnerAndDateMongo(contractId, partnerIdOrName, issuedAt);
  } catch (error) {
    if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
    console.warn("Invoice query failed (MongoDB), falling back to local:", error);
    return findInvoiceByContractPartnerAndDateLocal(contractId, partnerIdOrName, issuedAt);
  }
}

async function findInvoiceByContractPartnerAndDateMongo(
  contractId: string,
  partnerIdOrName: string,
  issuedAt: string
): Promise<Invoice | null> {
  const db = await getDb();
  const partnerKey = String(partnerIdOrName || "");
  const doc = await db
    .collection<Invoice>("invoices")
    .findOne(
      {
        contractId,
        issuedAt,
        $or: [{ partnerId: partnerKey }, { partner: partnerKey }],
      },
      { projection: { _id: 0 } }
    );
  return doc ? InvoiceSchema.parse(doc) : null;
}

async function findInvoiceByContractPartnerAndDateLocal(
  contractId: string,
  partnerIdOrName: string,
  issuedAt: string
): Promise<Invoice | null> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  const partnerKey = String(partnerIdOrName || "");
  const found = all.find(
    (x) =>
      x.contractId === contractId &&
      x.issuedAt === issuedAt &&
      (x.partnerId === partnerKey || x.partner === partnerKey)
  );
  return found ? InvoiceSchema.parse(found) : null;
}

/**
 * List all invoices for a contract
 */
export async function listInvoicesForContract(contractId: string): Promise<Invoice[]> {
  if (!INVOICE_MONGO_CONFIGURED) {
    return listInvoicesForContractLocal(contractId);
  }

  try {
    return await listInvoicesForContractMongo(contractId);
  } catch (error) {
    if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
    console.warn("Invoice query failed (MongoDB), falling back to local:", error);
    return listInvoicesForContractLocal(contractId);
  }
}

async function listInvoicesForContractMongo(contractId: string): Promise<Invoice[]> {
  const db = await getDb();
  const docs = await db
    .collection<Invoice>("invoices")
    .find({ contractId }, { projection: { _id: 0 } })
    .sort({ issuedAt: -1 })
    .toArray();
  return docs.map((d) => InvoiceSchema.parse(d));
}

async function listInvoicesForContractLocal(contractId: string): Promise<Invoice[]> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  return all
    .filter((x) => x.contractId === contractId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

/**
 * List all invoices for a specific month
 */
export async function listInvoicesForMonth(year: number, month: number): Promise<Invoice[]> {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const start = `${y}-${m}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endExclusive = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;

  if (!INVOICE_MONGO_CONFIGURED) {
    return listInvoicesForMonthLocal(start, endExclusive);
  }

  try {
    return await listInvoicesForMonthMongo(start, endExclusive);
  } catch (error) {
    if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
    console.warn("Invoice query failed (MongoDB), falling back to local:", error);
    return listInvoicesForMonthLocal(start, endExclusive);
  }
}

async function listInvoicesForMonthMongo(start: string, endExclusive: string): Promise<Invoice[]> {
  const db = await getDb();
  const docs = await db
    .collection<Invoice>("invoices")
    .find({ issuedAt: { $gte: start, $lt: endExclusive } }, { projection: { _id: 0 } })
    .sort({ issuedAt: 1 })
    .toArray();
  return docs.map((d) => InvoiceSchema.parse(d));
}

async function listInvoicesForMonthLocal(start: string, endExclusive: string): Promise<Invoice[]> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  return all
    .filter((x) => x.issuedAt >= start && x.issuedAt < endExclusive)
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
}

/**
 * Fetch all invoices for a given year (with caching)
 */
let yearInvoicesCache: { year: number; at: number; invoices: Invoice[] } | null = null;
const YEAR_CACHE_TTL_MS = 60_000; // 60s TTL

export function invalidateYearInvoicesCache(): void {
  yearInvoicesCache = null;
}

export async function fetchInvoicesForYear(year: number): Promise<Invoice[]> {
  const now = Date.now();
  if (yearInvoicesCache && yearInvoicesCache.year === year && now - yearInvoicesCache.at < YEAR_CACHE_TTL_MS) {
    return yearInvoicesCache.invoices;
  }

  const start = `${String(year).padStart(4, "0")}-01-01`;
  const endExclusive = `${String(year + 1).padStart(4, "0")}-01-01`;

  let data: Invoice[] = [];
  if (!INVOICE_MONGO_CONFIGURED) {
    data = await fetchInvoicesForYearLocal(start, endExclusive);
  } else {
    try {
      data = await fetchInvoicesForYearMongo(start, endExclusive);
    } catch (error) {
      if (!ALLOW_INVOICE_LOCAL_FALLBACK) throw error;
      console.warn("Invoice query failed (MongoDB), falling back to local:", error);
      data = await fetchInvoicesForYearLocal(start, endExclusive);
    }
  }

  yearInvoicesCache = { year, at: now, invoices: data };
  return data;
}

async function fetchInvoicesForYearMongo(start: string, endExclusive: string): Promise<Invoice[]> {
  const db = await getDb();
  const docs = await db
    .collection<Invoice>("invoices")
    .find({ issuedAt: { $gte: start, $lt: endExclusive } }, { projection: { _id: 0 } })
    .sort({ issuedAt: 1 })
    .toArray();
  return docs.map((d) => InvoiceSchema.parse(d));
}

async function fetchInvoicesForYearLocal(start: string, endExclusive: string): Promise<Invoice[]> {
  const all = await readJson<Invoice[]>("invoices.json", []);
  return all
    .filter((x) => x.issuedAt >= start && x.issuedAt < endExclusive)
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
}
