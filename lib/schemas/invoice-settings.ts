import { z } from "zod";

// Settings are per-owner. We use ownerKey = ownerId when available, else a slug of owner name.
export const InvoiceSettingsSchema = z.object({
  id: z.string().min(1), // ownerKey
  series: z.string().trim().min(1).default("MS"),
  nextNumber: z.number().int().min(1).default(1),
  padWidth: z.number().int().min(1).max(10).default(5),
  includeYear: z.boolean().default(true),
  updatedAt: z.string(), // ISO date
});

export type InvoiceSettings = z.infer<typeof InvoiceSettingsSchema>;
