import { z } from "zod";
import { ISODate } from "@/lib/schemas/contract";

// Indexing record belonging to a Contract
// - indexDate: when the indexing is scheduled/recorded
// - actualIndexingDate: when indexing actually took place (if completed)
// - startDate: when the new rent amount becomes effective (can be after actualIndexingDate)
// - amount: the new rent amount in EUR, which becomes the contract's amountEUR when applied
export const IndexingSchema = z.object({
  id: z.string().min(1).optional(),
  contractId: z.string().min(1),
  indexDate: ISODate,
  actualIndexingDate: ISODate.optional(),
  startDate: ISODate.optional(),
  amount: z.number().positive().optional(),
  document: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  // New: schedule definition kept alongside the indexing record
  indexingDay: z.number().int().min(1).max(31).optional(),
  indexingMonth: z.number().int().min(1).max(12).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Indexing = z.infer<typeof IndexingSchema>;
