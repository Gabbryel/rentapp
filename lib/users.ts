import { getDb } from "@/lib/mongodb";
import type { User } from "@/lib/schemas/user";

export async function listUsers(): Promise<User[]> {
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) return [];
  const db = await getDb();
  const docs = await db.collection<User>("users").find({}, { projection: { _id: 0 } }).toArray();
  return docs;
}
