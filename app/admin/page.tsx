import { currentUser } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import type { User } from "@/lib/schemas/user";
import { redirect } from "next/navigation";
import Link from "next/link";

function envIsAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (admins.length === 0) return false;
  return email ? admins.includes(email) : false;
}

// (helpers removed; global audit feed moved to /admin/users/[email])

export default async function AdminPage() {
  // Temporarily allow public access; we'll reintroduce restrictions later.
  const user = await currentUser();
  const users: User[] = await listUsers();
  const fmt = (d: Date | string) => new Date(d).toLocaleString("ro-RO");

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold">
        Admin - Utilizatori & Acțiuni
      </h1>
      <p className="text-foreground/70 mt-1">Autentificat ca {user?.email}</p>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-foreground/15 p-4 overflow-x-auto">
          <h2 className="text-sm font-semibold">Utilizatori</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-foreground/60">
              <tr>
                <th className="text-left font-medium">Email</th>
                <th className="text-left font-medium">Creat</th>
                <th className="text-left font-medium">Admin</th>
                <th className="text-left font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} className="border-t border-foreground/10">
                  <td className="py-2">
                    <Link
                      className="text-foreground hover:underline"
                      href={`/admin/users/${encodeURIComponent(u.email)}`}
                    >
                      {u.email}
                    </Link>
                  </td>
                  <td className="py-2">{fmt(u.createdAt)}</td>
                  <td className="py-2">{u.isAdmin ? "Da" : "Nu"}</td>
                  <td className="py-2">
                    <form
                      action={async (fd: FormData) => {
                        "use server";
                        const email = String(fd.get("email") || "");
                        const makeAdmin =
                          String(fd.get("makeAdmin") || "false") === "true";
                        const { setAdmin } = await import("@/lib/users");
                        await setAdmin(email, makeAdmin);
                        const { logAction } = await import("@/lib/audit");
                        await logAction({
                          action: "user.setAdmin",
                          targetType: "user",
                          targetId: email,
                          meta: { isAdmin: makeAdmin },
                        });
                      }}
                    >
                      <input type="hidden" name="email" value={u.email} />
                      <input
                        type="hidden"
                        name="makeAdmin"
                        value={u.isAdmin ? "false" : "true"}
                      />
                      <button className="rounded border px-2 py-1 text-xs">
                        {u.isAdmin ? "Revocă admin" : "Fă admin"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-user audit now lives under /admin/users/[email]. The global feed was removed. */}
      </section>
    </main>
  );
}
