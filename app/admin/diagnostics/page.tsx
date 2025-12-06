import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  fetchDiagnosticEvents,
  clearDiagnosticEvents,
} from "@/lib/diagnostics";

const TAG = "home.issueDue";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ro-RO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function DiagnosticsPage() {
  const events = await fetchDiagnosticEvents({ tag: TAG, limit: 200 });

  async function clearLogs() {
    "use server";
    await clearDiagnosticEvents(TAG);
    revalidatePath("/admin/diagnostics");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Loguri emitere facturi (home)
          </h1>
          <p className="text-sm text-foreground/60">
            Ultimele {events.length} înregistrări capturate din acțiunea de
            emitere rapidă.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5"
          >
            ← Înapoi la dashboard
          </Link>
          <form action={clearLogs}>
            <button
              type="submit"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/20"
            >
              Șterge logurile
            </button>
          </form>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 bg-background/60 p-6 text-sm text-foreground/60">
          Nu există loguri pentru a afișa. Reproduce problema în producție și
          reîncarcă această pagină.
        </div>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-foreground/10 bg-background/70 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {formatDate(event.createdAt)}
                </span>
                <span className="rounded-md border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-xs uppercase tracking-wide text-foreground/60">
                  {event.step}
                </span>
              </div>
              {event.context ? (
                <pre className="overflow-x-auto rounded-md bg-foreground/5 p-3 text-xs text-foreground/80">
                  {JSON.stringify(event.context, null, 2)}
                </pre>
              ) : (
                <div className="text-xs text-foreground/60">
                  Fără detalii suplimentare.
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
