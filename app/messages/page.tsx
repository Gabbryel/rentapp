import { listMessages } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const messages = await listMessages(100);
  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Mesaje</h1>
        <p className="text-sm text-foreground/60 mb-4">
          Cele mai noi mesaje apar sus. Fereastra de notificări se deschide pe
          toate dispozitivele conectate când se publică un mesaj nou.
        </p>
        <ul className="space-y-3">
          {messages.map((m) => (
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
          {messages.length === 0 && (
            <li className="text-foreground/60">Nu există mesaje.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
