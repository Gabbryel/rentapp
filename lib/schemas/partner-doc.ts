import { z } from "zod";
import { ISODate } from "@/lib/schemas/contract";

export const PartnerDocSchema = z.object({
  id: z.string().min(1),
  partnerId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().min(1),
  contentType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  createdAt: ISODate.default(() => new Date().toISOString().slice(0, 10)),
});

export type PartnerDoc = z.infer<typeof PartnerDocSchema>;
