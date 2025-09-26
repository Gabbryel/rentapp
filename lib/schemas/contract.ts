import { z } from "zod";

// Allow either absolute URL (http/https) or a public path starting with "/"
const ScanUrl = z
  .string()
  .min(1)
  .refine(
    (s: string) => s.startsWith("/") || /^https?:\/\//i.test(s),
    "scanUrl trebuie să fie o cale publică (începe cu /) sau un URL valid"
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
    signedAt: ISODate,
    startDate: ISODate,
    endDate: ISODate,
    scanUrl: ScanUrl.optional(),
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
