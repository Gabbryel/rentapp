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
    (s: string) => /\.(pdf|png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(s),
    "scan trebuie să fie o imagine (png, jpg, jpeg, gif, webp, svg) sau un PDF"
  );

// Validate ISO-like date (YYYY-MM-DD) used in mock data
const ISODate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data trebuie în formatul YYYY-MM-DD");

export const ContractSchema = z
  .object({
    id: z.string().min(1, "id obligatoriu"),
    name: z.string().min(1, "nume obligatoriu"),
    partner: z.string().min(1, "partener obligatoriu"),
    owner: z
      .enum(["Markov Services s.r.l.", "MKS Properties s.r.l."])
      .default("Markov Services s.r.l."),
    signedAt: ISODate,
    startDate: ISODate,
    endDate: ISODate,
  // Accept a PDF/image URL or null/undefined
  scanUrl: ScanUrl.nullish(),
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
  });

export type Contract = z.infer<typeof ContractSchema>;
export type Owner = "Markov Services s.r.l." | "MKS Properties s.r.l.";
