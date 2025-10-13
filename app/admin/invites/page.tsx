import { requireAdmin } from "@/lib/auth";

async function getInvites() {
  const res = await fetch(`${process.env.APP_BASE_URL || ""}/api/invite`, {
    cache: "no-store",
  });
  if (!res.ok)
    return [] as Array<{
      token: string;
      email: string;
      createdAt: string;
      expiresAt: string;
    }>;
  const data = await res.json();
  return data.invites as Array<{
    token: string;
    email: string;
    createdAt: string;
    expiresAt: string;
  }>;
}

async function sendInvite(formData: FormData) {
  "use server";
  await requireAdmin();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email) return;
  await fetch("/api/invite", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: { "content-type": "application/json" },
  });
}

async function revokeInvite(formData: FormData) {
  "use server";
  await requireAdmin();
  const token = String(formData.get("token") || "");
  if (!token) return;
  await fetch("/api/invite", {
    method: "DELETE",
    body: JSON.stringify({ token }),
    headers: { "content-type": "application/json" },
  });
}

export default async function AdminInvitesPage() {
  await requireAdmin();
  const invites = await getInvites();
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Invitații</h1>
      <form action={sendInvite} className="flex gap-2 mb-4 max-w-xl">
        <input
          className="flex-1"
          name="email"
          type="email"
          placeholder="email@exemplu.com"
          required
        />
        <button className="rounded-md bg-foreground text-background px-3 py-2 text-sm font-semibold">
          Trimite invitație
        </button>
      </form>
      <div className="overflow-x-auto">
        <table className="min-w-[600px] w-full text-sm">
          <thead>
            <tr className="text-left border-b border-foreground/10">
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Creat</th>
              <th className="py-2 pr-3">Expiră</th>
              <th className="py-2 pr-3">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.token} className="border-b border-foreground/5">
                <td className="py-2 pr-3">{inv.email}</td>
                <td className="py-2 pr-3">
                  {new Date(inv.createdAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3">
                  {new Date(inv.expiresAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3 flex gap-2">
                  <form action={sendInvite}>
                    <input type="hidden" name="email" value={inv.email} />
                    <button className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5">
                      Retrimite
                    </button>
                  </form>
                  <form action={revokeInvite}>
                    <input type="hidden" name="token" value={inv.token} />
                    <button className="rounded-md border border-foreground/20 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                      Revocă
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr>
                <td className="py-4 text-foreground/60" colSpan={4}>
                  Nu există invitații active.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
