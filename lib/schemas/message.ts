import { z } from "zod";

export const MessageSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  createdAt: z.string(),
  createdBy: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;
