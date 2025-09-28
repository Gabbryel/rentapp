import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

type DBStatus = {
  env: { MONGODB_URI: boolean; MONGODB_DB: boolean };
  connected: boolean;
  latencyMs?: number;
  db?: { name: string };
  counts?: { contracts: number; users: number; audit_logs: number };
  error?: string;
};

export async function GET() {
  const res: DBStatus = {
    env: {
      MONGODB_URI: Boolean(process.env.MONGODB_URI),
      MONGODB_DB: Boolean(process.env.MONGODB_DB),
    },
    connected: false,
  };
  try {
    const start = Date.now();
    const db = await getDb();
    await db.command({ ping: 1 });
    const latencyMs = Date.now() - start;
    const [contracts, users, logs] = await Promise.all([
      db.collection("contracts").countDocuments(),
      db.collection("users").countDocuments(),
      db.collection("audit_logs").countDocuments(),
    ]);
    res.connected = true;
    res.latencyMs = latencyMs;
    res.db = { name: db.databaseName };
    res.counts = { contracts, users, audit_logs: logs };
    return NextResponse.json(res);
  } catch (err: unknown) {
    res.error = (err as Error)?.message || String(err);
    return NextResponse.json(res, { status: 500 });
  }
}
