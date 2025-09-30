import { createMessage, listMessages } from "@/lib/messages";
import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";
import { cookies } from "next/headers";

// Optional: basic admin check via cookie/me endpoint; adapt as per existing auth if available
async function getAdminEmail(): Promise<string | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/me`,
      {
        cache: "no-store",
        headers: { Cookie: cookies().toString() },
        // Using absolute URL when available; on server, relative sometimes fails for fetch with headers
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.isAdmin ? data?.email ?? null : null;
  } catch {
    return null;
  }
}

export default async function AdminMessagesPage() {
  noStore();
  const adminEmail = await getAdminEmail();
  const recent = await listMessages(30);

  async function sendMessage(formData: FormData) {
    "use server";
    const text = String(formData.get("text") || "").trim();
    if (!text) return;
    const me = await getAdminEmail();
    const saved = await createMessage({ text, createdBy: me });
    try {
      await logAction({
        action: "message.create",
        targetType: "message",
        targetId: saved?.id ?? "n/a",
        meta: { length: text.length },
      });
    } catch {}
    revalidatePath("/messages");
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">
          Mesaje (Admin)
        </h1>
        {adminEmail ? (
          <form
            action={sendMessage}
            className="rounded-xl border border-foreground/10 bg-background/70 p-4 mb-6 space-y-3"
          >
            <label className="block text-sm text-foreground/70">
              Mesaj nou
              <textarea
                name="text"
                rows={3}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent p-2 text-sm"
                placeholder="Scrie un mesaj pentru toți utilizatorii conectați..."
                required
              />
            </label>
            <div className="flex items-center justify-between">
              <div className="text-xs text-foreground/60">
                Va fi trimis instant către toate dispozitivele conectate.
              </div>
              <button className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5">
                Trimite mesaj
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-md border border-foreground/10 bg-background/70 p-4 text-sm text-foreground/70 mb-6">
            Trebuie să fii administrator pentru a trimite mesaje.
          </div>
        )}
        <h2 className="text-sm uppercase tracking-wide text-foreground/60 mb-2">
          Recente
        </h2>
        <ul className="space-y-3">
          {recent.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-foreground/10 p-4 bg-background/70"
            >
              <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                {m.text}
              </div>
              <div className="mt-1 text-[11px] text-foreground/50">
                {new Date(m.createdAt).toLocaleString("ro-RO")}
                {m.createdBy ? ` • ${m.createdBy}` : ""}
              </div>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="text-foreground/60">Nu există mesaje.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
