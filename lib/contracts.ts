import { ContractSchema, type Contract as ContractType } from "@/lib/schemas/contract";
import { getDb } from "@/lib/mongodb";
import { readJson, writeJson } from "@/lib/local-store";
// Invoices: moved under contract model
import { InvoiceSchema, type Invoice } from "@/lib/schemas/invoice";
import { saveBufferAsUpload } from "@/lib/storage";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createMessage } from "@/lib/messages";
import { allocateInvoiceNumberForOwner } from "@/lib/invoice-settings";

const MOCK_CONTRACTS: ContractType[] = [
  {
    id: "c1",
    name: "Lease #1001",
    partnerId: "p1",
    partner: "Acme Corp",
  owner: "Markov Services s.r.l.",
    signedAt: "2024-12-15",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 5,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 20,
  },
  {
    id: "c2",
    name: "Lease #1002",
    partnerId: "p2",
    partner: "Globex LLC",
  owner: "MKS Properties s.r.l.",
    signedAt: "2025-02-10",
    startDate: "2025-03-01",
    endDate: "2026-02-28",
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 10,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 15,
  },
  {
    id: "c3",
    name: "Maintenance Agreement A",
    partnerId: "p3",
    partner: "Initech",
    owner: "Markov Services s.r.l.",
    signedAt: "2025-05-05",
    startDate: "2025-05-15",
    endDate: "2025-11-15",
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 15,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 30,
  },
  {
    id: "c4",
    name: "Service Contract 2025",
    partnerId: "p4",
    partner: "Umbrella Co",
    owner: "MKS Properties s.r.l.",
    signedAt: "2025-01-20",
    startDate: "2025-02-01",
    endDate: "2025-08-01",
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 12,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 10,
  },
  {
    id: "c5",
    name: "Short-term Lease Q3",
    partnerId: "p5",
    partner: "Stark Industries",
    owner: "Markov Services s.r.l.",
    signedAt: "2025-06-30",
    startDate: "2025-07-01",
    endDate: "2025-09-30",
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 8,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 15,
  },
  {
    id: "c6",
    name: "Property Mgmt Alpha",
    partnerId: "p6",
    partner: "Wayne Enterprises",
    owner: "MKS Properties s.r.l.",
    signedAt: "2024-11-01",
    startDate: "2024-11-15",
    endDate: "2025-11-14",
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 20,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 25,
  },
  {
    id: "c7",
    name: "Renewal Lease #2001",
    partnerId: "p7",
    partner: "Hooli",
    owner: "Markov Services s.r.l.",
    signedAt: "2025-03-12",
    startDate: "2025-04-01",
    endDate: "2026-03-31",
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 7,
    scans: [],
    paymentDueDays: 20,
  },
  {
    id: "c8",
    name: "Equipment Rental B",
    partnerId: "p8",
    partner: "Soylent Corp",
    owner: "MKS Properties s.r.l.",
    signedAt: "2025-04-05",
    startDate: "2025-04-15",
    endDate: "2025-10-15",
    paymentDueDays: 14,
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 3,
    scans: [],
  },
  {
    id: "c9",
    name: "Parking Spaces 12-20",
    partnerId: "p9",
    partner: "Duff Beer",
    owner: "Markov Services s.r.l.",
    signedAt: "2024-09-01",
    startDate: "2024-09-15",
    endDate: "2025-09-14",
    paymentDueDays: 20,
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 9,
    scans: [],
  },
  {
    id: "c10",
    name: "Seasonal Lease Winter",
    partnerId: "p10",
    partner: "Cyberdyne Systems",
    owner: "MKS Properties s.r.l.",
    signedAt: "2024-10-10",
    startDate: "2024-12-01",
    endDate: "2025-03-01",
    paymentDueDays: 20,
  contractExtensions: [],
  rentType: "monthly",
  indexingDates: [],
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 1,
    scans: [],
    
  },
  {
    id: "c11",
    name: "Service Level Addendum",
    partnerId: "p11",
    partner: "MomCorp",
    owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2025-07-01",
    startDate: "2025-07-10",
    endDate: "2026-07-09",
  paymentDueDays: 15,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 11,
    scans: [],
    
  },
  {
    id: "c12",
    name: "Property Mgmt Beta",
    partnerId: "p12",
    partner: "Tyrell Corporation",
    owner: "MKS Properties s.r.l.",
    signedAt: "2025-01-05",
    startDate: "2025-01-15",
    endDate: "2026-01-14",
  paymentDueDays: 20,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 14,
    scans: [],
    
  },
  {
    id: "c13",
    name: "Warehouse Lease A",
    partnerId: "p13",
    partner: "Oscorp",
    owner: "Markov Services s.r.l.",
    signedAt: "2024-07-20",
    startDate: "2024-08-01",
    endDate: "2025-07-31",
  paymentDueDays: 30,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 6,
    scans: [],
    
  },
  {
    id: "c14",
    name: "Short-term Lease Q4",
    partnerId: "p14",
    partner: "Aperture Science",
    owner: "MKS Properties s.r.l.",
    signedAt: "2025-09-10",
    startDate: "2025-10-01",
    endDate: "2025-12-31",
  paymentDueDays: 10,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 4,
    scans: [],
    
  },
  {
    id: "c15",
    name: "Office Expansion East",
    partnerId: "p15",
    partner: "Black Mesa",
    owner: "Markov Services s.r.l.",
    signedAt: "2025-05-25",
    startDate: "2025-06-01",
    endDate: "2026-05-31",
  paymentDueDays: 20,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 16,
    scans: [],
    
  },
  {
    id: "c16",
    name: "Retail Kiosk Summer",
    partnerId: "p16",
    partner: "Nuka-Cola",
    owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2025-03-28",
    startDate: "2025-05-01",
    endDate: "2025-09-01",
  paymentDueDays: 25,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 18,
    scans: [],
    
  },
  {
    id: "c17",
    name: "Maintenance Agreement B",
    partnerId: "p17",
    partner: "Wonka Industries",
    owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2024-12-01",
    startDate: "2025-01-10",
    endDate: "2025-07-10",
  paymentDueDays: 20,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 13,
    scans: [],
    
  },
  {
    id: "c18",
    name: "Service Contract 2026",
    partnerId: "p18",
    partner: "Blue Sun",
    owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2025-08-15",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  paymentDueDays: 20,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 2,
    scans: [],
    
  },
  {
    id: "c19",
    name: "Lease #3003",
    partnerId: "p19",
    partner: "Gringotts Bank",
    owner: "Markov Services s.r.l.",
    signedAt: "2025-02-02",
    startDate: "2025-02-15",
    endDate: "2026-02-14",
  paymentDueDays: 20,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 22,
    scans: [],
    
  },
  {
    id: "c20",
    name: "Storage Units Block C",
    partnerId: "p20",
    partner: "Vault-Tec",
    owner: "MKS Properties s.r.l.",
    signedAt: "2025-06-05",
    startDate: "2025-06-15",
    endDate: "2026-06-14",
  paymentDueDays: 20,
  contractExtensions: [],
  indexingDates: [],
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 19,
    scans: [],
    
  },
];

