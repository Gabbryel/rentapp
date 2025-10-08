import { ContractSchema, type Contract as ContractType } from "@/lib/schemas/contract";
import { getDb } from "@/lib/mongodb";
import { readJson, writeJson } from "@/lib/local-store";

const MOCK_CONTRACTS: ContractType[] = [
  {
    id: "c1",
    name: "Lease #1001",
    partnerId: "p1",
    partner: "Acme Corp",
  owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2024-12-15",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 5,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 20,
    rentHistory: [],
  },
  {
    id: "c2",
    name: "Lease #1002",
    partnerId: "p2",
    partner: "Globex LLC",
  owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2025-02-10",
    startDate: "2025-03-01",
    endDate: "2026-02-28",
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 10,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 15,
    rentHistory: [],
  },
  {
    id: "c3",
    name: "Maintenance Agreement A",
    partnerId: "p3",
    partner: "Initech",
    owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2025-05-05",
    startDate: "2025-05-15",
    endDate: "2025-11-15",
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 15,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 30,
    rentHistory: [],
  },
  {
    id: "c4",
    name: "Service Contract 2025",
    partnerId: "p4",
    partner: "Umbrella Co",
    owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2025-01-20",
    startDate: "2025-02-01",
    endDate: "2025-08-01",
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 12,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 10,
    rentHistory: [],
  },
  {
    id: "c5",
    name: "Short-term Lease Q3",
    partnerId: "p5",
    partner: "Stark Industries",
    owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2025-06-30",
    startDate: "2025-07-01",
    endDate: "2025-09-30",
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 8,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 15,
    rentHistory: [],
  },
  {
    id: "c6",
    name: "Property Mgmt Alpha",
    partnerId: "p6",
    partner: "Wayne Enterprises",
    owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2024-11-01",
    startDate: "2024-11-15",
    endDate: "2025-11-14",
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 20,
    scanUrl: "/contract-scan.svg",
    scans: [],
    paymentDueDays: 25,
    rentHistory: [],
  },
  {
    id: "c7",
    name: "Renewal Lease #2001",
    partnerId: "p7",
    partner: "Hooli",
    owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2025-03-12",
    startDate: "2025-04-01",
    endDate: "2026-03-31",
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 7,
    extensionDate: "2026-06-30",
    scans: [],
    paymentDueDays: 20,
    rentHistory: [],
  },
  {
    id: "c8",
    name: "Equipment Rental B",
    partnerId: "p8",
    partner: "Soylent Corp",
    owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2025-04-05",
    startDate: "2025-04-15",
    endDate: "2025-10-15",
    paymentDueDays: 14,
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 3,
    scans: [],
    rentHistory: [],
  },
  {
    id: "c9",
    name: "Parking Spaces 12-20",
    partnerId: "p9",
    partner: "Duff Beer",
    owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2024-09-01",
    startDate: "2024-09-15",
    endDate: "2025-09-14",
    paymentDueDays: 20,
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 9,
    scans: [],
    rentHistory: [],
  },
  {
    id: "c10",
    name: "Seasonal Lease Winter",
    partnerId: "p10",
    partner: "Cyberdyne Systems",
    owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2024-10-10",
    startDate: "2024-12-01",
    endDate: "2025-03-01",
    paymentDueDays: 20,
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 1,
    scans: [],
    rentHistory: [],
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
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 11,
    scans: [],
    rentHistory: [],
  },
  {
    id: "c12",
    name: "Property Mgmt Beta",
    partnerId: "p12",
    partner: "Tyrell Corporation",
    owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2025-01-05",
    startDate: "2025-01-15",
    endDate: "2026-01-14",
    paymentDueDays: 20,
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 14,
    scans: [],
    rentHistory: [],
  },
  {
    id: "c13",
    name: "Warehouse Lease A",
    partnerId: "p13",
    partner: "Oscorp",
    owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2024-07-20",
    startDate: "2024-08-01",
    endDate: "2025-07-31",
    paymentDueDays: 30,
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 6,
    scans: [],
    rentHistory: [],
  },
  {
    id: "c14",
    name: "Short-term Lease Q4",
    partnerId: "p14",
    partner: "Aperture Science",
    owner: "MKS Properties s.r.l.",
  // indexingDates removed
    signedAt: "2025-09-10",
    startDate: "2025-10-01",
    endDate: "2025-12-31",
    paymentDueDays: 10,
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 4,
    scans: [],
    rentHistory: [],
  },
  {
    id: "c15",
    name: "Office Expansion East",
    partnerId: "p15",
    partner: "Black Mesa",
    owner: "Markov Services s.r.l.",
  // indexingDates removed
    signedAt: "2025-05-25",
    startDate: "2025-06-01",
    endDate: "2026-05-31",
    paymentDueDays: 20,
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 16,
    scans: [],
    rentHistory: [],
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
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 18,
    scans: [],
    rentHistory: [],
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
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 13,
    scans: [],
    rentHistory: [],
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
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 2,
    scans: [],
    rentHistory: [],
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
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 22,
    scans: [],
    rentHistory: [],
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
    rentType: "monthly",
    invoiceMonthMode: "current",
    monthlyInvoiceDay: 19,
    scans: [],
    rentHistory: [],
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
  // indexingDates removed: ignore any persisted values
  const amountEUR = numOrUndef(r.amountEUR);
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
    extensionDate: toYmd(r.extensionDate),
  extendedAt: toYmd((r as any).extendedAt),
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
  // indexingDates removed
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
    amountEUR: Number.isFinite(amountEUR ?? NaN) && (amountEUR as number) > 0 ? (amountEUR as number) : undefined,
    exchangeRateRON: Number.isFinite(exchangeRateRON ?? NaN) && (exchangeRateRON as number) > 0 ? (exchangeRateRON as number) : undefined,
    tvaPercent,
    correctionPercent,
  // inflation tracking fields removed
    rentHistory: ((): any[] => {
      const arr = Array.isArray((r as any).rentHistory) ? (r as any).rentHistory : [];
      return arr
        .map((it: any) => {
          const o = (it ?? {}) as Record<string, unknown>;
            const changedAt = toYmd(o.changedAt);
            const amountEUR = typeof o.amountEUR === "number" ? o.amountEUR : Number(o.amountEUR);
            const exchangeRateRON = typeof o.exchangeRateRON === "number" ? o.exchangeRateRON : Number(o.exchangeRateRON);
            const correctionPercent = typeof o.correctionPercent === "number" ? o.correctionPercent : Number(o.correctionPercent);
            const tvaPercent = typeof o.tvaPercent === "number" ? o.tvaPercent : Number(o.tvaPercent);
            const note = typeof o.note === "string" && o.note.trim() ? o.note.trim() : undefined;
            if (changedAt && Number.isFinite(amountEUR) && amountEUR > 0) {
              return {
                changedAt,
                amountEUR,
                exchangeRateRON: Number.isFinite(exchangeRateRON) && exchangeRateRON > 0 ? exchangeRateRON : undefined,
                correctionPercent: Number.isFinite(correctionPercent) && correctionPercent >= 0 ? correctionPercent : undefined,
                tvaPercent: Number.isFinite(tvaPercent) && tvaPercent >= 0 ? Math.round(tvaPercent) : undefined,
                note,
              };
            }
            return null;
        })
        .filter(Boolean);
    })(),
    // indexing schedule fields removed
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

// Effective end date: if an extension date exists, that becomes the new end date
export function effectiveEndDate(c: ContractType): string {
  return c.extensionDate ?? c.endDate;
}

// Compute indexing instances from schedule fields within contract bounds
// generateIndexingDatesFromSchedule removed (indexing scheduling deprecated)

export async function upsertContract(contract: ContractType) {
  ContractSchema.parse(contract);
  // Mongo path
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const existing = await db.collection<ContractType>("contracts").findOne({ id: contract.id });
    let rentHistory = Array.isArray(contract.rentHistory) ? [...contract.rentHistory] : [];
    if (existing) {
      const prevAmount = (existing as any).amountEUR;
      const prevRate = (existing as any).exchangeRateRON;
      const prevCorrection = (existing as any).correctionPercent;
      const prevTva = (existing as any).tvaPercent;
      const changed =
        (typeof prevAmount === "number" || typeof contract.amountEUR === "number") &&
        (prevAmount !== contract.amountEUR || prevRate !== contract.exchangeRateRON || prevCorrection !== contract.correctionPercent || prevTva !== contract.tvaPercent);
      if (changed && typeof prevAmount === "number" && prevAmount > 0) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${d}`;
        rentHistory.push({
          changedAt: iso,
          amountEUR: prevAmount,
          exchangeRateRON: typeof prevRate === "number" ? prevRate : undefined,
          correctionPercent: typeof prevCorrection === "number" ? prevCorrection : undefined,
          tvaPercent: typeof prevTva === "number" ? prevTva : undefined,
        });
      }
    }
    rentHistory = rentHistory.reduce((acc: any[], cur) => {
      const key = `${cur.changedAt}|${cur.amountEUR}`;
      const idx = acc.findIndex((x) => `${x.changedAt}|${x.amountEUR}` === key);
      if (idx >= 0) acc[idx] = cur; else acc.push(cur);
      return acc;
    }, []);
    rentHistory.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
    const toSave: ContractType = { ...contract, rentHistory };
    await db
      .collection<ContractType>("contracts")
      .updateOne({ id: contract.id }, { $set: toSave }, { upsert: true });
    return;
  }
  // Local JSON fallback persistence
  try {
    const all = await readJson<ContractType[]>("contracts.json", []);
    const idx = all.findIndex((c) => c.id === contract.id);
    let rentHistory = Array.isArray(contract.rentHistory) ? [...contract.rentHistory] : [];
    if (idx >= 0) {
      const prev = all[idx];
      const prevAmount = (prev as any).amountEUR;
      const prevRate = (prev as any).exchangeRateRON;
      const prevCorrection = (prev as any).correctionPercent;
      const prevTva = (prev as any).tvaPercent;
      const changed =
        (typeof prevAmount === "number" || typeof contract.amountEUR === "number") &&
        (prevAmount !== contract.amountEUR || prevRate !== contract.exchangeRateRON || prevCorrection !== contract.correctionPercent || prevTva !== contract.tvaPercent);
      if (changed && typeof prevAmount === "number" && prevAmount > 0) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${d}`;
        rentHistory.push({
          changedAt: iso,
          amountEUR: prevAmount,
          exchangeRateRON: typeof prevRate === "number" ? prevRate : undefined,
          correctionPercent: typeof prevCorrection === "number" ? prevCorrection : undefined,
          tvaPercent: typeof prevTva === "number" ? prevTva : undefined,
        });
      }
    }
    rentHistory = rentHistory.reduce((acc: any[], cur) => {
      const key = `${cur.changedAt}|${cur.amountEUR}`;
      const i = acc.findIndex((x) => `${x.changedAt}|${x.amountEUR}` === key);
      if (i >= 0) acc[i] = cur; else acc.push(cur);
      return acc;
    }, []);
    rentHistory.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
    const toSave: ContractType = { ...contract, rentHistory };
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

// Bulk update all active contracts (endDate or extensionDate >= today) with a new EUR->RON exchange rate.
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
            { $ifNull: ["$extensionDate", "$endDate"] },
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
