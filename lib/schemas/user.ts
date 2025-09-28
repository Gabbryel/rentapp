import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().min(1).optional(),
  email: z.string().email("email invalid"),
  passwordHash: z.string().min(10),
  isAdmin: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
});

export type User = z.infer<typeof UserSchema>;

export const RegisterSchema = z.object({
  email: z.string().email("email invalid"),
  password: z.string().min(8, "parola trebuie să aibă minim 8 caractere"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
