import { z } from "zod";

// Reuse validation similar to Contract scanUrl
export const ScanUrl = z
  .string()
  .min(1)
  .refine(
    (s: string) => s.startsWith("/") || /^https?:\/\//i.test(s),
    "scan trebuie să fie o cale publică (începe cu /) sau un URL valid"
  )
  .refine(
    (s: string) =>
      /\.(pdf|png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(s) ||
      /^\/api\/uploads\/([a-f\d]{24})(?:$|[?#])/i.test(s),
    "scan trebuie să fie o imagine (png, jpg, jpeg, gif, webp, svg) sau un PDF"
  );

export const ScanItemSchema = z.object({
  url: ScanUrl,
  title: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export const AssetSchema = z
  .object({
    id: z.string().min(1, "id obligatoriu"),
    name: z.string().min(1, "nume obligatoriu"),
    address: z.string().min(1, "adresă obligatorie"),
    areaSqm: z
      .preprocess((v) => {
        if (v === "" || v === undefined || v === null) return undefined;
        const n = typeof v === "string" ? Number(v) : v;
        return typeof n === "number" && !isNaN(n) ? n : NaN;
      }, z
        .number()
        .nonnegative("suprafața trebuie să fie >= 0")
        .max(1000000, "suprafața este prea mare")
      )
      .optional(),
    scans: z.array(ScanItemSchema).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // no cross-field constraints for now
  });

export type Asset = z.infer<typeof AssetSchema>;
export type ScanItem = z.infer<typeof ScanItemSchema>;
