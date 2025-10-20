import { z } from "zod";

// Allow either absolute URL (http/https) or a public path starting with "/"
// and ensure the target is an image or PDF (by extension)
const ScanUrl = z
  .string()
  .min(1)
  .refine(
    (s: string) => s.startsWith("/") || /^https?:\/\//i.test(s),
    "scanUrl trebuie să fie o cale publică (începe cu /) sau un URL valid"
  )
  .refine(
    (s: string) =>
      // Accept classic public file extensions or GridFS API URL without extension
      /\.(pdf|png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(s) ||
      /^\/api\/uploads\/([a-f\d]{24})(?:$|[?#])/i.test(s),
    "scan trebuie să fie o imagine (png, jpg, jpeg, gif, webp, svg) sau un PDF"
  );

// Validate ISO-like date: accept YYYY-MM-DD or full ISO timestamp (from DBs)
export const ISODate = z
  .string()
  .refine((s) => {
    // Match YYYY-MM-DD optionally followed by 'T...' timestamp
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (!m) return false;
    // Basic sanity: construct date and compare Y-M-D
    const d = new Date(s);
    if (isNaN(d.getTime())) return false;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}` === `${m[1]}-${m[2]}-${m[3]}`;
  }, "data trebuie în formatul YYYY-MM-DD (poate include timp)");

export const ContractScanItemSchema = z.object({
  url: ScanUrl,
  title: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export const ContractSchema = z
  .object({
    id: z.string().min(1, "id obligatoriu"),
    name: z.string().min(1, "nume obligatoriu"),
    // Asset linkage (optional for backward-compat); UI enforces selection
    assetId: z.string().optional(),
    asset: z.string().optional(),
    partnerId: z.string().optional(),
    partner: z.string().min(1, "partener obligatoriu"),
    // New: multiple partners (first one mirrors partner/partnerId for backward compat)
    partners: z
      .array(
        z.object({
          id: z.string().min(1).optional(),
          name: z.string().min(1, "nume partener obligatoriu"),
          sharePercent: z
            .number()
            .min(0, "procent minim 0")
            .max(100, "procent maxim 100")
            .optional(),
        })
      )
      .min(1, "Cel puțin un partener")
      .optional(),
    // Owner linkage from owners collection
    ownerId: z.string().optional(),
    // Denormalized owner name for display; UI now enforces selection from list
    owner: z.string().min(1, "proprietar obligatoriu"),
    signedAt: ISODate,
    startDate: ISODate,
    endDate: ISODate,
    // Contract extensions: each row captures the addendum document, its date, and the new expiry date
    contractExtensions: z
      .array(
        z.object({
          docDate: ISODate, // date of the addendum document
          document: z.string().trim().min(1, "document obligatoriu").max(200),
          extendedUntil: ISODate, // new contract expiry date
        })
      )
      .optional()
      .default([]),
  // Payment term in days from invoice date
  paymentDueDays: z.number().int().min(0).max(120).optional(),
    // Indexing schedule fields on Contract
    // - indexingDay: day of month (1-31)
    // - howOftenIsIndexing: recurrence in months (1-12)
    // - indexingDates: computed forecast dates between startDate and effective end date
    //   with mutable metadata for tracking actual application
    indexingDay: z.number().int().min(1).max(31).optional(),
    indexingMonth: z.number().int().min(1).max(12).optional(),
    howOftenIsIndexing: z.number().int().min(1).max(12).optional(),
    indexingDates: z
      .array(
        z.object({
          forecastDate: ISODate,
          actualDate: ISODate.optional(),
          document: z
            .string()
            .trim()
            .max(200)
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
          newRentAmount: z.number().positive().optional(),
          done: z.boolean().default(false),
        })
      )
      .default([]),
    // Rent structure
    rentType: z.enum(["monthly", "yearly"]).default("monthly"),
  // Whether monthly invoice corresponds to the current month (default) or is issued in advance for the next month
  invoiceMonthMode: z.enum(["current", "next"]).default("current"),
    monthlyInvoiceDay: z.number().int().min(1).max(31).optional(),
    irregularInvoices: z
      .array(
        z.object({
          month: z.number().int().min(1).max(12),
          day: z.number().int().min(1).max(31),
          amountEUR: z.number().positive(),
        })
      )
      .optional(),
    // Deprecated alias for backward compatibility in parsing (not used in code)
    yearlyInvoices: z
      .array(
        z.object({
          month: z.number().int().min(1).max(12),
          day: z.number().int().min(1).max(31),
          amountEUR: z.number().positive(),
        })
      )
      .optional(),
  // Deprecated single scan field (kept for backward-compat in reads)
  scanUrl: ScanUrl.nullish(),
  // New: multiple scans
  scans: z.array(ContractScanItemSchema).default([]),
  // Optional EUR->RON exchange rate
  exchangeRateRON: z.number().positive().optional(),
  // TVA percent (0-100), integer
  tvaPercent: z.number().int().min(0).max(100).optional(),
  // Correction percent (0-100), can be decimal; applied to base amount before TVA
  correctionPercent: z.number().min(0).max(100).optional(),
  // rentHistory removed; amounts are tracked via indexingDates
  // inflation tracking removed
  })
  .superRefine((val, ctx) => {
    const s = new Date(val.signedAt);
    const b = new Date(val.startDate);
    const e = new Date(val.endDate);
    if (b < s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "startDate trebuie să fie după sau egal cu signedAt",
      });
    }
    if (e < b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate trebuie să fie după sau egal cu startDate",
      });
    }

    // Validate contractExtensions entries relative to start/end
    const list = Array.isArray((val as any).contractExtensions)
      ? ((val as any).contractExtensions as { docDate: string; document: string; extendedUntil: string }[])
      : [];
    list.forEach((row, idx) => {
      const until = new Date(row.extendedUntil);
      const docDate = new Date(row.docDate);
      if (until < e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contractExtensions", idx, "extendedUntil"],
          message: "extendedUntil trebuie să fie după sau egal cu endDate",
        });
      }
      if (docDate < s) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contractExtensions", idx, "docDate"],
          message: "docDate trebuie să fie după sau egal cu signedAt",
        });
      }
      if (docDate > until) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contractExtensions", idx, "docDate"],
          message: "docDate nu poate fi după extendedUntil",
        });
      }
    });

    // paymentDueDays has no cross-field dependency

    // No cross-field requirement between amount and rate: amount is derived from rentHistory

    // Conditional requirements based on rent type
    if (val.rentType === "yearly") {
      const list = Array.isArray((val as any).irregularInvoices)
        ? ((val as any).irregularInvoices as any[])
        : Array.isArray((val as any).yearlyInvoices)
        ? ((val as any).yearlyInvoices as any[])
        : [];
      if (list.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["irregularInvoices"],
          message: "Pentru chirie anuală, adaugă cel puțin o factură cu sumă",
        });
      }
    }

    // Partners consistency: ensure partners array (if present) includes primary partner
    if (Array.isArray((val as any).partners) && (val as any).partners.length > 0) {
      const first = (val as any).partners[0];
      if (first.name !== val.partner) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partners"],
          message: "Primul partener din listă trebuie să corespundă câmpului 'partner'",
        });
      }
    }

    // Validate indexing schedule coherence: either all three fields are present, or none.
    const dayDefined = typeof (val as any).indexingDay !== "undefined";
    const monthDefined = typeof (val as any).indexingMonth !== "undefined";
    const freqDefined = typeof (val as any).howOftenIsIndexing !== "undefined";
    const anyDefined = dayDefined || monthDefined || freqDefined;
    if (anyDefined && !(dayDefined && monthDefined && freqDefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: !dayDefined
          ? ["indexingDay"]
          : !monthDefined
          ? ["indexingMonth"]
          : ["howOftenIsIndexing"],
        message: "Completează ziua, luna și frecvența pentru indexare.",
      });
    }
    if (dayDefined) {
      const d = (val as any).indexingDay;
      if (!(Number.isInteger(d) && d >= 1 && d <= 31)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["indexingDay"],
          message: "indexingDay trebuie să fie un număr între 1 și 31",
        });
      }
    }
    if (monthDefined) {
      const m = (val as any).indexingMonth;
      if (!(Number.isInteger(m) && m >= 1 && m <= 12)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["indexingMonth"],
          message: "indexingMonth trebuie să fie un număr între 1 și 12",
        });
      }
    }
    if (freqDefined) {
      const f = (val as any).howOftenIsIndexing;
      if (!(Number.isInteger(f) && f >= 1 && f <= 12)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["howOftenIsIndexing"],
          message: "howOftenIsIndexing trebuie să fie între 1 și 12 luni",
        });
      }
    }
  });

export type Contract = z.infer<typeof ContractSchema>;
// Deprecated: static Owner union. Kept for older code hints only.
export type Owner = string;
export type ContractScanItem = z.infer<typeof ContractScanItemSchema>;
