import { randomUUID } from "crypto";
import { getDb } from "@/lib/mongodb";
import { readJson, writeJson } from "@/lib/local-store";

export type DiagnosticEvent = {
  id: string;
  tag: string;
  step: string;
  createdAt: string;
  context?: Record<string, unknown>;
};

const STORE_FILE = "diagnostics-home.json";
const RETENTION_MS = 1000 * 60 * 60 * 24 * 7; // seven days
const MAX_LOCAL_EVENTS = 500;
const MAX_ARRAY_LENGTH = 30;
const MAX_OBJECT_KEYS = 30;
const MAX_STRING_LENGTH = 500;
const MAX_DEPTH = 4;

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DEPTH) return "[depth-exceeded]";

  if (typeof value === "string") {
    if (value.length <= MAX_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_STRING_LENGTH)}…`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    if (Number.isFinite(value)) return value;
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitize(item, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      result[key] = sanitize(val, depth + 1);
    }
    return result;
  }

  return String(value);
}

function recentOnly(events: DiagnosticEvent[]): DiagnosticEvent[] {
  const cutoff = Date.now() - RETENTION_MS;
  return events.filter((event) => {
    const ts = Date.parse(event.createdAt);
    return Number.isFinite(ts) ? ts >= cutoff : true;
  });
}

export async function recordDiagnosticEvent({
  tag,
  step,
  context,
}: {
  tag: string;
  step: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const event: DiagnosticEvent = {
    id: randomUUID(),
    tag,
    step,
    createdAt: new Date().toISOString(),
    context: context ? (sanitize(context) as Record<string, unknown>) : undefined,
  };

  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      await db.collection<DiagnosticEvent>("diagnostic_events").insertOne(event);
      const cutoffIso = new Date(Date.now() - RETENTION_MS).toISOString();
      await db
        .collection<DiagnosticEvent>("diagnostic_events")
        .deleteMany({ createdAt: { $lt: cutoffIso }, tag });
      return;
    } catch {
      // fall back to local store
    }
  }

  const existing = await readJson<DiagnosticEvent[]>(STORE_FILE, []);
  const filtered = recentOnly(existing);
  filtered.push(event);
  const trimmed = filtered.slice(-MAX_LOCAL_EVENTS);
  await writeJson(STORE_FILE, trimmed);
}

export async function fetchDiagnosticEvents({
  tag,
  limit = 200,
}: {
  tag?: string;
  limit?: number;
} = {}): Promise<DiagnosticEvent[]> {
  let events: DiagnosticEvent[] = [];

  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      const cursor = db
        .collection<DiagnosticEvent>("diagnostic_events")
        .find(tag ? { tag } : {}, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(limit);
      events = await cursor.toArray();
      return events;
    } catch {
      // fall through to local store
    }
  }

  const existing = await readJson<DiagnosticEvent[]>(STORE_FILE, []);
  events = recentOnly(existing)
    .filter((event) => (tag ? event.tag === tag : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  return events;
}

export async function clearDiagnosticEvents(tag?: string): Promise<void> {
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      await db
        .collection<DiagnosticEvent>("diagnostic_events")
        .deleteMany(tag ? { tag } : {});
      return;
    } catch {
      // continue to local store
    }
  }

  if (tag) {
    const existing = await readJson<DiagnosticEvent[]>(STORE_FILE, []);
    const remaining = existing.filter((event) => event.tag !== tag);
    await writeJson(STORE_FILE, remaining);
  } else {
    await writeJson(STORE_FILE, []);
  }
}
