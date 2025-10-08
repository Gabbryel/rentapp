import { getDb } from "@/lib/mongodb";
import type { AuditLog } from "@/lib/schemas/audit";
import { currentUser } from "@/lib/auth";
import type { Contract } from "@/lib/schemas/contract";
import fs from "node:fs/promises";
import path from "node:path";

export async function logAction(input: Omit<AuditLog, "at" | "userEmail"> & { userEmail?: string | null }) {
  if (!process.env.MONGODB_URI) return;
  const db = await getDb();
  const user = await currentUser();
  const doc: AuditLog = {
    ...input,
    at: new Date(),
    userEmail: input.userEmail ?? user?.email ?? null,
  } as AuditLog;
  await db.collection<AuditLog>("audit_logs").insertOne(doc);
}

export async function listLogs(limit = 100) {
  if (!process.env.MONGODB_URI) return [] as AuditLog[];
  const db = await getDb();
  return db
    .collection<AuditLog>("audit_logs")
    .find({}, { sort: { at: -1 }, limit })
    .toArray();
}

export async function listLogsByUser(userEmail: string, limit = 100) {
  if (!process.env.MONGODB_URI) return [] as AuditLog[];
  const db = await getDb();
  return db
    .collection<AuditLog>("audit_logs")
    .find({ userEmail }, { sort: { at: -1 }, limit })
    .toArray();
}

export function computeDiffContract(prev: Partial<Contract> | null | undefined, next: Contract) {
  const fields: Array<keyof Contract> = [
    "name",
    "partner",
    "owner",
    "signedAt",
    "startDate",
    "endDate",
    "extensionDate",
  "extendedAt",
    "paymentDueDays",
    "scanUrl",
    // indexing & schedule fields removed
    "amountEUR",
    "exchangeRateRON",
    "tvaPercent",
    "correctionPercent",
    "rentType",
  // Newly tracked so changes are visible in audit + messages
  "invoiceMonthMode",
    "monthlyInvoiceDay",
    "yearlyInvoices",
  // inflation tracking fields removed
  ];
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
  for (const f of fields) {
    const before = prev ? (prev as Partial<Contract>)[f] : undefined;
    const after = next[f];
    const isArray = Array.isArray(before) || Array.isArray(after);
    const equal = isArray
      ? JSON.stringify((before as unknown[]) ?? []) === JSON.stringify((after as unknown[]) ?? [])
      : before === after;
    if (!equal) {
      changes.push({ field: String(f), from: (before as unknown) ?? null, to: (after as unknown) ?? null });
    }
  }
  let scanChange: "none" | "added" | "removed" | "replaced" = "none";
  const b = prev?.scanUrl ?? null;
  const a = next.scanUrl ?? null;
  if (!b && a) scanChange = "added";
  else if (b && !a) scanChange = "removed";
  else if (b && a && b !== a) scanChange = "replaced";
  return { changes, scanChange };
}

export async function deleteLocalUploadIfPresent(scanUrl?: string | null) {
  if (!scanUrl) return { deleted: false, reason: "no-scan" } as const;
  if (!scanUrl.startsWith("/uploads/")) return { deleted: false, reason: "external-or-nonlocal" } as const;
  try {
    const rel = scanUrl.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", rel);
    await fs.unlink(filePath);
    return { deleted: true, reason: "removed", path: filePath } as const;
  } catch {
    return { deleted: false, reason: "unlink-failed" } as const;
  }
}
