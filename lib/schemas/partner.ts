import { z } from "zod";
import { ISODate } from "@/lib/schemas/contract";

export const PartnerSchema = z.object({
  id: z.string().min(1, "id obligatoriu"),
  name: z.string().min(1, "nume obligatoriu"),
  vatNumber: z.string().min(1, "CUI obligatoriu"), // VAT number (CUI)
  orcNumber: z.string().min(1, "Nr. ORC obligatoriu"), // Trade Register number
  headquarters: z.string().min(1, "Sediu obligatoriu"),
  phone: z
    .preprocess(
      (v) => (v === null || v === undefined || (typeof v === "string" && v.trim() === "") ? undefined : v),
      z
        .string()
        .trim()
        .max(40)
        .optional()
        .transform((v) => (v && v.length > 0 ? v : undefined))
    )
    .optional(),
  email: z
    .preprocess(
      (v) => (v === null || v === undefined || (typeof v === "string" && v.trim() === "") ? undefined : v),
      z
        .string()
        .trim()
        .email("email invalid")
        .optional()
        .transform((v) => (v && v.length > 0 ? v : undefined))
    )
    .optional(),
  createdAt: ISODate.default(() => new Date().toISOString().slice(0, 10)),
  updatedAt: ISODate.default(() => new Date().toISOString().slice(0, 10)),
});

export type Partner = z.infer<typeof PartnerSchema>;
