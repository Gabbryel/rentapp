import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import type { User } from "@/lib/schemas/user";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Temporarily allow public access; we'll reintroduce restrictions later.
  const user = await currentUser();
  const users: User[] = await listUsers();
  const fmt = (d: Date | string) => new Date(d).toLocaleString("ro-RO");

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin"
          className="text-sm text-foreground/70 hover:underline"
        >
          ← Înapoi la Admin
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Utilizatori</h1>
      </div>
      <p className="text-foreground/70">Autentificat ca {user?.email}</p>

      <div className="mt-6 rounded-lg border border-foreground/15 p-4 overflow-x-auto">
        <table className="mt-1 w-full text-sm">
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
    </main>
  );
}
