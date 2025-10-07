import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import type { User } from "@/lib/schemas/user";
import CardsGrid from "@/app/components/ui/cards-grid";
import Card from "@/app/components/ui/card";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
              <div className="flex items-center gap-2">
                <form
                  data-confirm={
                    u.isAdmin
                      ? `Sigur revoci drepturile de admin pentru ${u.email}?`
                      : `Acordă drepturi de admin pentru ${u.email}?`
                  }
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
                    revalidatePath("/admin/users");
                    redirect(
                      `/admin/users#toast=${encodeURIComponent(
                        makeAdmin
                          ? `Drepturi admin acordate pentru ${email}`
                          : `Drepturi admin revocate pentru ${email}`
                      )}`
                    );
                  }}
                >
                  <input type="hidden" name="email" value={u.email} />
                  <input
                    type="hidden"
                    name="makeAdmin"
                    value={u.isAdmin ? "false" : "true"}
                  />
                  <button
                    className="p-1.5 text-xs inline-flex items-center justify-center rounded text-foreground/80 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                    title={
                      u.isAdmin
                        ? "Revocă drepturile de admin"
                        : "Acordă drepturi de admin"
                    }
                    aria-label={
                      u.isAdmin
                        ? "Revocă drepturile de admin"
                        : "Acordă drepturi de admin"
                    }
                  >
                    {u.isAdmin ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                        <path d="M9 12h6" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                        <path d="M12 8v8" />
                        <path d="M8 12h8" />
                      </svg>
                    )}
                  </button>
                </form>
                <form
                  data-confirm={`Sigur ștergi utilizatorul ${u.email}? Acțiunea este ireversibilă.`}
                  className="inline-block"
                  action={async (fd: FormData) => {
                    "use server";
                    const email = String(fd.get("email") || "");
                    const { deleteUser } = await import("@/lib/users");
                    await deleteUser(email);
                    const { logAction } = await import("@/lib/audit");
                    await logAction({
                      action: "user.delete",
                      targetType: "user",
                      targetId: email,
                      meta: {},
                    });
                    revalidatePath("/admin/users");
                    redirect(
                      `/admin/users#toast=${encodeURIComponent(
                        `Utilizator șters: ${email}`
                      )}`
                    );
                  }}
                >
                  <input type="hidden" name="email" value={u.email} />
                  <button
                    className="p-1.5 text-xs inline-flex items-center justify-center rounded text-red-600 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
                    title="Șterge utilizator"
                    aria-label="Șterge utilizator"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </form>
              </div>
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
                  <div className="flex items-center gap-2">
                    <form
                      data-confirm={
                        u.isAdmin
                          ? `Sigur revoci drepturile de admin pentru ${u.email}?`
                          : `Acordă drepturi de admin pentru ${u.email}?`
                      }
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
                        revalidatePath("/admin/users");
                        redirect(
                          `/admin/users#toast=${encodeURIComponent(
                            makeAdmin
                              ? `Drepturi admin acordate pentru ${email}`
                              : `Drepturi admin revocate pentru ${email}`
                          )}`
                        );
                      }}
                    >
                      <input type="hidden" name="email" value={u.email} />
                      <input
                        type="hidden"
                        name="makeAdmin"
                        value={u.isAdmin ? "false" : "true"}
                      />
                      <button
                        className="p-1.5 text-xs inline-flex items-center justify-center rounded text-foreground/80 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                        title={
                          u.isAdmin
                            ? "Revocă drepturile de admin"
                            : "Acordă drepturi de admin"
                        }
                        aria-label={
                          u.isAdmin
                            ? "Revocă drepturile de admin"
                            : "Acordă drepturi de admin"
                        }
                      >
                        {u.isAdmin ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                            <path d="M9 12h6" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                            <path d="M12 8v8" />
                            <path d="M8 12h8" />
                          </svg>
                        )}
                      </button>
                    </form>
                    <form
                      data-confirm={`Sigur ștergi utilizatorul ${u.email}? Acțiunea este ireversibilă.`}
                      className="inline-block"
                      action={async (fd: FormData) => {
                        "use server";
                        const email = String(fd.get("email") || "");
                        const { deleteUser } = await import("@/lib/users");
                        await deleteUser(email);
                        const { logAction } = await import("@/lib/audit");
                        await logAction({
                          action: "user.delete",
                          targetType: "user",
                          targetId: email,
                          meta: {},
                        });
                        revalidatePath("/admin/users");
                        redirect(
                          `/admin/users#toast=${encodeURIComponent(
                            `Utilizator șters: ${email}`
                          )}`
                        );
                      }}
                    >
                      <input type="hidden" name="email" value={u.email} />
                      <button
                        className="p-1.5 text-xs inline-flex items-center justify-center rounded text-red-600 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
                        title="Șterge utilizator"
                        aria-label="Șterge utilizator"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Client script to convert hash #toast=... into a one-time toast event */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(() => {
  // Extract toast from URL hash
  try {
    const h = window.location.hash;
    if (h.startsWith('#toast=')) {
      const msg = decodeURIComponent(h.slice(7));
      if (msg) {
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: msg } }));
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  } catch (e) {}

  // Bind custom confirmation modal
  try {
    if (!window.__usersConfirmBound) {
      window.__usersConfirmBound = true;
      const showConfirm = function (message, onConfirm) {
        if (document.getElementById('confirm-modal-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'confirm-modal-overlay';
        overlay.className = 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4';
        const safe = String(message).replace(/</g, '&lt;');
        overlay.innerHTML = '<div role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" class="w-full max-w-sm rounded-lg border border-foreground/20 bg-background shadow-xl animate-in fade-in zoom-in duration-150"><div class="p-4 sm:p-5"><h2 id="confirm-modal-title" class="text-sm font-medium text-foreground mb-3">Confirmare</h2><p class="text-sm text-foreground/80 whitespace-pre-line">' + safe + '</p><div class="mt-6 flex items-center justify-end gap-2"><button data-role="cancel" class="text-sm px-3 py-1.5 rounded border border-foreground/20 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">Anulează</button><button data-role="ok" class="text-sm px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50">Confirmă</button></div></div></div>';
        document.body.appendChild(overlay);
        const okBtn = overlay.querySelector('button[data-role="ok"]');
        const cancelBtn = overlay.querySelector('button[data-role="cancel"]');
        const cleanup = () => { overlay.remove(); };
        cancelBtn && cancelBtn.addEventListener('click', () => cleanup());
        okBtn && okBtn.addEventListener('click', () => { cleanup(); onConfirm(); });
        const escHandler = (ev) => { if (ev.key === 'Escape') { cleanup(); document.removeEventListener('keydown', escHandler, true); } };
        document.addEventListener('keydown', escHandler, true);
        setTimeout(() => { (okBtn || cancelBtn)?.focus(); }, 10);
      };
      document.addEventListener('submit', (ev) => {
        const f = ev.target;
        if (!(f instanceof HTMLFormElement)) return;
        if (f.dataset.confirmed === '1') return;
        const msg = f.getAttribute('data-confirm');
        if (!msg) return;
        ev.preventDefault();
        ev.stopPropagation();
        showConfirm(msg, () => {
          f.dataset.confirmed = '1';
          f.submit();
          setTimeout(() => { delete f.dataset.confirmed; }, 1000);
        });
      }, true);
    }
  } catch (e) {}
})();`,
        }}
      />
    </main>
  );
}