// Validate mock data at module load (throws if invalid during dev)
for (const c of MOCK_CONTRACTS) ContractSchema.parse(c);

function toYmd(input: unknown): string | undefined {
  if (typeof input === "string" && input) return input;
  if (input instanceof Date && !isNaN(input.getTime())) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

function normalizeRaw(raw: unknown): Partial<ContractType> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const numOrUndef = (v: unknown): number | undefined => {
    if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };
  // ignore legacy indexing fields in persistence
  const amountEUR = numOrUndef((r as any).rentAmountEuro ?? (r as any).amountEUR);
  const exchangeRateRON = numOrUndef(r.exchangeRateRON);
  const tvaPercent =
    typeof r.tvaPercent === "number"
      ? r.tvaPercent
      : Number.isInteger(Number(r.tvaPercent))
      ? Number(r.tvaPercent)
      : undefined;
  const correctionPercent =
    typeof r.correctionPercent === "number"
      ? r.correctionPercent
      : (() => {
          const v = r.correctionPercent as unknown;
          if (typeof v === "string" && v.trim() !== "") {
            const n = Number(v.replace(",", "."));
            return Number.isFinite(n) ? n : undefined;
          }
          return undefined;
        })();
  return {
    id: typeof r.id === "string" ? r.id : (r.id as string | undefined),
    name: typeof r.name === "string" ? r.name : (r.name as string | undefined),
    assetId: typeof (r as any).assetId === "string" ? (r as any).assetId : undefined,
    asset: typeof (r as any).asset === "string" ? (r as any).asset : undefined,
    partnerId: typeof r.partnerId === "string" ? r.partnerId : undefined,
    partner: typeof r.partner === "string" ? r.partner : (r.partner as string | undefined),
    owner: (r.owner as string) ?? "Markov Services s.r.l.",
    signedAt: toYmd(r.signedAt)!,
    startDate: toYmd(r.startDate)!,
    endDate: toYmd(r.endDate)!,
    // Normalize contractExtensions
    contractExtensions: ((): { docDate: string; document: string; extendedUntil: string }[] | undefined => {
      const arr = Array.isArray((r as any).contractExtensions)
        ? ((r as any).contractExtensions as unknown[])
        : [];
      const mapped = arr
        .map((it) => {
          const o = (it ?? {}) as Record<string, unknown>;
          const docDate = toYmd(o.docDate);
          const document = typeof o.document === "string" ? o.document.trim() : undefined;
          const extendedUntil = toYmd(o.extendedUntil);
          if (docDate && document && extendedUntil) {
            return { docDate, document, extendedUntil };
          }
          return null;
        })
        .filter(Boolean) as { docDate: string; document: string; extendedUntil: string }[];
      return mapped.length > 0 ? mapped : undefined;
    })(),
    paymentDueDays: ((): number | undefined => {
      const n = Number(r.paymentDueDays);
      return Number.isInteger(n) && n >= 0 && n <= 120 ? n : undefined;
    })(),
    rentType: ((): "monthly" | "yearly" => (r.rentType === "yearly" ? "yearly" : "monthly"))(),
    // Preserve explicit invoiceMonthMode from persistence; fallback to undefined so schema default applies only if absent
    invoiceMonthMode: ((): "current" | "next" | undefined => {
      const v = (r as any).invoiceMonthMode;
      if (v === "next") return "next";
      if (v === "current") return "current";
      return undefined; // let zod default kick in for legacy rows
    })(),
    monthlyInvoiceDay: ((): number | undefined => {
      const rt: "monthly" | "yearly" = r.rentType === "yearly" ? "yearly" : "monthly";
      if (rt !== "monthly") return undefined;
      // explicit day first
      const n = Number(r.monthlyInvoiceDay);
      if (Number.isInteger(n) && n >= 1 && n <= 31) return n;
      // fallback: derive from invoiceDate if present
  const inv = toYmd((r as Record<string, unknown>).invoiceDate);
      if (inv) {
        const d = new Date(inv);
        const day = d.getDate();
        if (Number.isInteger(day) && day >= 1 && day <= 31) return day;
      }
      // final fallback for legacy data
      return 1;
    })(),
    yearlyInvoices: ((): { month: number; day: number; amountEUR: number }[] | undefined => {
      const rawY = (r as Record<string, unknown>).yearlyInvoices as unknown;
      const arr: unknown[] = Array.isArray(rawY) ? rawY : [];
      const mapped = arr
        .map((it) => {
          const rec = (it ?? {}) as Record<string, unknown>;
          return {
            month: Number(rec.month),
            day: Number(rec.day),
            amountEUR: Number(rec.amountEUR),
          };
        })
        .filter(
          (x) =>
            Number.isInteger(x.month) && x.month >= 1 && x.month <= 12 &&
            Number.isInteger(x.day) && x.day >= 1 && x.day <= 31 &&
            Number.isFinite(x.amountEUR) && x.amountEUR > 0
        );
      return mapped.length > 0 ? mapped : undefined;
    })(),
  // legacy single scan handling
    scanUrl: ((): string | undefined => {
      const v = r.scanUrl;
      if (v == null) return undefined;
      if (typeof v === "string") return v;
      return undefined;
    })(),
    scans: ((): { url: string; title?: string }[] => {
      const arr = Array.isArray((r as any).scans) ? ((r as any).scans as unknown[]) : [];
      const mapped = arr
        .map((it) => {
          const o = (it ?? {}) as Record<string, unknown>;
          const url = typeof o.url === "string" ? o.url : undefined;
          const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : undefined;
          return url ? { url, title } : null;
        })
        .filter(Boolean) as { url: string; title?: string }[];
      // Back-compat: if no scans array but scanUrl exists, include it as a single item
      if (mapped.length === 0) {
        const one = ((): { url: string; title?: string } | null => {
          const v = r.scanUrl;
          if (typeof v === "string" && v.trim()) return { url: v };
          return null;
        })();
        return one ? [one] : [];
      }
      return mapped;
    })(),
  rentAmountEuro: Number.isFinite(amountEUR ?? NaN) && (amountEUR as number) > 0 ? (amountEUR as number) : undefined,
    exchangeRateRON: Number.isFinite(exchangeRateRON ?? NaN) && (exchangeRateRON as number) > 0 ? (exchangeRateRON as number) : undefined,
    tvaPercent,
    correctionPercent,
    // schedule fields
    indexingDay: ((): number | undefined => {
      const n = Number((r as any).indexingDay);
      return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
    })(),
    indexingMonth: ((): number | undefined => {
      const n = Number((r as any).indexingMonth);
      return Number.isInteger(n) && n >= 1 && n <= 12 ? n : undefined;
    })(),
    howOftenIsIndexing: ((): number | undefined => {
      const n = Number((r as any).howOftenIsIndexing);
      return Number.isInteger(n) && n >= 1 && n <= 12 ? n : undefined;
    })(),
    // Indexing dates: prefer persisted indexingDates when present; otherwise derive from legacy futureIndexingDates only if schedule is valid
    indexingDates: ((): { forecastDate: string; actualDate?: string; newRentAmount?: number; done: boolean }[] => {
      // If DB already has indexingDates, sanitize and keep them regardless of schedule fields
      if (Array.isArray((r as any).indexingDates)) {
        const arr = ((r as any).indexingDates as unknown[]).map((it) => {
          const o = (it ?? {}) as any;
          const forecastDate = toYmd(o.forecastDate);
          if (!forecastDate) return null;
          const actualDate = toYmd(o.actualDate);
          const document =
            typeof o.document === "string" && o.document.trim()
              ? o.document.trim()
              : undefined;
          const nra = Number(o.newRentAmount);
          const newRentAmount = Number.isFinite(nra) && nra > 0 ? nra : undefined;
          const done = Boolean(o.done);
          return { forecastDate, actualDate, document, newRentAmount, done };
        }).filter(Boolean) as { forecastDate: string; actualDate?: string; document?: string; newRentAmount?: number; done: boolean }[];
        return arr;
      }
      // Else, build from legacy futureIndexingDates only when schedule is valid
      const day = Number((r as any).indexingDay);
      const freq = Number((r as any).howOftenIsIndexing);
      const scheduleOk = Number.isInteger(day) && day >= 1 && day <= 31 && Number.isInteger(freq) && freq >= 1 && freq <= 12;
      if (!scheduleOk) return [];
      const legacyArr = Array.isArray((r as any).futureIndexingDates)
        ? ((r as any).futureIndexingDates as unknown[])
        : [];
      const mapped: {
        forecastDate: string;
        actualDate?: string;
        document?: string;
        newRentAmount?: number;
        done: boolean;
      }[] = [];
      for (const it of legacyArr) {
        if (typeof it === "string") {
          const d = toYmd(it);
          if (d) mapped.push({ forecastDate: d, done: false });
        } else if (it && typeof it === "object") {
          const o = it as any;
          const d = toYmd(o.date);
          if (d)
            mapped.push({
              forecastDate: d,
              actualDate: toYmd(o.actualDate),
              document:
                typeof o.document === "string" && o.document.trim()
                  ? o.document.trim()
                  : undefined,
              done: Boolean(o.saved),
            });
        }
      }
      return mapped;
    })(),
  } as Partial<ContractType>;
}

