import { z } from "zod";
import { ISODate } from "@/lib/schemas/contract";

export const DepositType = z.enum(["bank_transfer", "check", "promissory_note"]);

export const DepositSchema = z.object({
  id: z.string().min(1).optional(),
  contractId: z.string().min(1),
  type: DepositType,
  isDeposited: z.boolean().default(false),
  returned: z.boolean().default(false),
  // amounts can be missing or explicitly null; when present must be positive
  amountEUR: z.number().positive().nullable().optional(),
  amountRON: z.number().positive().nullable().optional(),
  note: z.string().max(500).optional(),
  createdAt: ISODate.optional(),
  updatedAt: ISODate.optional(),
});

export type Deposit = z.infer<typeof DepositSchema>;
