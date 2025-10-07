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
    // Owner linkage from owners collection
    ownerId: z.string().optional(),
    // Denormalized owner name for display; UI now enforces selection from list
    owner: z.string().min(1, "proprietar obligatoriu"),
    signedAt: ISODate,
    startDate: ISODate,
    endDate: ISODate,
    indexingDates: z.array(ISODate).default([]),
    // Optional periodic indexing schedule: day (1-31), month (1-12), every N months (default 12)
    indexingScheduleDay: z.number().int().min(1).max(31).optional(),
    indexingScheduleMonth: z.number().int().min(1).max(12).optional(),
    indexingEveryMonths: z.number().int().min(1).max(120).optional(),
    // Optional additional dates
    extensionDate: ISODate.optional(),
    // When the extension (addendum) took place
    extendedAt: ISODate.optional(),
  // Payment term in days from invoice date
  paymentDueDays: z.number().int().min(0).max(120).optional(),
    // Rent structure
    rentType: z.enum(["monthly", "yearly"]).default("monthly"),
  // Whether monthly invoice corresponds to the current month (default) or is issued in advance for the next month
  invoiceMonthMode: z.enum(["current", "next"]).default("current"),
    monthlyInvoiceDay: z.number().int().min(1).max(31).optional(),
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
  // Optional amounts: if one is provided, both must be provided and > 0
  amountEUR: z.number().positive().optional(),
  exchangeRateRON: z.number().positive().optional(),
  // TVA percent (0-100), integer
  tvaPercent: z.number().int().min(0).max(100).optional(),
  // Correction percent (0-100), can be decimal; applied to base amount before TVA
  correctionPercent: z.number().min(0).max(100).optional(),
  // Historical rent changes (previous amounts). A new entry is appended automatically when amountEUR/exchangeRateRON change.
  rentHistory: z
    .array(
      z.object({
        changedAt: ISODate, // when the previous amount stopped being current
        amountEUR: z.number().positive(),
        exchangeRateRON: z.number().positive().optional(),
        correctionPercent: z.number().min(0).max(100).optional(),
        tvaPercent: z.number().int().min(0).max(100).optional(),
        note: z.string().max(300).optional(),
      })
    )
    .default([]),
  // Optional persisted inflation verification
  inflationVerified: z.boolean().optional(),
  inflationVerifiedAt: ISODate.optional(),
  inflationFromMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  inflationToMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  inflationLocalPercent: z.number().optional(),
  inflationAiPercent: z.number().optional(),
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

    // If extensionDate provided, ensure it's after or equal to endDate
    if (val.extensionDate) {
      const ext = new Date(val.extensionDate);
      if (ext < e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["extensionDate"],
          message: "extensionDate trebuie să fie după sau egal cu endDate",
        });
      }
    }

    // Basic sanity for extendedAt: must be a valid date (already enforced) and not before signedAt
    if (val.extendedAt) {
      const exAt = new Date(val.extendedAt);
      if (exAt < s) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["extendedAt"],
          message: "extendedAt trebuie să fie după sau egal cu signedAt",
        });
      }
      if (val.extensionDate) {
        const ext = new Date(val.extensionDate);
        if (exAt > ext) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["extendedAt"],
            message: "extendedAt nu poate fi după extensionDate",
          });
        }
      }
    }

    // paymentDueDays has no cross-field dependency

    const hasAmount = typeof val.amountEUR === "number";
    const hasRate = typeof val.exchangeRateRON === "number";
    if (hasAmount !== hasRate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasAmount ? ["exchangeRateRON"] : ["amountEUR"],
        message: "Dacă specifici suma în EUR, trebuie să specifici și cursul RON/EUR (și invers)",
      });
    }

    // Conditional requirements based on rent type
    if (val.rentType === "yearly") {
      const list = Array.isArray(val.yearlyInvoices) ? val.yearlyInvoices : [];
      if (list.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["yearlyInvoices"],
          message: "Pentru chirie anuală, adaugă cel puțin o factură cu sumă",
        });
      }
    }
  });

export type Contract = z.infer<typeof ContractSchema>;
// Deprecated: static Owner union. Kept for older code hints only.
export type Owner = string;
export type ContractScanItem = z.infer<typeof ContractScanItemSchema>;