export async function fetchContracts(): Promise<ContractType[]> {
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      const docs = await db
        .collection<ContractType>("contracts")
        .find({}, { projection: { _id: 0 } })
        .toArray();
      const valid: ContractType[] = [];
      for (const raw of docs) {
        const parsed = ContractSchema.safeParse(normalizeRaw(raw));
        if (parsed.success) valid.push(parsed.data);
        else {
          console.warn("Contract invalid, omis din listă:", {
            id: (raw as any)?.id,
            issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
          });
        }
      }
      return valid;
    } catch (err) {
      console.warn("Mongo indisponibil (fetchContracts), fallback local.", err);
    }
  }
  // Local JSON fallback (persistent across restarts) else static mocks
  try {
    const local = await readJson<ContractType[]>("contracts.json", []);
    if (local.length > 0) return local;
  } catch {}
  return MOCK_CONTRACTS;
}

export async function fetchContractById(id: string): Promise<ContractType | null> {
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      const doc = await db
        .collection<ContractType>("contracts")
        .findOne({ id }, { projection: { _id: 0 } });
      if (!doc) return null;
      const parsed = ContractSchema.safeParse(normalizeRaw(doc));
      if (parsed.success) return parsed.data;
      console.warn("Contract invalid pentru id, omis:", {
        id,
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      return null;
    } catch (err) {
      console.warn("Mongo indisponibil (fetchContractById), fallback local.", err);
    }
  }
  try {
    const local = await readJson<ContractType[]>("contracts.json", []);
    const hit = local.find((c) => c.id === id);
    if (hit) return ContractSchema.parse(hit);
  } catch {}
  return MOCK_CONTRACTS.find((c) => c.id === id) ?? null;
}

