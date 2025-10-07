import { getDb } from "@/lib/mongodb";
import type { User } from "@/lib/schemas/user";

export async function listUsers(): Promise<User[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const docs = await db.collection<User>("users").find({}, { projection: { _id: 0 } }).toArray();
  return docs;
}

export async function setAdmin(email: string, isAdmin: boolean) {
  if (!process.env.MONGODB_URI) return false;
  const db = await getDb();
  const res = await db.collection<User>("users").updateOne({ email }, { $set: { isAdmin } });
  return Boolean(res.acknowledged && res.matchedCount);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  if (!process.env.MONGODB_URI) return null;
  const db = await getDb();
  const doc = await db.collection<User>("users").findOne({ email }, { projection: { _id: 0 } });
  return doc ?? null;
}

export async function deleteUser(email: string) {
  if (!process.env.MONGODB_URI) return false;
  const db = await getDb();
  const res = await db.collection<User>("users").deleteOne({ email });
  return Boolean(res.acknowledged && res.deletedCount === 1);
}
