import { fetchContracts, effectiveEndDate, rentAmountAtDate } from "@/lib/contracts";
// Directly import the client component; Next.js will handle the client/server boundary.
// (Avoid dynamic(... { ssr:false }) in a Server Component – not permitted in Next 15.)
import Link from "next/link";
import StatsCards from "@/app/components/stats-cards";
import ActionButton from "@/app/components/action-button";
import { revalidatePath } from "next/cache";
import {
  computeInvoiceFromContract,
  issueInvoiceAndGeneratePdf,
  listInvoicesForMonth,
  deleteInvoiceById,
  invalidateYearInvoicesCache,
} from "@/lib/invoices";
import { computeNextMonthProration } from "@/lib/advance-billing";
import ConfirmSubmit from "@/app/components/confirm-submit";

// The client component itself contains its own loading skeletons.

function fmt(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    return d.toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateIso;
  }
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }).format(
    n
  );
const fmtRON = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(
    n
  );

export default async function HomePage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const contracts = await fetchContracts();

  // Invoices issued this month (for duplication prevention only)
  const issuedThisMonth = await listInvoicesForMonth(year, month);
  const issuedKey = (i: any) => `${i.contractId}|${i.issuedAt}|${i.partnerId || i.partner || ''}`;
  const issuedByKey = new Set(issuedThisMonth.map((i) => issuedKey(i)));
  const issuedInvoiceMap = new Map(
    issuedThisMonth.map((i) => [issuedKey(i), i])
  );

  // Build list of due invoices (contract occurrences expected this month & not yet issued)
  const due: {
    contract: any;
    issuedAt: string; // yyyy-mm-dd
    amountEUR?: number;
  }[] = [];

  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const monthDays = daysInMonth(year, month);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, monthDays);

  for (const c of contracts) {
    if (!c.startDate) continue;
    const start = new Date(c.startDate);
    const end = new Date(effectiveEndDate(c));
    // Skip if contract not active during this month window
    if (end < monthStart || start > monthEnd) continue;

    if (c.rentType === "monthly") {
      // Determine if this contract uses advance (next month) billing
      const mode = (c as any).invoiceMonthMode === "next" ? "next" : "current";
      // Determine the invoice day for this month: use monthlyInvoiceDay, else fallback to startDate day
      const baseDay =
        typeof c.monthlyInvoiceDay === "number"
          ? c.monthlyInvoiceDay
          : new Date(c.startDate).getDate();
      const day = Math.min(Math.max(1, baseDay), monthDays);
      const issuedAt = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const issuedDate = new Date(issuedAt);
      // Ensure the invoice day itself lies within contract active range (for first/last months) *for current-mode billing*
      // For next-mode we only require contract active at some point this current month (already ensured above) and active in the next month window.
      if (mode === "current" && (issuedDate < start || issuedDate > end))
        continue;

      let amountEUROverride: number | undefined = undefined;
      if (mode === "next") {
        // Apply stricter advance billing rules with potential proration.
        const { include, fraction } = computeNextMonthProration(c, year, month);
        if (!include) {
          continue; // suppressed by rules (no overlap, ends day 1/2, etc.)
        }
        // Use next month base even when fraction === 1 to have a concrete override
        const nextMonthDate = new Date(year, month, 1);
        const nextIso = nextMonthDate.toISOString().slice(0, 10);
        const base = rentAmountAtDate(c as any, nextIso);
        if (typeof base === "number") {
          amountEUROverride = base * (typeof fraction === "number" && fraction > 0 ? fraction : 1);
        }
      } else {
        // For current-mode, precompute the base amount for this issued date
        const base = rentAmountAtDate(c as any, issuedAt);
        if (typeof base === "number") {
          amountEUROverride = base;
        }
      }

      const partners: Array<{ id?: string; name: string; sharePercent?: number }> = Array.isArray((c as any).partners)
        ? (((c as any).partners as any[]).map((p) => ({ id: p?.id, name: p?.name, sharePercent: typeof p?.sharePercent === 'number' ? p.sharePercent : undefined })))
        : [];
      const sumShares = partners.reduce((s, p) => s + (typeof p.sharePercent === 'number' ? p.sharePercent : 0), 0);
      if (partners.length > 1 && sumShares > 0) {
        for (const p of partners) {
          const share = typeof p.sharePercent === 'number' ? p.sharePercent / 100 : 0;
          if (share <= 0) continue;
          const partAmount = typeof amountEUROverride === 'number' ? amountEUROverride * share : undefined;
          due.push({ contract: c, issuedAt, amountEUR: partAmount, ...(p.id ? { partnerId: p.id } : {}), partnerName: p.name, sharePercent: p.sharePercent } as any);
        }
      } else {
        // Attach primary partner info so issued-key matching works for single-partner contracts
        const extra: any = {};
        if ((c as any).partnerId) extra.partnerId = (c as any).partnerId;
        if (c.partner) extra.partnerName = c.partner;
        due.push({ contract: c, issuedAt, amountEUR: amountEUROverride, ...extra } as any);
      }
    } else if (c.rentType === "yearly") {
      const entries = (c as any).irregularInvoices as
        | { month: number; day: number; amountEUR: number }[]
        | undefined;
      if (!entries) continue;
      for (const yi of entries) {
        if (yi.month !== month) continue;
        const day = Math.min(Math.max(1, yi.day), monthDays);
        const issuedAt = `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const issuedDate = new Date(issuedAt);
        if (issuedDate < start || issuedDate > end) continue;
        const partners: Array<{ id?: string; name: string; sharePercent?: number }> = Array.isArray((c as any).partners)
          ? (((c as any).partners as any[]).map((p) => ({ id: p?.id, name: p?.name, sharePercent: typeof p?.sharePercent === 'number' ? p.sharePercent : undefined })))
          : [];
        const sumShares = partners.reduce((s, p) => s + (typeof p.sharePercent === 'number' ? p.sharePercent : 0), 0);
        if (partners.length > 1 && sumShares > 0) {
          for (const p of partners) {
            const share = typeof p.sharePercent === 'number' ? p.sharePercent / 100 : 0;
            if (share <= 0) continue;
            due.push({ contract: c, issuedAt, amountEUR: yi.amountEUR * share, ...(p.id ? { partnerId: p.id } : {}), partnerName: p.name, sharePercent: p.sharePercent } as any);
          }
        } else {
          due.push({ contract: c, issuedAt, amountEUR: yi.amountEUR });
        }
      }
    }
  }

  async function issueDue(formData: FormData) {
    "use server";
    try {
      const contractId = String(formData.get("contractId"));
      const issuedAt = String(formData.get("issuedAt"));
      const amountEURRaw = formData.get("amountEUR");
      const amountOverride =
        typeof amountEURRaw === "string" ? Number(amountEURRaw) : undefined;
      const contract = contracts.find((c) => c.id === contractId);
      if (!contract) return;
      const partners: Array<{ id?: string; name: string; sharePercent?: number }> = Array.isArray((contract as any).partners)
        ? (((contract as any).partners as any[]).map((p) => ({ id: p?.id, name: p?.name, sharePercent: typeof p?.sharePercent === 'number' ? p.sharePercent : undefined })))
        : [];
      const sumShares = partners.reduce((s, p) => s + (typeof p.sharePercent === 'number' ? p.sharePercent : 0), 0);
      if (partners.length > 1 && sumShares > 0) {
        // Multi-partner issuance: compute full base EUR for this period, then split by shares
        let baseEUR: number | undefined;
        try {
          const y = Number(issuedAt.slice(0, 4));
          const m = Number(issuedAt.slice(5, 7));
          const mode = (contract as any).invoiceMonthMode === "next" ? "next" : "current";
          if (mode === "next") {
            const { include, fraction } = computeNextMonthProration(contract as any, y, m);
            if (!include) return; // suppressed by rules
            const nextMonthDate = new Date(y, m, 1);
            const nextIso = nextMonthDate.toISOString().slice(0, 10);
            const base = rentAmountAtDate(contract as any, nextIso);
            if (typeof base === 'number') baseEUR = base * (typeof fraction === 'number' && fraction > 0 ? fraction : 1);
          } else {
            baseEUR = rentAmountAtDate(contract as any, issuedAt);
          }
        } catch {}
        if (!(typeof baseEUR === 'number' && isFinite(baseEUR) && baseEUR > 0)) {
          // Fallback to computed invoice if needed
          const baseInv = computeInvoiceFromContract({ contract, issuedAt });
          baseEUR = baseInv.amountEUR;
        }
        for (const p of partners) {
          const share = typeof p.sharePercent === 'number' ? p.sharePercent / 100 : 0;
          if (share <= 0) continue;
          const invPart = computeInvoiceFromContract({ contract, issuedAt, amountEUROverride: (baseEUR as number) * share });
          const patched = { ...invPart, partner: p.name, partnerId: p.id || p.name } as any;
          await issueInvoiceAndGeneratePdf(patched);
        }
      } else {
        const inv = computeInvoiceFromContract({
          contract,
          issuedAt,
          amountEUROverride: amountOverride,
        });
        await issueInvoiceAndGeneratePdf(inv);
      }
      try {
        invalidateYearInvoicesCache();
      } catch {}
    } catch {}
    revalidatePath("/");
  }

  async function deleteIssued(formData: FormData) {
    "use server";
    try {
      const contractId = String(formData.get("contractId"));
      const issuedAt = String(formData.get("issuedAt"));
      // Locate all partner invoices for this contract/date (in this month)
      const y = Number(issuedAt.slice(0, 4));
      const m = Number(issuedAt.slice(5, 7));
      const monthInvs = await listInvoicesForMonth(y, m);
      const all = monthInvs.filter((it) => it.contractId === contractId && it.issuedAt === issuedAt);
      for (const inv of all) {
        await deleteInvoiceById(inv.id);
      }
      try {
        invalidateYearInvoicesCache();
      } catch {}
    } catch {}
    revalidatePath("/");
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-screen-2xl">
        <section id="statistics" className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">
            Statistici pe proprietar
          </h2>
          {(() => {
            const ownerMap = new Map<string, { id?: string; name: string }>();
            for (const c of contracts) {
              const name = String((c as any).owner || "").trim() || "—";
              const id = (c as any).ownerId
                ? String((c as any).ownerId)
                : undefined;
              const key = id || name;
              if (!ownerMap.has(key)) ownerMap.set(key, { id, name });
            }
            const owners = Array.from(ownerMap.values()).sort((a, b) =>
              a.name.localeCompare(b.name)
            );
            if (owners.length === 0) {
              return (
                <div className="rounded-xl border border-foreground/10 bg-background/60 p-6 text-center text-foreground/60">
                  Nu există contracte pentru a calcula statistici.
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 gap-4">
                {owners.map((o) => (
                  <div
                    key={o.id || o.name}
                    className="rounded-xl border border-foreground/10 bg-background/70 p-4"
                  >
                    <div className="mb-3 text-sm font-semibold" title={o.name}>
                      <Link
                        href={`/owners/${encodeURIComponent(o.id || o.name)}`}
                        className="hover:underline"
                      >
                        {o.name}
                      </Link>
                    </div>
                    <StatsCards owner={o.name} ownerId={o.id} />
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
        <h1 className="text-fluid-4xl font-semibold tracking-tight mb-8">
          Facturi de emis luna aceasta
        </h1>
        {(() => {
          if (due.length === 0) return null;
          const groups = new Map<string, typeof due>();
          for (const d of due) {
            const owner = (d.contract as any).owner || "—";
            const arr = groups.get(owner) || [];
            arr.push(d);
            groups.set(owner, arr);
          }
          const owners = Array.from(groups.keys()).sort((a, b) =>
            a.localeCompare(b)
          );
          return owners.map((owner) => (
            <section
              key={owner}
              className="mb-8 rounded-xl border border-foreground/10 bg-background/70 p-5"
            >
              <h2 className="text-lg font-semibold mb-3">
                <Link
                  href={`/owners/${encodeURIComponent(owner)}`}
                  className="hover:underline"
                >
                  {owner}
                </Link>
              </h2>
              <ul id="invoices-list-home-page" className="space-y-4">
                {groups
                  .get(owner)!
                  .slice()
                  .sort((a, b) => {
                    const day = (s: string) => {
                      const dd = Number(s?.slice(8, 10));
                      return Number.isInteger(dd) ? dd : new Date(s).getDate() || 0;
                    };
                    const pa = ((a as any).partnerName || (a.contract as any).partner || "").toString();
                    const pb = ((b as any).partnerName || (b.contract as any).partner || "").toString();
                    const dA = day(a.issuedAt);
                    const dB = day(b.issuedAt);
                    if (dA !== dB) return dA - dB;
                    return pa.localeCompare(pb, "ro-RO", { sensitivity: "base" });
                  })
                  .map((d) => {
                    const partnerKey =
                      (d as any).partnerId ||
                      (d as any).partnerName ||
                      d.contract.partnerId ||
                      d.contract.partner ||
                      '';
                    const key = `${d.contract.id}|${d.issuedAt}|${partnerKey}`;
                    const already = issuedByKey.has(key);
                    const amtEUR =
                      typeof d.amountEUR === "number"
                        ? d.amountEUR
                        : rentAmountAtDate(d.contract as any, d.issuedAt);
                    const rate =
                      typeof d.contract.exchangeRateRON === "number"
                        ? d.contract.exchangeRateRON
                        : undefined;
                    const corrPct =
                      typeof d.contract.correctionPercent === "number"
                        ? d.contract.correctionPercent
                        : 0;
                    const tvaPct =
                      typeof d.contract.tvaPercent === "number"
                        ? d.contract.tvaPercent
                        : 0;
                    const correctedEUR =
                      typeof amtEUR === "number"
                        ? amtEUR * (1 + corrPct / 100)
                        : undefined;
                    const netRON =
                      typeof correctedEUR === "number" &&
                      typeof rate === "number"
                        ? correctedEUR * rate
                        : undefined;
                    const vatRON =
                      typeof netRON === "number"
                        ? netRON * (tvaPct / 100)
                        : undefined;
                    const totalRON =
                      typeof netRON === "number"
                        ? netRON + (vatRON ?? 0)
                        : undefined;
                    const partners: Array<{ id?: string; name: string; sharePercent?: number }> = Array.isArray((d.contract as any).partners)
                      ? ((((d.contract as any).partners as any[]) as Array<{ id?: string; name: string; sharePercent?: number }>))
                      : [];
                    const sumShares = partners.reduce((s, p) => s + (typeof p.sharePercent === 'number' ? p.sharePercent : 0), 0);
                    const partnerCount = partners.filter(p => typeof p?.name === 'string' && p.name.trim()).length;

                    const liBase =
                      "group rounded-lg border transition-colors shadow-sm p-4";
                    const liClass = already
                      ? `${liBase} border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20`
                      : `${liBase} border-foreground/10 bg-background/60 hover:bg-background/70`;
                    return (
                      <li key={key} className={liClass}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center rounded-md bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-foreground/60 border border-foreground/10">
                                <Link
                                  href={`/partners/${(d as any).partnerId || d.contract.partnerId || encodeURIComponent((d as any).partnerName || d.contract.partner)}`}
                                  className="hover:underline decoration-amber-200 decoration-dotted underline-offset-4"
                                >
                                  {(d as any).partnerName || d.contract.partner}
                                </Link>
                              </span>
                              <Link
                                href={`/contracts/${d.contract.id}`}
                                className="hover:underline decoration-amber-200 decoration-dotted underline-offset-4"
                              >
                                <h3 className="text-sm font-semibold tracking-tight leading-tight">
                                  {d.contract.name}
                                </h3>
                              </Link>

                              {(d.contract as any).invoiceMonthMode ===
                                "next" && d.contract.rentType === "monthly" ? (
                                <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  În avans
                                </span>
                              ) : null}
                              <span className="text-[11px] text-foreground/50">
                                {fmt(d.issuedAt)}
                              </span>
                              {corrPct ? (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                  +{corrPct}%
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground/50">
                              <span>
                                Curs:{" "}
                                {typeof rate === "number"
                                  ? `${rate.toFixed(4)} RON/EUR`
                                  : "–"}
                              </span>
                              <span>TVA: {tvaPct ? `${tvaPct}%` : "0%"}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {already ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400"
                                title={`Factura emisă (#${
                                  issuedInvoiceMap.get(key)?.number ||
                                  issuedInvoiceMap.get(key)?.id ||
                                  "–"
                                })`}
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M9 12l2 2 4-4" />
                                  <circle cx="12" cy="12" r="9" />
                                </svg>
                                Emisă
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[12px] font-medium text-amber-600 dark:text-amber-400">
                                În așteptare
                              </span>
                            )}
                            {already ? (
                              <form
                                action={deleteIssued}
                                className="flex items-center"
                              >
                                <input
                                  type="hidden"
                                  name="contractId"
                                  value={d.contract.id}
                                />
                                <input
                                  type="hidden"
                                  name="issuedAt"
                                  value={d.issuedAt}
                                />
                                {(d as any).partnerId ? (
                                  <input type="hidden" name="partnerId" value={(d as any).partnerId} />
                                ) : (d as any).partnerName ? (
                                  <input type="hidden" name="partnerName" value={(d as any).partnerName} />
                                ) : null}
                                <ConfirmSubmit
                                  className="rounded-md border px-2.5 py-1.5 text-sm font-medium flex items-center justify-center border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                                  title="Șterge factura emisă"
                                  successMessage="Factura a fost ștearsă"
                                  confirmMessage="Sigur dorești să ștergi această factură emisă?"
                                  triggerStatsRefresh
                                  data-delta-mode="delete"
                                  data-delta-month-ron={
                                    typeof totalRON === "number"
                                      ? String(totalRON)
                                      : undefined
                                  }
                                  data-delta-month-net-ron={
                                    typeof netRON === "number"
                                      ? String(netRON)
                                      : undefined
                                  }
                                  data-delta-month-eur={
                                    typeof correctedEUR === "number"
                                      ? String(correctedEUR)
                                      : undefined
                                  }
                                  data-delta-annual-ron={
                                    typeof totalRON === "number"
                                      ? String(totalRON)
                                      : undefined
                                  }
                                  data-delta-annual-net-ron={
                                    typeof netRON === "number"
                                      ? String(netRON)
                                      : undefined
                                  }
                                  data-delta-annual-eur={
                                    typeof correctedEUR === "number"
                                      ? String(correctedEUR)
                                      : undefined
                                  }
                                >
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                    <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                                  </svg>
                                </ConfirmSubmit>
                              </form>
                            ) : (
                              <form
                                action={issueDue}
                                className="flex items-center"
                              >
                                <input
                                  type="hidden"
                                  name="contractId"
                                  value={d.contract.id}
                                />
                                <input
                                  type="hidden"
                                  name="issuedAt"
                                  value={d.issuedAt}
                                />
                                {(d as any).partnerId ? (
                                  <input type="hidden" name="partnerId" value={(d as any).partnerId} />
                                ) : (d as any).partnerName ? (
                                  <input type="hidden" name="partnerName" value={(d as any).partnerName} />
                                ) : null}
                                {/* Only send override for non-split items; for split/partners we compute base in action */}
                                {(!partnerKey && typeof d.amountEUR === "number") ? (
                                  <input
                                    type="hidden"
                                    name="amountEUR"
                                    value={String(d.amountEUR)}
                                  />
                                ) : null}
                                <ActionButton
                                  className="rounded-md border px-2.5 py-1.5 text-sm font-medium flex items-center justify-center border-foreground/20 hover:bg-foreground/5"
                                  title="Emite factura"
                                  successMessage="Factura a fost emisă"
                                  triggerStatsRefresh
                                  data-delta-mode="issue"
                                  data-delta-month-ron={
                                    typeof totalRON === "number"
                                      ? String(totalRON)
                                      : undefined
                                  }
                                  data-delta-month-net-ron={
                                    typeof netRON === "number"
                                      ? String(netRON)
                                      : undefined
                                  }
                                  data-delta-month-eur={
                                    typeof correctedEUR === "number"
                                      ? String(correctedEUR)
                                      : undefined
                                  }
                                  data-delta-annual-ron={
                                    typeof totalRON === "number"
                                      ? String(totalRON)
                                      : undefined
                                  }
                                  data-delta-annual-net-ron={
                                    typeof netRON === "number"
                                      ? String(netRON)
                                      : undefined
                                  }
                                  data-delta-annual-eur={
                                    typeof correctedEUR === "number"
                                      ? String(correctedEUR)
                                      : undefined
                                  }
                                >
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 5v14" />
                                    <path d="M5 12h14" />
                                    <circle cx="12" cy="12" r="9" />
                                  </svg>
                                </ActionButton>
                              </form>
                            )}
                          </div>
                        </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 text-[15px]">
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              EUR inițial
                            </div>
                            <div className="font-medium text-indigo-700 dark:text-indigo-400">
                              {typeof amtEUR === "number"
                                ? fmtEUR(amtEUR)
                                : "–"}
                        </div>
                        {partnerCount > 1 && !partnerKey && (
                          <div className="sm:col-span-3 md:col-span-4 lg:col-span-5">
                            <div className="text-[12px] text-foreground/60 mb-1">Procentaje parteneri</div>
                            <ul className="text-[12px] text-foreground/70 space-y-0.5">
                              {partners.map((p, idx) => {
                                const hasPct = typeof p.sharePercent === 'number' && isFinite(p.sharePercent);
                                const share = hasPct ? (p.sharePercent as number) / 100 : undefined;
                                const partEUR = typeof share === 'number' && typeof correctedEUR === 'number' ? correctedEUR * share : undefined;
                                const partRON = typeof share === 'number' && typeof totalRON === 'number' ? totalRON * share : undefined;
                                return (
                                  <li key={(p.id || p.name || String(idx))} className="flex items-center gap-2">
                                    <Link href={`/partners/${encodeURIComponent(p.id || p.name || '')}`} className="hover:underline">
                                      {p.name}
                                    </Link>
                                    <span className="text-foreground/50">•</span>
                                    <span>{hasPct ? `${p.sharePercent}%` : '—'}</span>
                                    {hasPct ? (
                                      <>
                                        <span className="text-foreground/50">•</span>
                                        <span>
                                          {typeof partEUR === 'number' ? `${new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR' }).format(partEUR)}` : '—'}
                                          {typeof partRON === 'number' ? ` · ${new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(partRON)}` : ''}
                                        </span>
                                      </>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              EUR corectat{corrPct ? ` (+${corrPct}%)` : ""}
                            </div>
                            <div className="font-medium text-indigo-700 dark:text-indigo-400">
                              {typeof correctedEUR === "number"
                                ? fmtEUR(correctedEUR)
                                : "–"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              Net RON
                            </div>
                            <div className="font-medium text-sky-700 dark:text-sky-400">
                              {typeof netRON === "number"
                                ? fmtRON(netRON)
                                : "–"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              TVA {tvaPct ? `(${tvaPct}%)` : ""}
                            </div>
                            <div className="font-medium text-rose-700 dark:text-rose-400">
                              {typeof vatRON === "number"
                                ? fmtRON(vatRON)
                                : "–"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              Total RON
                            </div>
                            <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {typeof totalRON === "number"
                                ? fmtRON(totalRON)
                                : "–"}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ));
        })()}
      </div>
    </main>
  );
}
