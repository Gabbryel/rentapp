import { z } from "zod";
import { ISODate } from "@/lib/schemas/contract";

export const PartnerSchema = z.object({
  id: z.string().min(1, "id obligatoriu"),
  name: z.string().min(1, "nume obligatoriu"),
  vatNumber: z.string().min(1, "CUI obligatoriu"), // VAT number (CUI)
  orcNumber: z.string().min(1, "Nr. ORC obligatoriu"), // Trade Register number
  headquarters: z.string().min(1, "Sediu obligatoriu"),
  representatives: z
    .array(
      z.object({
        fullname: z
          .preprocess(
            (v) => (v === "" || v === undefined ? null : v),
            z.string().trim().min(1).nullable()
          )
          .optional(),
        phone: z
          .preprocess(
            (v) => (v === "" || v === undefined ? null : v),
            z.string().trim().max(40).nullable()
          )
          .optional(),
        email: z
          .preprocess(
            (v) => (v === "" || v === undefined ? null : v),
            z.string().trim().email("email invalid").nullable()
          )
          .optional(),
        primary: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  isVatPayer: z.boolean().optional().default(false),
  createdAt: ISODate.default(() => new Date().toISOString().slice(0, 10)),
  updatedAt: ISODate.default(() => new Date().toISOString().slice(0, 10)),
});

export type Partner = z.infer<typeof PartnerSchema>;
