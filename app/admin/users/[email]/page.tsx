import { currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
import { getUserByEmail } from "@/lib/users";
import { listLogsByUser } from "@/lib/audit";
import type { AuditLog } from "@/lib/schemas/audit";
import { redirect } from "next/navigation";
import Link from "next/link";

function envIsAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (admins.length === 0) return false;
  return email ? admins.includes(email) : false;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("ro-RO");
}

function formatMetaValue(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return `[${v.map((x) => formatMetaValue(x)).join(", ")}]`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

type DeletionInfo = { deleted: boolean; reason: string; path?: string } | { deleted: false; reason: string } | undefined;
function renderDeletion(d: DeletionInfo) {
  if (!d) return "—";
  if ("deleted" in d && d.deleted) return `șters (${d.path ?? "local"})`;
  return `nicio acțiune (${"reason" in d ? d.reason : "necunoscut"})`;
}

type Change = { field: string; from: unknown; to: unknown };

export default async function UserAuditPage({ params }: { params: { email: string } }) {
  const me = await currentUser();
  const allowed = me?.isAdmin || envIsAdmin(me?.email);
  if (!allowed) redirect("/login");

  const email = decodeURIComponent(params.email);
  const mongoConfigured = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB);
  const user = mongoConfigured ? await getUserByEmail(email) : null;

  const logs: AuditLog[] = mongoConfigured ? await listLogsByUser(email, 200) : [];

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-foreground/70 hover:underline">← Înapoi la Admin</Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Jurnal acțiuni pentru {email}</h1>
      </div>

      {!mongoConfigured && (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 mb-6">
          MongoDB nu este configurat. Nu pot afișa audit pentru utilizatori.
        </div>
      )}

      {mongoConfigured && !user && (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-400 p-3 mb-6">
          Utilizatorul nu există sau a fost șters.
        </div>
      )}

      <div className="rounded-lg border border-foreground/15 p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-foreground/60">
            <tr>
              <th className="text-left font-medium">Timp</th>
              <th className="text-left font-medium">Acțiune</th>
              <th className="text-left font-medium">Țintă</th>
              <th className="text-left font-medium">Detalii</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={`${l.action}-${l.targetId}-${l.at}`} className="border-t border-foreground/10">
                <td className="py-2 whitespace-nowrap">{fmtDate(l.at)}</td>
                <td className="py-2">{l.action}</td>
                <td className="py-2">{l.targetType}:{l.targetId}</td>
                <td className="py-2 text-foreground/80">
                  {l.meta ? (
                    <div className="space-y-1">
                      {"name" in l.meta ? (
                        <div>
                          <span className="text-foreground/60">Nume:</span> {String((l.meta as any).name)}
                        </div>
                      ) : null}
                      {Array.isArray((l.meta as any).changes) && (l.meta as any).changes.length > 0 ? (
                        <div>
                          <div className="text-foreground/60">Câmpuri modificate:</div>
                          <ul className="list-disc ml-5">
                            {((l.meta as any).changes as Change[]).map((c, idx) => (
                              <li key={idx}>
                                <span className="font-medium">{c.field}</span>: <span className="line-through opacity-70">{formatMetaValue(c.from)}</span> → <span>{formatMetaValue(c.to)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {"scanChange" in (l.meta as any) ? (
                        <div>
                          <span className="text-foreground/60">Scan:</span> {String((l.meta as any).scanChange)}
                        </div>
                      ) : null}
                      {"deletedScan" in (l.meta as any) ? (
                        <div>
                          <span className="text-foreground/60">Ștergere fișier:</span> {renderDeletion((l.meta as any).deletedScan)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
