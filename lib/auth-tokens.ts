import { getDb } from "@/lib/mongodb";

export type TokenDoc = {
  token: string;
  email: string;
  type: "verify" | "reset" | "invite";
  createdAt: Date;
  expiresAt: Date;
  data?: Record<string, unknown>;
};

function ttl(hours: number) {
  return new Date(Date.now() + hours * 3600 * 1000);
}

export async function issueToken(email: string, type: TokenDoc["type"], hours = 24, data?: TokenDoc["data"]) {
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat");
  const token = (globalThis.crypto?.randomUUID?.() ?? `t_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const doc: TokenDoc = { token, email, type, createdAt: new Date(), expiresAt: ttl(hours), data };
  const db = await getDb();
  await db.collection<TokenDoc>("auth_tokens").insertOne(doc as any);
  return token;
}

export async function consumeToken(token: string, type: TokenDoc["type"]) {
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat");
  const db = await getDb();
  const doc = await db.collection<TokenDoc>("auth_tokens").findOne({ token, type });
  if (!doc) return null;
  if (new Date(doc.expiresAt).getTime() < Date.now()) {
    await db.collection<TokenDoc>("auth_tokens").deleteOne({ token });
    return null;
  }
  await db.collection<TokenDoc>("auth_tokens").deleteOne({ token });
  return doc;
}
