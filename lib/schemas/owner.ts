import { z } from "zod";
import { ISODate } from "@/lib/schemas/contract";

// Owner model mirrors Partner model fields
export const OwnerSchema = z.object({
  id: z.string().min(1, "id obligatoriu"),
  name: z.string().min(1, "nume obligatoriu"),
  vatNumber: z.string().min(1, "CUI obligatoriu"), // VAT number (CUI)
  orcNumber: z.string().min(1, "Nr. ORC obligatoriu"), // Trade Register number
  headquarters: z.string().min(1, "Sediu obligatoriu"),
  createdAt: ISODate.default(() => new Date().toISOString().slice(0, 10)),
  updatedAt: ISODate.default(() => new Date().toISOString().slice(0, 10)),
});

export type Owner = z.infer<typeof OwnerSchema>;