export async function fetchContractsByAssetId(assetId: string, injectedDb?: any): Promise<ContractType[]> {
  // Allow injecting a DB for tests; otherwise use real MongoDB when configured
  if (injectedDb || process.env.MONGODB_URI) {
    try {
      const db = injectedDb ?? (await getDb());
      const docs = await db
        .collection("contracts")
        .find({ assetId }, { projection: { _id: 0 } })
        .toArray();
      const valid: ContractType[] = [];
      for (const raw of docs) {
        const parsed = ContractSchema.safeParse(normalizeRaw(raw));
        if (parsed.success) valid.push(parsed.data);
        else {
          console.warn("Contract invalid, omis din listă (asset):", {
            id: (raw as any)?.id,
            issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
          });
        }
      }
      return valid;
    } catch (err) {
      console.warn("Mongo indisponibil (fetchContractsByAssetId), fallback local.", err);
    }
  }
  try {
    const local = await readJson<ContractType[]>("contracts.json", []);
    if (local.length > 0) return local.filter((c) => c.assetId === assetId);
  } catch {}
  return MOCK_CONTRACTS.filter((c) => (c as any).assetId === assetId);
}

// Effective end date: latest extendedUntil from contractExtensions, otherwise endDate
export function effectiveEndDate(c: ContractType): string {
  const list = Array.isArray((c as any).contractExtensions)
    ? (((c as any).contractExtensions as unknown[]) as { extendedUntil?: string }[])
    : [];
  const dates = list
    .map((x) => (x && typeof x.extendedUntil === "string" ? x.extendedUntil : ""))
    .filter(Boolean)
    .sort();
  const latest = dates.length > 0 ? dates[dates.length - 1] : undefined;
  return latest ?? c.endDate;
}

