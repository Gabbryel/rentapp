import { z } from "zod";

export const NotificationSettingsSchema = z.object({
  userEmail: z.string().email(),
  onChanges: z.boolean().default(false),
  onNewContracts: z.boolean().default(false),
  onNewInvoices: z.boolean().default(false),
  updatedAt: z.date().default(() => new Date()),
});

export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
