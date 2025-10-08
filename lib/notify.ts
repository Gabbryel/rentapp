import { effectiveEndDate, fetchContracts } from "@/lib/contracts";
import { listUsers } from "@/lib/users";
import { getNotificationSettings } from "@/lib/notifications";
import { deliverAllChannels } from "@/lib/notify-delivery";
import type { Contract } from "@/lib/schemas/contract";

async function recipientsByPref(filter: (s: Awaited<ReturnType<typeof getNotificationSettings>>) => boolean) {
  const users = await listUsers();
  const result: string[] = [];
  for (const u of users) {
    const s = await getNotificationSettings(u.email);
    if (filter(s)) result.push(u.email);
  }
  return result;
}

// notifyIndexations removed (indexing feature deprecated)

export async function notifyContractCreated(c: Contract) {
  const to = await recipientsByPref((s) => s.onNewContracts);
  if (to.length === 0) return;
  const subject = `Contract nou: ${c.name}`;
  const text = `Partener: ${c.partner}\nÎnceput: ${c.startDate}\nExpiră: ${effectiveEndDate(c)}`;
  await deliverAllChannels(subject, text, to);
}

export async function notifyContractUpdated(c: Contract) {
  const to = await recipientsByPref((s) => s.onChanges);
  if (to.length === 0) return;
  const subject = `Contract actualizat: ${c.name}`;
  const text = `Partener: ${c.partner}\nÎnceput: ${c.startDate}\nExpiră: ${effectiveEndDate(c)}`;
  await deliverAllChannels(subject, text, to);
}

export async function notifyContractDeleted(c: Pick<Contract, "id" | "name" | "partner">) {
  const to = await recipientsByPref((s) => s.onChanges);
  if (to.length === 0) return;
  const subject = `Contract șters: ${c.name}`;
  const text = `Partener: ${c.partner}`;
  await deliverAllChannels(subject, text, to);
}

// Placeholder for invoices; call when invoice creation exists
export type InvoiceLike = { id: string; contractId?: string; partner?: string; amountEUR?: number; date?: string };
export async function notifyInvoiceCreated(inv: InvoiceLike) {
  const to = await recipientsByPref((s) => s.onNewInvoices);
  if (to.length === 0) return;
  const subject = `Factură nouă${inv.partner ? ` – ${inv.partner}` : ""}`;
  const text = `Sumă: ${inv.amountEUR ?? "?"} EUR${inv.date ? `\nData: ${inv.date}` : ""}`;
  await deliverAllChannels(subject, text, to);
}