// Compute future indexing dates within contract bounds
export function computeFutureIndexingDates(c: ContractType): { forecastDate: string; done: boolean; document?: string }[] {
  const dayRaw = (c as any).indexingDay as number | undefined;
  const monthRaw = (c as any).indexingMonth as number | undefined;
  const freqRaw = (c as any).howOftenIsIndexing as number | undefined;
  if (!Number.isInteger(dayRaw) || !Number.isInteger(monthRaw) || !Number.isInteger(freqRaw)) return [];
  const day = dayRaw as number;
  const monthIndex = (monthRaw as number) - 1; // zero-based
  const freq = freqRaw as number;
  if (day < 1 || day > 31) return [];
  if (monthIndex < 0 || monthIndex > 11) return [];
  if (freq < 1 || freq > 12) return [];
  const anchor = new Date(c.signedAt);
  const end = new Date(effectiveEndDate(c));
  const lastDayInMonth = (yy: number, mm: number) => new Date(yy, mm + 1, 0).getDate();
  const makeDate = (yy: number, mm: number) => {
    const d = new Date(yy, mm, 1);
    const last = lastDayInMonth(yy, mm);
    d.setDate(Math.min(day, last));
    return d;
  };
  let cur = makeDate(anchor.getFullYear(), monthIndex);
  // Ensure the first date is on/after the anchor date (contract signed date)
  let safety = 0;
  while (cur < anchor && safety < 1200) {
    const nextMonthIndex = cur.getMonth() + freq;
    cur = makeDate(cur.getFullYear(), nextMonthIndex);
    safety += 1;
  }
  if (safety >= 1200) return [];
  const out: { forecastDate: string; done: boolean; document?: string }[] = [];
  while (cur <= end && out.length < 600) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    out.push({ forecastDate: `${yyyy}-${mm}-${dd}`, done: false });
    const nextMonthIndex = cur.getMonth() + freq;
    cur = makeDate(cur.getFullYear(), nextMonthIndex);
  }
  return out;
}

