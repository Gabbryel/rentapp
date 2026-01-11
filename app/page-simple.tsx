import { fetchContracts, effectiveEndDate, rentAmountAtDate } from "@/lib/contracts";
import { listInvoicesForMonth } from "@/lib/contracts";
import { getDailyEurRon } from "@/lib/exchange";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

function formatCurrency(amount: number, currency: "EUR" | "RON") {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

function getMonthName(month: number): string {
  const months = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];
  return months[month - 1] || "";
}

export default async function HomePage() {
  const contracts = await fetchContracts();
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Get exchange rate
  const exchangeRate = await getDailyEurRon({ forceRefresh: false });
  const eurRonRate = exchangeRate?.rate || 5.0;

  // Active contracts
  const activeContracts = contracts.filter((c) => {
    const endDate = effectiveEndDate(c);
    return endDate >= today && c.startDate <= today;
  });

  // Contracts expiring soon
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const next60Days = new Date();
  next60Days.setDate(next60Days.getDate() + 60);
  
  const expiringSoon = activeContracts.filter((c) => {
    const endDate = new Date(effectiveEndDate(c));
    return endDate <= next60Days;
  });

  // Monthly revenue calculation
  const monthlyInvoices = await listInvoicesForMonth(currentYear, currentMonth);
  const monthlyRevenueEUR = monthlyInvoices.reduce((sum, inv) => sum + (inv.correctedAmountEUR || inv.amountEUR || 0), 0);
  const monthlyRevenueRON = monthlyInvoices.reduce((sum, inv) => sum + (inv.totalRON || 0), 0);

  // Calculate expected monthly revenue from all active monthly contracts
  const expectedMonthlyEUR = activeContracts
    .filter((c) => c.rentType === "monthly")
    .reduce((sum, c) => {
      const amount = rentAmountAtDate(c, today);
      return sum + (typeof amount === "number" ? amount : 0);
    }, 0);

  // Year-to-date revenue
  let ytdRevenueEUR = 0;
  let ytdRevenueRON = 0;
  for (let m = 1; m <= currentMonth; m++) {
    const monthInvs = await listInvoicesForMonth(currentYear, m);
    ytdRevenueEUR += monthInvs.reduce((sum, inv) => sum + (inv.correctedAmountEUR || inv.amountEUR || 0), 0);
    ytdRevenueRON += monthInvs.reduce((sum, inv) => sum + (inv.totalRON || 0), 0);
  }

  // Contract types breakdown
  const monthlyContracts = activeContracts.filter((c) => c.rentType === "monthly").length;
  const yearlyContracts = activeContracts.filter((c) => c.rentType === "yearly").length;

  // Partner/tenant count
  const uniquePartners = new Set(
    activeContracts.map((c) => c.partner || c.partnerId).filter(Boolean)
  ).size;

  // Owner breakdown
  const ownerMap = new Map<string, { count: number; revenue: number }>();
  for (const c of activeContracts) {
    const owner = c.owner || "Unknown";
    const current = ownerMap.get(owner) || { count: 0, revenue: 0 };
    const amount = rentAmountAtDate(c, today);
    current.count += 1;
    if (typeof amount === "number") {
      current.revenue += c.rentType === "monthly" ? amount : amount / 12; // Normalize yearly to monthly
    }
    ownerMap.set(owner, current);
  }

  // Average rent
  const avgRentEUR = expectedMonthlyEUR / Math.max(monthlyContracts, 1);

  // Indexing upcoming
  const indexingUpcoming = activeContracts.filter((c) => {
    const dates = ((c as any).indexingDates || []) as Array<{ forecastDate: string; done?: boolean }>;
    return dates.some((d) => {
      if (d.done) return false;
      const diffDays = Math.floor((new Date(d.forecastDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 60;
    });
  }).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Hero Stats */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-foreground/60">Privire de ansamblu asupra afacerii tale</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Active Contracts */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground/60">Contracte Active</h3>
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{activeContracts.length}</div>
            <div className="mt-2 text-xs text-foreground/60">
              {monthlyContracts} lunare • {yearlyContracts} anuale
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground/60">Venit Luna Curentă</h3>
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{formatCurrency(monthlyRevenueEUR, "EUR")}</div>
            <div className="mt-2 text-xs text-foreground/60">
              {formatCurrency(monthlyRevenueRON, "RON")} • {monthlyInvoices.length} facturi
            </div>
          </div>

          {/* YTD Revenue */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground/60">Venit An Curent</h3>
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{formatCurrency(ytdRevenueEUR, "EUR")}</div>
            <div className="mt-2 text-xs text-foreground/60">
              {formatCurrency(ytdRevenueRON, "RON")}
            </div>
          </div>

          {/* Expiring Soon */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground/60">Expirări Următoare</h3>
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{expiringSoon.length}</div>
            <div className="mt-2 text-xs text-foreground/60">
              în următoarele 60 zile
            </div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Partners */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <h3 className="text-sm font-medium text-foreground/60 mb-3">Parteneri</h3>
            <div className="text-2xl font-bold mb-1">{uniquePartners}</div>
            <p className="text-xs text-foreground/60">parteneri activi</p>
          </div>

          {/* Average Rent */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <h3 className="text-sm font-medium text-foreground/60 mb-3">Chirie Medie</h3>
            <div className="text-2xl font-bold mb-1">{formatCurrency(avgRentEUR, "EUR")}</div>
            <p className="text-xs text-foreground/60">per contract lunar</p>
          </div>

          {/* Indexing Upcoming */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <h3 className="text-sm font-medium text-foreground/60 mb-3">Indexări Viitoare</h3>
            <div className="text-2xl font-bold mb-1">{indexingUpcoming}</div>
            <p className="text-xs text-foreground/60">în următoarele 60 zile</p>
          </div>
        </div>

        {/* Financial Health */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Revenue Progress */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <h3 className="text-base font-semibold mb-4">Progres Venituri Lunare</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground/60">Realizat</span>
                  <span className="font-medium">{formatCurrency(monthlyRevenueEUR, "EUR")}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-foreground/60">Așteptat</span>
                  <span className="font-medium">{formatCurrency(expectedMonthlyEUR, "EUR")}</span>
                </div>
                <div className="w-full bg-foreground/10 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((monthlyRevenueEUR / expectedMonthlyEUR) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-foreground/60 mt-2">
                  {Math.round((monthlyRevenueEUR / expectedMonthlyEUR) * 100)}% din venitul lunar așteptat
                </p>
              </div>
            </div>
          </div>

          {/* Currency Breakdown */}
          <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
            <h3 className="text-base font-semibold mb-4">Distribuție Valutară</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-foreground/60">EUR</span>
                  <span className="font-medium">{formatCurrency(monthlyRevenueEUR, "EUR")}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-foreground/60">RON</span>
                  <span className="font-medium">{formatCurrency(monthlyRevenueRON, "RON")}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-foreground/10">
                  <span className="text-foreground/60">Curs BNR</span>
                  <span className="font-medium">{eurRonRate.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Owners Breakdown */}
        <div className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm mb-8">
          <h3 className="text-base font-semibold mb-4">Distribuție pe Proprietari</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-foreground/10">
                  <th className="text-left py-3 px-2 text-sm font-medium text-foreground/60">Proprietar</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-foreground/60">Contracte</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-foreground/60">Venit Lunar Est.</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(ownerMap.entries())
                  .sort((a, b) => b[1].revenue - a[1].revenue)
                  .map(([owner, data]) => (
                    <tr key={owner} className="border-b border-foreground/5 hover:bg-foreground/5">
                      <td className="py-3 px-2">
                        <Link href={`/owners/${encodeURIComponent(owner)}`} className="hover:underline font-medium">
                          {owner}
                        </Link>
                      </td>
                      <td className="text-right py-3 px-2 text-foreground/80">{data.count}</td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(data.revenue, "EUR")}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/20 font-bold">
                  <td className="py-3 px-2">Total</td>
                  <td className="text-right py-3 px-2">{activeContracts.length}</td>
                  <td className="text-right py-3 px-2">
                    {formatCurrency(
                      Array.from(ownerMap.values()).reduce((sum, d) => sum + d.revenue, 0),
                      "EUR"
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/invoices/monthly"
            className="rounded-xl border border-foreground/10 bg-background p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <svg className="h-8 w-8 mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="font-medium">Facturi Lunare</div>
            <p className="text-xs text-foreground/60 mt-1">Emitere facturi</p>
          </Link>

          <Link
            href="/contracts"
            className="rounded-xl border border-foreground/10 bg-background p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <svg className="h-8 w-8 mx-auto mb-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="font-medium">Contracte</div>
            <p className="text-xs text-foreground/60 mt-1">Gestionare contracte</p>
          </Link>

          <Link
            href="/indexing-schedule"
            className="rounded-xl border border-foreground/10 bg-background p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <svg className="h-8 w-8 mx-auto mb-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="font-medium">Indexări</div>
            <p className="text-xs text-foreground/60 mt-1">Grafic indexări</p>
          </Link>

          <Link
            href="/admin"
            className="rounded-xl border border-foreground/10 bg-background p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <svg className="h-8 w-8 mx-auto mb-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="font-medium">Administrare</div>
            <p className="text-xs text-foreground/60 mt-1">Setări & rapoarte</p>
          </Link>
        </div>
      </div>
    </main>
  );
}

