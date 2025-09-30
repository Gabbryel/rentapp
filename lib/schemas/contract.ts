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

export const ContractSchema = z
  .object({
    id: z.string().min(1, "id obligatoriu"),
    name: z.string().min(1, "nume obligatoriu"),
    partnerId: z.string().optional(),
    partner: z.string().min(1, "partener obligatoriu"),
    owner: z
      .enum(["Markov Services s.r.l.", "MKS Properties s.r.l."])
      .default("Markov Services s.r.l."),
    signedAt: ISODate,
    startDate: ISODate,
    endDate: ISODate,
    indexingDates: z.array(ISODate).default([]),
    // Optional additional dates
    extensionDate: ISODate.optional(),
  // Payment term in days from invoice date
  paymentDueDays: z.number().int().min(0).max(120).optional(),
    // Rent structure
    rentType: z.enum(["monthly", "yearly"]).default("monthly"),
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
  // Accept a PDF/image URL or null/undefined
  scanUrl: ScanUrl.nullish(),
  // Optional amounts: if one is provided, both must be provided and > 0
  amountEUR: z.number().positive().optional(),
  exchangeRateRON: z.number().positive().optional(),
  // TVA percent (0-100), integer
  tvaPercent: z.number().int().min(0).max(100).optional(),
  // Correction percent (0-100), integer; applied to base amount before TVA
  correctionPercent: z.number().int().min(0).max(100).optional(),
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
export type Owner = "Markov Services s.r.l." | "MKS Properties s.r.l.";