export async function upsertContract(contract: ContractType) {
  ContractSchema.parse(contract);
  // Mongo path
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const existing = await db.collection<ContractType>("contracts").findOne({ id: contract.id });
    // Peek provided indexing metadata from incoming contract to determine effective date
  const providedIdx = Array.isArray((contract as any).indexingDates)
      ? (((contract as any).indexingDates as unknown[]) as {
          forecastDate: string;
          actualDate?: string;
          document?: string;
          newRentAmount?: number;
          done?: boolean;
        }[])
      : [];
    if (existing) {
      const prevAmount = (existing as any).rentAmountEuro ?? (existing as any).amountEUR;
      const prevRate = (existing as any).exchangeRateRON;
      const prevCorrection = (existing as any).correctionPercent;
      const prevTva = (existing as any).tvaPercent;
      const changed =
        (typeof prevAmount === "number" || typeof (contract as any).rentAmountEuro === "number") &&
        (prevAmount !== (contract as any).rentAmountEuro || prevRate !== contract.exchangeRateRON || prevCorrection !== contract.correctionPercent || prevTva !== contract.tvaPercent);
      if (changed && typeof prevAmount === "number" && prevAmount > 0) {
        // Determine effective changedAt and note from indexing when applicable
        const newAmount = (contract as any).rentAmountEuro;
        const match =
          typeof newAmount === "number"
            ? providedIdx.find(
                (x) => x && x.done && typeof x.newRentAmount === "number" && x.newRentAmount === newAmount
              )
            : undefined;
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const isoToday = `${y}-${m}-${d}`;
        const changedAtIso = match?.actualDate || match?.forecastDate || isoToday;
        const note = match?.actualDate
          ? `indexare ${match.actualDate}`
          : match?.forecastDate
          ? `indexare ${match.forecastDate}`
          : undefined;
        // rent history removed
      }
    }
    // If this is a new contract (no existing) and no history provided, seed initial entry
    if (!existing) {
      const currentAmount = (contract as any).rentAmountEuro;
      // no-op
    }
    // rent history removed
  // Recompute indexingDates if schedule fields present and preserve provided metadata (actualDate/newRentAmount/done)
  const baseComputed = computeFutureIndexingDates(contract as any);
  const provided = Array.isArray((contract as any).indexingDates)
    ? ((contract as any).indexingDates as {
        forecastDate: string;
        actualDate?: string;
        document?: string;
        newRentAmount?: number;
        done?: boolean;
      }[])
    : [];
  const providedMap = new Map(
    provided.map((p) => [p.forecastDate, p] as const)
  );
  const merged = baseComputed.map((e) => {
    const hit = providedMap.get(e.forecastDate);
    return {
      forecastDate: e.forecastDate,
      actualDate: hit?.actualDate,
      document: hit?.document,
      newRentAmount: hit?.newRentAmount,
      done: Boolean(hit?.done),
    };
  });
  for (const p of provided) {
    if (!baseComputed.some((e) => e.forecastDate === p.forecastDate)) {
      merged.push({
        forecastDate: p.forecastDate,
        actualDate: p.actualDate,
        document: p.document,
        newRentAmount: p.newRentAmount,
        done: Boolean(p.done),
      });
    }
  }
  merged.sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));
  // If any indexingDates have an actualDate <= today with a numeric newRentAmount,
  // force the contract's current EUR rent to the latest such amount.
  const todayIso = (() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  const applied = merged
    .filter(
      (x) =>
        typeof (x as any).newRentAmount === "number" &&
        x.actualDate &&
        String(x.actualDate).slice(0, 10) <= todayIso
    )
    .sort((a, b) => String(a.actualDate || "").localeCompare(String(b.actualDate || "")));
  const latestApplied = applied.length > 0 ? (applied[applied.length - 1] as any) : undefined;
  const forcedRentAmount = latestApplied?.newRentAmount as number | undefined;
  const toSave: ContractType = { ...(contract as any), indexingDates: merged } as any;
    await db
      .collection<ContractType>("contracts")
      .updateOne({ id: contract.id }, { $set: toSave }, { upsert: true });
    return;
  }
  // Local JSON fallback persistence
  try {
    const all = await readJson<ContractType[]>("contracts.json", []);
    const idx = all.findIndex((c) => c.id === contract.id);
    // rent history removed
    const providedIdx = Array.isArray((contract as any).indexingDates)
      ? (((contract as any).indexingDates as unknown[]) as {
          forecastDate: string;
          actualDate?: string;
          document?: string;
          newRentAmount?: number;
          done?: boolean;
        }[])
      : [];
    // no-op: rent history removed; only indexingDates are maintained
    // If this is a new contract (no previous in local store) and history empty, seed initial entry
    if (idx < 0) {
      const currentAmount = (contract as any).rentAmountEuro;
      // no-op
    }
    // rent history removed
  const baseComputed = computeFutureIndexingDates(contract as any);
  const provided = Array.isArray((contract as any).indexingDates)
    ? ((contract as any).indexingDates as {
        forecastDate: string;
        actualDate?: string;
        document?: string;
        newRentAmount?: number;
        done?: boolean;
      }[])
    : [];
  const providedMap = new Map(
    provided.map((p) => [p.forecastDate, p] as const)
  );
  const merged = baseComputed.map((e) => {
    const hit = providedMap.get(e.forecastDate);
    return {
      forecastDate: e.forecastDate,
      actualDate: hit?.actualDate,
      document: hit?.document,
      newRentAmount: hit?.newRentAmount,
      done: Boolean(hit?.done),
    };
  });
  for (const p of provided) {
    if (!baseComputed.some((e) => e.forecastDate === p.forecastDate)) {
      merged.push({
        forecastDate: p.forecastDate,
        actualDate: p.actualDate,
        document: p.document,
        newRentAmount: p.newRentAmount,
        done: Boolean(p.done),
      });
    }
  }
  merged.sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));
  const todayIso2 = (() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  const applied2 = merged
    .filter(
      (x) =>
        typeof (x as any).newRentAmount === "number" &&
        x.actualDate &&
        String(x.actualDate).slice(0, 10) <= todayIso2
    )
    .sort((a, b) => String(a.actualDate || "").localeCompare(String(b.actualDate || "")));
  const latestApplied2 = applied2.length > 0 ? (applied2[applied2.length - 1] as any) : undefined;
  const forcedRentAmount2 = latestApplied2?.newRentAmount as number | undefined;
  const toSave: ContractType = { ...(contract as any), indexingDates: merged } as any;
    if (idx >= 0) all[idx] = toSave; else all.push(toSave);
    await writeJson("contracts.json", all);
  } catch (err) {
    console.warn("Persistență locală contract eșuată:", err);
  }
}

