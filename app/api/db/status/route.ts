import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

type DBStatus = {
  env: { MONGODB_URI: boolean; MONGODB_DB: boolean };
  connected: boolean;
  latencyMs?: number;
  db?: { name: string };
  counts?: { contracts: number; users: number; audit_logs: number };
  cluster?: { location: "local" | "remote"; provider?: "atlas" | "other" };
  reason?: "not-configured" | "dns" | "auth" | "timeout" | "tls" | "network" | "unknown";
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
    // Classify cluster location from URI without exposing credentials
    const uri = process.env.MONGODB_URI;
    if (uri) {
      try {
        const u = new URL(uri);
        const host = (u.hostname || "").toLowerCase();
        const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
        const isLocal = localHosts.has(host) || host.endsWith(".local");
        const isAtlas = host.endsWith("mongodb.net");
        res.cluster = {
          location: isLocal ? "local" : "remote",
          provider: isAtlas ? "atlas" : "other",
        };
      } catch {
        // ignore parsing issues; leave cluster undefined
      }
    }

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
    const msg = (err as Error)?.message || String(err);
    const low = msg.toLowerCase();
    if (!res.env.MONGODB_URI) res.reason = "not-configured";
    else if (low.includes("enotfound") || low.includes("dns")) res.reason = "dns";
    else if (low.includes("auth")) res.reason = "auth";
    else if (low.includes("timeout") || low.includes("server selection")) res.reason = "timeout";
    else if (low.includes("tls") || low.includes("ssl") || low.includes("certificate")) res.reason = "tls";
    else if (low.includes("network") || low.includes("econnrefused") || low.includes("econnreset")) res.reason = "network";
    else res.reason = "unknown";
    res.error = msg;
    return NextResponse.json(res, { status: 500 });
  }
}
