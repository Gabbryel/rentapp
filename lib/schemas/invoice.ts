import { z } from "zod";
import { ISODate } from "@/lib/schemas/contract";

export const InvoiceSchema = z
  .object({
    id: z.string().min(1, "id obligatoriu"),
    contractId: z.string().min(1, "contractId obligatoriu"),
    partnerId: z.string().min(1, "partnerId obligatoriu"),
    // Date when the invoice is issued
    issuedAt: ISODate,
    dueDays: z.number().int().min(0).max(120).default(0),
    // Amounts captured at issuance time
    amountEUR: z.number().positive(),
    exchangeRateRON: z.number().positive(), // actual RON/EUR on issue date
    correctionPercent: z.number().int().min(0).max(100).default(0),
    tvaPercent: z.number().int().min(0).max(100).default(0),
    // Optional metadata
    number: z.string().min(1).optional(), // invoice number
    note: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // No extra checks beyond ranges for now
    if (val.amountEUR <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountEUR"], message: "Suma EUR trebuie să fie > 0" });
    }
    if (val.exchangeRateRON <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exchangeRateRON"], message: "Cursul trebuie să fie > 0" });
    }
  });

export type Invoice = z.infer<typeof InvoiceSchema>;