export async function deleteContractById(id: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    throw new Error("MongoDB nu este configurat. Setați MONGODB_URI și MONGODB_DB.");
  }
  const db = await getDb();
  const res = await db.collection<ContractType>("contracts").deleteOne({ id });
  return Boolean(res.acknowledged && res.deletedCount && res.deletedCount > 0);
}

// Helper used by seeding scripts to load the static mock dataset regardless of DB config
export function getMockContracts(): ContractType[] {
  return MOCK_CONTRACTS;
}

// Bulk update all active contracts (effective end date >= today) with a new EUR->RON exchange rate.
// If onlyActive is true, filters to contracts whose effective end date is today or in future.
// Returns the number of contracts updated. Requires MongoDB.
export async function updateContractsExchangeRate(newRate: number, onlyActive = true): Promise<number> {
  if (!process.env.MONGODB_URI) {
    throw new Error("MongoDB nu este configurat. Nu pot actualiza cursul contractelor.");
  }
  if (!Number.isFinite(newRate) || newRate <= 0) return 0;
  const db = await getDb();
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const iso = `${y}-${m}-${d}`;
  const filter = onlyActive
    ? {
        $expr: {
          $gte: [
            {
              $let: {
                vars: {
                  ext: {
                    $cond: [
                      { $gt: [{ $size: { $ifNull: ["$contractExtensions", []] } }, 0] },
                      {
                        $max: {
                          $map: {
                            input: "$contractExtensions",
                            as: "ce",
                            in: "$$ce.extendedUntil",
                          },
                        },
                      },
                      null,
                    ],
                  },
                },
                in: { $ifNull: ["$$ext", "$endDate"] },
              },
            },
            iso,
          ],
        },
      }
    : {};
  const res = await db
    .collection<ContractType>("contracts")
    .updateMany(filter as any, { $set: { exchangeRateRON: newRate } });
  return res.modifiedCount ?? 0;
}

