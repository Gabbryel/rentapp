import { z } from "zod";
import { ISODate } from "@/lib/schemas/contract";

// Invoice model: belongs to a contract, issued on a date; captures parties and amounts
export const InvoiceSchema = z
  .object({
    // Identity
    id: z.string().min(1, "id obligatoriu"),
    contractId: z.string().min(1, "contractId obligatoriu"),
    contractName: z.string().min(1, "numele contractului obligatoriu"),
    // Dates
    issuedAt: ISODate, // data facturii (din contract)
    dueDays: z.number().int().min(0).max(120).default(0),
    // Parties
  ownerId: z.string().nullable().optional(),
    owner: z.string().min(1, "proprietar obligatoriu"),
    partnerId: z.string().min(1, "partnerId obligatoriu"),
    partner: z.string().min(1, "client obligatoriu"),
    // Amounts
    amountEUR: z.number().positive(), // baza în EUR
    correctionPercent: z.number().min(0).max(100).default(0), // corecție aplicată la EUR
    correctedAmountEUR: z.number().positive(), // EUR după corecție
    exchangeRateRON: z.number().positive(), // curs RON/EUR la data emiterii
    netRON: z.number().positive(), // baza în RON (după corecție)
    tvaPercent: z.number().int().min(0).max(100).default(0), // TVA %
    vatRON: z.number().nonnegative(), // valoare TVA
    totalRON: z.number().positive(), // total de plată
    // Optional artifacts
  number: z.string().min(1).nullish(), // număr factură (poate lipsi)
    note: z.string().optional(),
    pdfUrl: z.string().optional(), // link către PDF salvat (dacă e cazul)
    // Timestamps
    createdAt: ISODate,
    updatedAt: ISODate,
  })
  .superRefine((val, ctx) => {
    // Lightweight consistency checks without strict rounding constraints
    if (val.correctedAmountEUR < val.amountEUR) {
      // Correction could be 0, but not reduce below base for our use-case
      // We don't hard-error here; allow lower if negative correction ever used
    }
    if (val.tvaPercent < 0 || val.tvaPercent > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tvaPercent"], message: "TVA trebuie între 0 și 100" });
    }
  });

export type Invoice = z.infer<typeof InvoiceSchema>;
