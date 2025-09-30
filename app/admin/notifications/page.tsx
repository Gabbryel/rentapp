import { currentUser, requireAdmin } from "@/lib/auth";
import {
  getNotificationSettings,
  saveNotificationSettings,
} from "@/lib/notifications";
import type { NotificationSettings } from "@/lib/schemas/notification-settings";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  await requireAdmin();
  const user = await currentUser();
  const email = user?.email || "";
  const settings = await getNotificationSettings(email);

  async function action(formData: FormData) {
    "use server";
    const user = await currentUser();
    if (!user) throw new Error("Unauthorized");
    const email = user.email;
    const next = {
      userEmail: email,
      onChanges: Boolean(formData.get("onChanges")),
      onNewContracts: Boolean(formData.get("onNewContracts")),
      onNewInvoices: Boolean(formData.get("onNewInvoices")),
      indexingNext60: Boolean(formData.get("indexingNext60")),
      indexingNext15: Boolean(formData.get("indexingNext15")),
      indexingNext1: Boolean(formData.get("indexingNext1")),
      updatedAt: new Date(),
    };
    await saveNotificationSettings(next as NotificationSettings);
    try {
      await logAction({
        action: "settings.notifications.update",
        targetType: "user",
        targetId: email,
        meta: { ...next },
      });
    } catch {}
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-fluid-3xl font-semibold tracking-tight mb-6">
          Notificări
        </h1>
        <form
          action={action}
          className="space-y-5 rounded-xl border border-foreground/10 bg-foreground/5 p-5"
        >
          <div className="text-xs text-foreground/60">
            Ultima actualizare:{" "}
            {settings.updatedAt
              ? new Date(settings.updatedAt).toLocaleString("ro-RO")
              : "—"}
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm uppercase tracking-wide text-foreground/60 mb-2">
              Evenimente
            </legend>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="onChanges"
                defaultChecked={settings.onChanges}
              />
              <span>Modificări la contracte/parteneri</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="onNewContracts"
                defaultChecked={settings.onNewContracts}
              />
              <span>Contracte noi</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="onNewInvoices"
                defaultChecked={settings.onNewInvoices}
              />
              <span>Facturi noi</span>
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm uppercase tracking-wide text-foreground/60 mb-2">
              Indexări ce urmează
            </legend>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="indexingNext60"
                defaultChecked={settings.indexingNext60}
              />
              <span>În următoarele 60 de zile</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="indexingNext15"
                defaultChecked={settings.indexingNext15}
              />
              <span>În următoarele 15 zile</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="indexingNext1"
                defaultChecked={settings.indexingNext1}
              />
              <span>A doua zi</span>
            </label>
          </fieldset>

          <button
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold hover:bg-foreground/5"
            formAction={async (fd: FormData) => {
              "use server";
              await action(fd);
            }}
          >
            Salvează
          </button>
          <div aria-live="polite" className="sr-only">
            Setările au fost salvate
          </div>
        </form>
      </div>
    </main>
  );
}
