import { getDb } from "@/lib/mongodb";
import { MessageSchema, type Message } from "@/lib/schemas/message";
import { ObjectId } from "mongodb";
import { publish } from "@/lib/sse";
import type { WithId, Document } from "mongodb";

export async function listMessages(limit = 50): Promise<Message[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection("messages")
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return (docs as WithId<Document>[]).map((d) => ({
      id: String(d._id),
      text: String(d.text ?? ""),
      createdAt: new Date(d.createdAt ?? Date.now()).toISOString(),
      createdBy: d.createdBy ? String(d.createdBy) : undefined,
    }));
  } catch {
    return [];
  }
}

export async function createMessage(input: {
  text: string;
  createdBy?: string | null;
}): Promise<Message | null> {
  const nowIso = new Date().toISOString();
  const msg: Message = {
    text: input.text.trim(),
    createdAt: nowIso,
    createdBy: input.createdBy ?? undefined,
  };
  const parse = MessageSchema.safeParse(msg);
  if (!parse.success) return null;
  try {
    const db = await getDb();
    const res = await db.collection("messages").insertOne({
      text: msg.text,
      createdAt: new Date(nowIso),
      createdBy: msg.createdBy ?? null,
    });
    const saved: Message = { ...msg, id: String(res.insertedId) };
    // Broadcast via SSE both as message event and toast
    publish({ type: "toast", payload: { message: msg.text, kind: "info" } });
    return saved;
  } catch {
    // Still broadcast even if DB is unavailable
    publish({ type: "toast", payload: { message: msg.text, kind: "info" } });
    return null;
  }
}

export async function deleteMessage(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    const res = await db
      .collection("messages")
      .deleteOne({ _id: new ObjectId(id) });
    return res.deletedCount === 1;
  } catch {
    return false;
  }
}
