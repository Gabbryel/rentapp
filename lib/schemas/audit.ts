import { z } from "zod";

export const AuditLogSchema = z.object({
  id: z.string().optional(),
  at: z.date(),
  userEmail: z.string().email().optional().nullable(),
  action: z.string().min(1), // e.g., contract.create | contract.update | contract.delete
  targetType: z.string().min(1), // e.g., contract | user
  targetId: z.string().min(1),
  // meta can contain: name, changes[{field,from,to}], scanChange, deletedScan, etc.
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
