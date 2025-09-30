import { fetchContracts } from "@/lib/contracts";
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

export async function notifyIndexations(range: 1 | 15 | 60) {
  const contracts = await fetchContracts();
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + range);
  function isWithin(iso?: string | null) {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= start && d <= end;
  }
  const due = contracts.filter((c) => (c.indexingDates || []).some((d) => isWithin(d || undefined)));
  if (due.length === 0) return { sent: 0 };
  let prefFilter: (s: Awaited<ReturnType<typeof getNotificationSettings>>) => boolean;
  if (range === 60) prefFilter = (s) => s.indexingNext60;
  else if (range === 15) prefFilter = (s) => s.indexingNext15;
  else prefFilter = (s) => s.indexingNext1;
  const to = await recipientsByPref(prefFilter);
  if (to.length === 0) return { sent: 0 };
  const subject = `Indexări chirie în următoarele ${range} zile (${due.length})`;
  const lines = due
    .map((c) => `- ${c.name} (${c.partner}) -> ${(c.indexingDates || []).filter((d) => isWithin(d || undefined)).join(", ")}`)
    .join("\n");
  await deliverAllChannels(subject, `Contracte cu indexare:\n${lines}`, to);
  return { sent: to.length };
}

export async function notifyContractCreated(c: Contract) {
  const to = await recipientsByPref((s) => s.onNewContracts);
  if (to.length === 0) return;
  const subject = `Contract nou: ${c.name}`;
  const text = `Partener: ${c.partner}\nÎnceput: ${c.startDate}\nExpiră: ${c.endDate}`;
  await deliverAllChannels(subject, text, to);
}

export async function notifyContractUpdated(c: Contract) {
  const to = await recipientsByPref((s) => s.onChanges);
  if (to.length === 0) return;
  const subject = `Contract actualizat: ${c.name}`;
  const text = `Partener: ${c.partner}\nÎnceput: ${c.startDate}\nExpiră: ${c.endDate}`;
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
