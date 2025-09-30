import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import type { User } from "@/lib/schemas/user";
import CardsGrid from "@/app/components/ui/cards-grid";
import Card from "@/app/components/ui/card";

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
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
          Utilizatori
        </h1>
      </div>
      <p className="text-foreground/70">Autentificat ca {user?.email}</p>

      {/* Cards (show up to <2xl) */}
      <CardsGrid className="mt-6 2xl:hidden">
        {users.map((u) => (
          <Card key={u.email}>
            <div className="flex items-start justify-between gap-3">
              <Link
                className="font-semibold hover:underline truncate"
                href={`/admin/users/${encodeURIComponent(u.email)}`}
              >
                {u.email}
              </Link>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-[11px] border ${
                  u.isAdmin
                    ? "border-emerald-500/30 text-emerald-700"
                    : "border-foreground/20 text-foreground/70"
                }`}
              >
                {u.isAdmin ? "Admin" : "Utilizator"}
              </span>
            </div>
            <div className="text-xs text-foreground/60">
              Creat:{" "}
              <span className="text-foreground/80">{fmt(u.createdAt)}</span>
            </div>
            <div className="pt-1">
              <form
                className="inline-block"
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
                <button className="rounded border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5">
                  {u.isAdmin ? "Revocă admin" : "Fă admin"}
                </button>
              </form>
            </div>
          </Card>
        ))}
      </CardsGrid>

      {/* Desktop table (2xl and up) */}
      <div className="mt-6 rounded-lg border border-foreground/15 p-4 overflow-x-auto hidden 2xl:block">
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
              <tr key={u.email} className="border-top border-foreground/10">
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