// =============================================================
// Invoices logic (moved from lib/invoices.ts)
// =============================================================

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
  contract: ContractType;
  issuedAt: string; // YYYY-MM-DD
  number?: string;
  amountEUROverride?: number; // for yearly entries or special cases
}): Invoice {
  const c = opts.contract;
  const dueDays = typeof c.paymentDueDays === "number" ? c.paymentDueDays : 0;
  // Determine EUR amount effective on invoice date from rent history
  const amountFromHistory = rentAmountAtDate(c, opts.issuedAt);
  const amountEUR = Number((opts.amountEUROverride ?? amountFromHistory) ?? 0);
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
    ownerId: (c as any).ownerId,
    owner: (c as any).owner,
    partnerId: (c as any).partnerId || (c as any).partner,
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

// Return the EUR rent amount effective on the given ISO date (YYYY-MM-DD)
export function rentAmountAtDate(c: ContractType, isoDate: string): number | undefined {
  const arr = Array.isArray((c as any).indexingDates)
    ? ((c as any).indexingDates as Array<{
        forecastDate: string;
        actualDate?: string;
        newRentAmount?: number;
      }>)
    : [];
  const effectiveRows = arr
    .filter((it) => typeof it.newRentAmount === "number")
    .map((it) => ({
      date: String((it.actualDate || it.forecastDate) || "").slice(0, 10),
      value: it.newRentAmount as number,
    }))
    .filter((x) => x.date && x.date <= isoDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  return effectiveRows.length > 0 ? effectiveRows[effectiveRows.length - 1].value : undefined;
}

// Convenience for "today"
export function currentRentAmount(c: ContractType): number | undefined {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return rentAmountAtDate(c, `${y}-${m}-${d}`);
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
      const num = await allocateInvoiceNumberForOwner((toSave as any).ownerId ?? null, toSave.owner ?? null);
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

  // Invalidate cached yearly invoices so realized income is fresh
  try { invalidateYearInvoicesCache(); } catch {}

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

// In-memory cache for yearly invoice aggregation (simple TTL approach)
let __yearInvoicesCache: { year: number; at: number; invoices: Invoice[] } | null = null;
const YEAR_CACHE_TTL_MS = 60_000; // 60s TTL

/** Fetch all invoices for a given calendar year with light in-memory caching. */
export async function fetchInvoicesForYear(year: number): Promise<Invoice[]> {
  const now = Date.now();
  if (
    __yearInvoicesCache &&
    __yearInvoicesCache.year === year &&
    now - __yearInvoicesCache.at < YEAR_CACHE_TTL_MS
  ) {
    return __yearInvoicesCache.invoices;
  }
  const start = `${String(year).padStart(4, "0")}-01-01`;
  const endExclusive = `${String(year + 1).padStart(4, "0")}-01-01`;
  let data: Invoice[] = [];
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    data = all.filter((x) => x.issuedAt >= start && x.issuedAt < endExclusive);
  } else {
    try {
      const db = await getDb();
      const docs = await db
        .collection<Invoice>("invoices")
        .find(
          { issuedAt: { $gte: start, $lt: endExclusive } },
          { projection: { _id: 0 } }
        )
        .toArray();
      data = docs.map((d) => InvoiceSchema.parse(d));
    } catch {
      const all = await readJson<Invoice[]>("invoices.json", []);
      data = all.filter((x) => x.issuedAt >= start && x.issuedAt < endExclusive);
    }
  }
  __yearInvoicesCache = { year, invoices: data, at: now };
  return data;
}

export function invalidateYearInvoicesCache() {
  __yearInvoicesCache = null;
}

/** Always fetch invoices for a year ignoring the in-memory cache (fresh read). */
export async function fetchInvoicesForYearFresh(year: number): Promise<Invoice[]> {
  const start = `${String(year).padStart(4, "0")}-01-01`;
  const endExclusive = `${String(year + 1).padStart(4, "0")}-01-01`;
  if (!process.env.MONGODB_URI) {
    const all = await readJson<Invoice[]>("invoices.json", []);
    return all.filter((x) => x.issuedAt >= start && x.issuedAt < endExclusive);
  }
  try {
    const db = await getDb();
    const docs = await db
      .collection<Invoice>("invoices")
      .find(
        { issuedAt: { $gte: start, $lt: endExclusive } },
        { projection: { _id: 0 } }
      )
      .toArray();
    return docs.map((d) => InvoiceSchema.parse(d));
  } catch {
    const all = await readJson<Invoice[]>("invoices.json", []);
    return all.filter((x) => x.issuedAt >= start && x.issuedAt < endExclusive);
  }
}
