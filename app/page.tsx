import {
  fetchContracts,
  effectiveEndDate,
  rentAmountAtDate,
} from "@/lib/contracts";
import { listInvoicesForMonth } from "@/lib/contracts";
import { getDailyEurRon } from "@/lib/exchange";
import { fetchOwners } from "@/lib/owners";
import OwnerFilter from "./components/owner-filter";

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
  const months = [
    "Ian",
    "Feb",
    "Mar",
    "Apr",
    "Mai",
    "Iun",
    "Iul",
    "Aug",
    "Sep",
    "Oct",
    "Noi",
    "Dec",
  ];
  return months[month - 1] || "";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Fetch owners and get selected owner from search params
  const owners = await fetchOwners();
  const sp = await searchParams;
  const selectedOwnerId =
    (typeof sp.ownerId === "string"
      ? sp.ownerId
      : Array.isArray(sp.ownerId)
      ? sp.ownerId[0]
      : owners[0]?.id) ||
    owners[0]?.id ||
    "";
  const selectedOwner =
    owners.find((o) => o.id === selectedOwnerId) ?? owners[0];

  // Fetch all contracts and filter by selected owner
  const allContracts = await fetchContracts();
  const contracts = allContracts.filter((c: any) => {
    const okById = c.ownerId && String(c.ownerId) === selectedOwnerId;
    const okByName = String(c.owner || "") === selectedOwner?.name;
    return okById || okByName;
  });

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

  // Contracts expiring soon (30/60/90 days)
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);
  const next60Days = new Date();
  next60Days.setDate(next60Days.getDate() + 60);
  const next90Days = new Date();
  next90Days.setDate(next90Days.getDate() + 90);

  const expiring30 = activeContracts.filter((c) => {
    const endDate = new Date(effectiveEndDate(c));
    return endDate <= next30Days;
  });

  const expiring60 = activeContracts.filter((c) => {
    const endDate = new Date(effectiveEndDate(c));
    return endDate <= next60Days && endDate > next30Days;
  });

  const expiring90 = activeContracts.filter((c) => {
    const endDate = new Date(effectiveEndDate(c));
    return endDate <= next90Days && endDate > next60Days;
  });

  // Monthly revenue calculation (current and historical - last 12 months)
  const monthlyData: Array<{
    month: number;
    year: number;
    revenueEUR: number;
    revenueRON: number;
    revenueRONwithVAT: number;
    invoiceCount: number;
  }> = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const allInvs = await listInvoicesForMonth(y, m);
    // Filter invoices by selected owner
    const invs = allInvs.filter((inv) => {
      const okById = inv.ownerId && String(inv.ownerId) === selectedOwnerId;
      const okByName = String(inv.owner || "") === selectedOwner?.name;
      return okById || okByName;
    });
    const revEUR = invs.reduce(
      (sum, inv) => sum + (inv.correctedAmountEUR || inv.amountEUR || 0),
      0
    );
    const revRONwithoutVAT = invs.reduce((sum, inv) => sum + (inv.netRON || 0), 0);
    const revRONwithVAT = invs.reduce((sum, inv) => sum + (inv.totalRON || 0), 0);
    monthlyData.push({
      month: m,
      year: y,
      revenueEUR: revEUR,
      revenueRON: revRONwithoutVAT,
      revenueRONwithVAT: revRONwithVAT,
      invoiceCount: invs.length,
    });
  }

  const currentMonthData = monthlyData[monthlyData.length - 1];
  const monthlyRevenueEUR = currentMonthData.revenueEUR;
  const monthlyRevenueRON = currentMonthData.revenueRON;
  const monthlyRevenueRONwithVAT = currentMonthData.revenueRONwithVAT;
  const monthlyInvoiceCount = currentMonthData.invoiceCount;

  // Calculate expected monthly revenue from all active monthly contracts
  const expectedMonthlyEUR = activeContracts
    .filter((c) => c.rentType === "monthly")
    .reduce((sum, c) => {
      const amount = rentAmountAtDate(c, today);
      return sum + (typeof amount === "number" ? amount : 0);
    }, 0);
  
  // Calculate expected amounts in RON based on actual contract VAT settings
  let expectedMonthlyRON = 0;
  let expectedMonthlyRONwithVAT = 0;
  
  for (const c of activeContracts.filter((c) => c.rentType === "monthly")) {
    const amountEUR = rentAmountAtDate(c, today);
    if (typeof amountEUR === "number") {
      const netRON = amountEUR * eurRonRate;
      const tvaPercent = (c as any).tvaPercent || 0;
      const vatRON = netRON * (tvaPercent / 100);
      const totalRON = netRON + vatRON;
      
      expectedMonthlyRON += netRON;
      expectedMonthlyRONwithVAT += totalRON;
    }
  }

  // Year-to-date revenue
  const ytdRevenueEUR = monthlyData
    .filter((m) => m.year === currentYear)
    .reduce((sum, m) => sum + m.revenueEUR, 0);
  const ytdRevenueRON = monthlyData
    .filter((m) => m.year === currentYear)
    .reduce((sum, m) => sum + m.revenueRON, 0);
  const ytdRevenueRONwithVAT = monthlyData
    .filter((m) => m.year === currentYear)
    .reduce((sum, m) => sum + m.revenueRONwithVAT, 0);

  // Revenue growth (MoM)
  const lastMonthData = monthlyData[monthlyData.length - 2];
  const revenueGrowth = lastMonthData?.revenueEUR
    ? ((monthlyRevenueEUR - lastMonthData.revenueEUR) /
        lastMonthData.revenueEUR) *
      100
    : 0;

  // Average monthly revenue (last 6 months - only months with data)
  const last6Months = monthlyData.slice(-6);
  const monthsWithData = last6Months.filter((m) => m.revenueEUR > 0);
  const avgMonthlyRevenue =
    monthsWithData.length > 0
      ? monthsWithData.reduce((sum, m) => sum + m.revenueEUR, 0) /
        monthsWithData.length
      : 0;

  // Forecasted next month (simple average-based)
  const forecastNextMonth = Math.round(avgMonthlyRevenue);

  // Contract types breakdown
  const monthlyContracts = activeContracts.filter(
    (c) => c.rentType === "monthly"
  ).length;
  const yearlyContracts = activeContracts.filter(
    (c) => c.rentType === "yearly"
  ).length;

  // Partner/tenant count
  const uniquePartners = new Set(
    activeContracts.map((c) => c.partner || c.partnerId).filter(Boolean)
  ).size;

  // Asset/property count
  const uniqueAssets = new Set(
    activeContracts.map((c) => c.assetId).filter(Boolean)
  ).size;

  // Total revenue for the selected owner
  const totalRevenue = activeContracts.reduce((sum, c) => {
    const amount = rentAmountAtDate(c, today);
    if (typeof amount === "number") {
      return sum + (c.rentType === "monthly" ? amount : amount / 12);
    }
    return sum;
  }, 0);

  // Average rent
  const avgRentEUR = expectedMonthlyEUR / Math.max(monthlyContracts, 1);

  // Partner breakdown for pie chart
  const partnerMap = new Map<string, { count: number; revenue: number }>();
  for (const c of activeContracts) {
    const partner = c.partner || c.partnerId || "Unknown";
    const current = partnerMap.get(partner) || { count: 0, revenue: 0 };
    const amount = rentAmountAtDate(c, today);
    current.count += 1;
    if (typeof amount === "number") {
      current.revenue += c.rentType === "monthly" ? amount : amount / 12;
    }
    partnerMap.set(partner, current);
  }

  const partnerData = Array.from(partnerMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      revenue: data.revenue,
      percentage: 0, // Will be calculated next
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalPartnerRevenue = partnerData.reduce(
    (sum, p) => sum + p.revenue,
    0
  );
  partnerData.forEach((p) => {
    p.percentage =
      totalPartnerRevenue > 0 ? (p.revenue / totalPartnerRevenue) * 100 : 0;
  });

  // Show all partners in the chart
  const partnerChartData = partnerData;

  // Colors for pie chart (extended palette)
  const pieColors = [
    "rgb(59, 130, 246)", // blue-500
    "rgb(139, 92, 246)", // violet-500
    "rgb(236, 72, 153)", // pink-500
    "rgb(251, 146, 60)", // orange-500
    "rgb(34, 197, 94)", // green-500
    "rgb(249, 115, 22)", // orange-600
    "rgb(168, 85, 247)", // purple-500
    "rgb(14, 165, 233)", // sky-500
    "rgb(245, 158, 11)", // amber-500
    "rgb(239, 68, 68)", // red-500
    "rgb(16, 185, 129)", // emerald-500
    "rgb(244, 63, 94)", // rose-500
  ];

  // Calculate cumulative percentages for pie chart
  let cumulativePercentage = 0;
  const pieSegments = partnerChartData.map((partner, idx) => {
    const startPercentage = cumulativePercentage;
    cumulativePercentage += partner.percentage;
    return {
      ...partner,
      startPercentage,
      endPercentage: cumulativePercentage,
      color: pieColors[idx % pieColors.length],
    };
  });

  // Indexing upcoming
  const indexingUpcoming = activeContracts.filter((c) => {
    const dates = ((c as any).indexingDates || []) as Array<{
      forecastDate: string;
      done?: boolean;
    }>;
    return dates.some((d) => {
      if (d.done) return false;
      const diffDays = Math.floor(
        (new Date(d.forecastDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return diffDays >= 0 && diffDays <= 60;
    });
  }).length;

  // Contract health metrics
  const contractsWithUpcomingIndexing = activeContracts.filter((c) => {
    const dates = ((c as any).indexingDates || []) as Array<{
      forecastDate: string;
      done?: boolean;
    }>;
    return dates.some((d) => !d.done);
  }).length;

  // Contract duration stats
  const contractAges = activeContracts.map((c) => {
    const start = new Date(c.startDate);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays;
  });
  const avgContractAge =
    contractAges.length > 0
      ? Math.round(
          contractAges.reduce((sum, age) => sum + age, 0) / contractAges.length
        )
      : 0;

  // Prepare chart data for mini sparklines
  const chartMaxRevenue = Math.max(...monthlyData.map((m) => m.revenueEUR), 1);
  const chartData = monthlyData.map((m, idx) => ({
    label: `${getMonthName(m.month)} ${m.year}`,
    value: m.revenueEUR,
    monthIndex: idx,
    // Ensure minimum 5% height for visibility if there's any revenue
    normalizedHeight:
      m.revenueEUR > 0
        ? Math.max((m.revenueEUR / chartMaxRevenue) * 100, 5)
        : 0,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 py-8">
      <div className="container mx-auto px-4 max-w-[1600px]">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Dashboard Executiv
              </h1>
              <p className="text-foreground/60 text-lg">
                Privire completă asupra portofoliului tău •{" "}
                {new Date().toLocaleDateString("ro-RO", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="hidden md:flex gap-2">
              <Link
                href="/invoices/monthly"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                Emite Facturi
              </Link>
              <Link
                href="/contracts"
                className="px-4 py-2 rounded-lg border border-foreground/20 hover:bg-foreground/5 font-medium transition-colors"
              >
                Contracte
              </Link>
            </div>
          </div>
        </div>

        {/* Owner Filter */}
        {owners.length > 0 && (
          <OwnerFilter
            owners={owners.map((o) => ({ id: o.id, name: o.name }))}
            selectedOwnerId={selectedOwnerId}
            contractCount={contracts.length}
          />
        )}

        {/* Primary KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Owner Info */}
          <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-cyan-500/10 via-background to-background p-6 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide">
                  Proprietar Selectat
                </h3>
                <div className="text-3xl font-bold mt-2 truncate">
                  {selectedOwner?.name || "—"}
                </div>
              </div>
              <div className="rounded-full bg-cyan-500/20 p-3 flex-shrink-0 ml-2">
                <svg
                  className="h-6 w-6 text-cyan-600 dark:text-cyan-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            </div>
            <div className="border-t border-foreground/10 pt-3">
              <div className="text-sm text-foreground/70">
                {uniqueAssets}{" "}
                {uniqueAssets === 1 ? "proprietate" : "proprietăți"}
              </div>
            </div>
            <div className="mt-2 text-xs text-foreground/50">
              {uniquePartners} {uniquePartners === 1 ? "partener" : "parteneri"}
            </div>
          </div>

          {/* Average Rent */}
          <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-purple-500/10 via-background to-background p-6 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide">
                  Chirie Medie
                </h3>
                <div className="text-3xl font-bold mt-2">
                  {formatCurrency(avgRentEUR, "EUR")}
                </div>
              </div>
              <div className="rounded-full bg-purple-500/20 p-3">
                <svg
                  className="h-6 w-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
              </div>
            </div>
            <div className="border-t border-foreground/10 pt-3">
              <div className="text-sm text-foreground/70">
                per contract lunar
              </div>
            </div>
            <div className="mt-2 text-xs text-foreground/50">
              {monthlyContracts} contracte lunare
            </div>
          </div>

          {/* Indexing Queue */}
          <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-orange-500/10 via-background to-background p-6 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide">
                  Indexări Viitoare
                </h3>
                <div className="text-3xl font-bold mt-2">
                  {indexingUpcoming}
                </div>
              </div>
              <div className="rounded-full bg-orange-500/20 p-3">
                <svg
                  className="h-6 w-6 text-orange-600 dark:text-orange-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>
            <div className="border-t border-foreground/10 pt-3">
              <div className="text-sm text-foreground/70">
                în următoarele 60 zile
              </div>
            </div>
            <div className="mt-2 text-xs text-foreground/50">
              actualizări chirii
            </div>
          </div>

          {/* Expiring Contracts */}
          <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-amber-500/10 via-background to-background p-6 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide">
                  Expirări Contracte
                </h3>
                <div className="text-3xl font-bold mt-2">
                  {expiring30.length}
                </div>
              </div>
              <div className="rounded-full bg-amber-500/20 p-3">
                <svg
                  className="h-6 w-6 text-amber-600 dark:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="border-t border-foreground/10 pt-3">
              <div className="text-sm text-foreground/70 flex items-center gap-4">
                <span>{expiring30.length} în 30 zile</span>
                <span>{expiring60.length} în 60 zile</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-foreground/50">
              {expiring90.length} în 90 zile
            </div>
          </div>
        </div>

        {/* Secondary KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Active Contracts */}
          <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-blue-500/10 via-background to-background p-6 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide">
                  Contracte Active
                </h3>
                <div className="text-4xl font-bold mt-2">
                  {activeContracts.length}
                </div>
              </div>
              <div className="rounded-full bg-blue-500/20 p-3">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-foreground/10 pt-3">
              <span className="text-foreground/70">
                {monthlyContracts} lunare
              </span>
              <span className="text-foreground/70">
                {yearlyContracts} anuale
              </span>
            </div>
            <div className="mt-2 text-xs text-foreground/50">
              {uniquePartners} parteneri • {uniqueAssets} proprietăți
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-green-500/10 via-background to-background p-6 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide">
                  Venit Luna Curentă
                </h3>
                <div className="text-4xl font-bold mt-2">
                  {formatCurrency(monthlyRevenueEUR, "EUR")}
                </div>
              </div>
              <div className="rounded-full bg-green-500/20 p-3">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-foreground/10 pt-3">
              <div className="text-sm">
                <span className="text-foreground/70">
                  {monthlyInvoiceCount} facturi
                </span>
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  revenueGrowth >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {revenueGrowth >= 0 ? "↑" : "↓"}{" "}
                {formatPercent(Math.abs(revenueGrowth))}
              </div>
            </div>
            <div className="mt-2 text-xs text-foreground/50">
              RON: {formatCurrency(monthlyRevenueRON, "RON")} (fără TVA) • {formatCurrency(monthlyRevenueRONwithVAT, "RON")} (cu TVA)
            </div>
          </div>

          {/* YTD Revenue */}
          <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-emerald-500/10 via-background to-background p-6 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide">
                  Venit An Curent
                </h3>
                <div className="text-4xl font-bold mt-2">
                  {formatCurrency(ytdRevenueEUR, "EUR")}
                </div>
              </div>
              <div className="rounded-full bg-emerald-500/20 p-3">
                <svg
                  className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
            </div>
            <div className="border-t border-foreground/10 pt-3">
              <div className="text-sm text-foreground/70">
                Medie lunară:{" "}
                {formatCurrency(Math.round(avgMonthlyRevenue), "EUR")}
              </div>
            </div>
            <div className="mt-2 text-xs text-foreground/50">
              RON: {formatCurrency(ytdRevenueRON, "RON")} (fără TVA) • {formatCurrency(ytdRevenueRONwithVAT, "RON")} (cu TVA)
            </div>
          </div>
        </div>

        {/* Revenue Trend Chart */}
        <div className="rounded-2xl border border-foreground/10 bg-background p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">
                Trend Venituri (Ultimele 12 Luni)
              </h3>
              <p className="text-sm text-foreground/60 mt-1">
                Evoluția veniturilor lunare în EUR
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-foreground/60">Medie L6M</div>
              <div className="text-xl font-bold">
                {formatCurrency(Math.round(avgMonthlyRevenue), "EUR")}
              </div>
            </div>
          </div>

          {/* Simple Bar Chart */}
          <div className="relative">
            {/* Y-axis reference lines */}
            <div
              className="absolute inset-0 flex flex-col justify-between pointer-events-none"
              style={{ height: "160px", marginBottom: "32px" }}
            >
              <div className="border-t border-dashed border-foreground/5"></div>
              <div className="border-t border-dashed border-foreground/5"></div>
              <div className="border-t border-dashed border-foreground/5"></div>
              <div className="border-t border-dashed border-foreground/10"></div>
            </div>

            <div
              className="flex items-end justify-between gap-1 relative"
              style={{ height: "160px" }}
            >
              {chartData.map((item, idx) => {
                const barHeight = Math.max(
                  (item.normalizedHeight / 100) * 160,
                  item.value > 0 ? 8 : 2
                );
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end gap-2"
                  >
                    <div
                      className={`w-full rounded-t-lg transition-all hover:opacity-90 hover:scale-105 cursor-pointer ${
                        idx === chartData.length - 1
                          ? "bg-gradient-to-t from-blue-600 to-blue-400 shadow-lg"
                          : "bg-gradient-to-t from-blue-400 to-blue-300 opacity-70"
                      }`}
                      style={{
                        height: `${barHeight}px`,
                      }}
                      title={`${item.label}: ${formatCurrency(
                        item.value,
                        "EUR"
                      )} (${item.normalizedHeight.toFixed(1)}%)`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-1 mt-2">
              {chartData.map((item, idx) => (
                <div
                  key={idx}
                  className="flex-1 text-[10px] text-foreground/50 text-center whitespace-nowrap"
                >
                  {getMonthName(monthlyData[idx].month)}
                </div>
              ))}
            </div>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-foreground/10 text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-600 to-blue-400" />
                <span className="text-foreground/70">Luna curentă</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-foreground/20" />
                <span className="text-foreground/70">Luni anterioare</span>
              </div>
            </div>
            <div className="text-foreground/60">
              Max: {formatCurrency(chartMaxRevenue, "EUR")}
            </div>
          </div>
        </div>

        {/* Partner Distribution - Comprehensive */}
        <div className="rounded-2xl border border-foreground/10 bg-background p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold">Distribuție Parteneri</h3>
              <p className="text-sm text-foreground/60 mt-1">
                Repartiția veniturilor și statistici detaliate pentru toți
                partenerii
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{uniquePartners}</div>
              <div className="text-xs text-foreground/60">parteneri activi</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pie Chart */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-center mb-4">
                <svg viewBox="0 0 200 200" className="w-64 h-64">
                  {pieSegments.map((segment, idx) => {
                    const startAngle =
                      (segment.startPercentage / 100) * 360 - 90;
                    const endAngle = (segment.endPercentage / 100) * 360 - 90;
                    const largeArcFlag = segment.percentage > 50 ? 1 : 0;

                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;

                    const x1 = 100 + 80 * Math.cos(startRad);
                    const y1 = 100 + 80 * Math.sin(startRad);
                    const x2 = 100 + 80 * Math.cos(endRad);
                    const y2 = 100 + 80 * Math.sin(endRad);

                    const pathData = [
                      `M 100 100`,
                      `L ${x1} ${y1}`,
                      `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                      `Z`,
                    ].join(" ");

                    return (
                      <g key={idx}>
                        <path
                          d={pathData}
                          fill={segment.color}
                          stroke="white"
                          strokeWidth="2"
                          className="transition-opacity hover:opacity-80 cursor-pointer"
                        />
                      </g>
                    );
                  })}
                  <circle
                    cx="100"
                    cy="100"
                    r="45"
                    fill="white"
                    className="dark:fill-slate-950"
                  />
                  <text
                    x="100"
                    y="95"
                    textAnchor="middle"
                    className="text-2xl font-bold fill-slate-900 dark:fill-slate-100"
                  >
                    {uniquePartners}
                  </text>
                  <text
                    x="100"
                    y="110"
                    textAnchor="middle"
                    className="text-xs fill-slate-700 dark:fill-slate-300"
                  >
                    parteneri
                  </text>
                </svg>
              </div>

              {/* Compact Legend */}
              <div className="space-y-1.5">
                {pieSegments.slice(0, 6).map((segment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-foreground/5 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span className="font-medium truncate">
                        {segment.name}
                      </span>
                    </div>
                    <span className="font-bold ml-2 flex-shrink-0">
                      {formatPercent(segment.percentage)}
                    </span>
                  </div>
                ))}
                {pieSegments.length > 6 && (
                  <div className="text-xs text-foreground/50 text-center pt-1">
                    +{pieSegments.length - 6} mai mulți
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Stats List */}
            <div className="lg:col-span-2">
              <div className="space-y-3">
                {partnerData.map((partner, idx) => (
                  <div
                    key={idx}
                    className="border-b border-foreground/10 pb-3 last:border-0"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{
                            backgroundColor: pieColors[idx % pieColors.length],
                          }}
                        >
                          {partner.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {partner.name}
                          </div>
                          <div className="text-xs text-foreground/60">
                            {partner.count}{" "}
                            {partner.count === 1 ? "contract" : "contracte"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="font-bold">
                          {formatCurrency(partner.revenue, "EUR")}
                        </div>
                        <div className="text-xs text-foreground/60">
                          {formatPercent(partner.percentage)} din total
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-foreground/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${partner.percentage}%`,
                          backgroundColor: pieColors[idx % pieColors.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"></div>

        {/* Financial Health & Currency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue Progress */}
          <div className="rounded-2xl border border-foreground/10 bg-background p-6 shadow-lg">
            <h3 className="text-base font-semibold mb-5">
              Progres Venituri Lunare
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm text-foreground/60">Realizat (EUR)</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(monthlyRevenueEUR, "EUR")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-foreground/50">RON fără TVA</span>
                  <span className="text-sm font-medium text-foreground/80">
                    {formatCurrency(monthlyRevenueRON, "RON")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-xs text-foreground/50">RON cu TVA</span>
                  <span className="text-sm font-medium text-foreground/80">
                    {formatCurrency(monthlyRevenueRONwithVAT, "RON")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mb-3 pt-2 border-t border-foreground/5">
                  <span className="text-sm text-foreground/60">
                    Așteptat (contracte lunare)
                  </span>
                  <span className="text-lg font-medium">
                    {formatCurrency(expectedMonthlyEUR, "EUR")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-foreground/50">RON fără TVA</span>
                  <span className="text-sm font-medium text-foreground/80">
                    {formatCurrency(expectedMonthlyRON, "RON")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-xs text-foreground/50">RON cu TVA</span>
                  <span className="text-sm font-medium text-foreground/80">
                    {formatCurrency(expectedMonthlyRONwithVAT, "RON")}
                  </span>
                </div>
                <div className="w-full bg-foreground/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-600 to-emerald-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                    style={{
                      width: `${Math.min(
                        (monthlyRevenueEUR / Math.max(expectedMonthlyEUR, 1)) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm text-foreground/60">
                    {formatPercent(
                      (monthlyRevenueEUR / Math.max(expectedMonthlyEUR, 1)) *
                        100
                    )}{" "}
                    realizare
                  </p>
                  <p className="text-sm font-medium">
                    {monthlyRevenueEUR >= expectedMonthlyEUR ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ Obiectiv atins
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        Rămân{" "}
                        {formatCurrency(
                          expectedMonthlyEUR - monthlyRevenueEUR,
                          "EUR"
                        )}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* YTD Progress */}
              <div className="pt-4 border-t border-foreground/10">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm text-foreground/60">
                    Venit cumulat YTD (EUR)
                  </span>
                  <span className="text-xl font-bold">
                    {formatCurrency(ytdRevenueEUR, "EUR")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-foreground/50">RON fără TVA</span>
                  <span className="text-sm font-medium text-foreground/80">
                    {formatCurrency(ytdRevenueRON, "RON")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs text-foreground/50">RON cu TVA</span>
                  <span className="text-sm font-medium text-foreground/80">
                    {formatCurrency(ytdRevenueRONwithVAT, "RON")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-foreground/5">
                  <span className="text-sm text-foreground/60">
                    Medie lunară YTD
                  </span>
                  <span className="text-lg font-medium">
                    {formatCurrency(
                      Math.round(ytdRevenueEUR / currentMonth),
                      "EUR"
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Currency & Exchange Rate */}
          <div className="rounded-2xl border border-foreground/10 bg-background p-6 shadow-lg">
            <h3 className="text-base font-semibold mb-5">
              Distribuție Valutară Luna Curentă
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                      €
                    </div>
                    <span className="text-sm text-foreground/60">EUR</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {formatCurrency(monthlyRevenueEUR, "EUR")}
                  </span>
                </div>

                <div className="flex justify-between items-baseline mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400">
                      L
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground/60">RON</span>
                      <span className="text-xs text-foreground/40">fără TVA</span>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">
                    {formatCurrency(monthlyRevenueRON, "RON")}
                  </span>
                </div>

                <div className="flex justify-between items-baseline mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center font-bold text-teal-600 dark:text-teal-400">
                      L+
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground/60">RON</span>
                      <span className="text-xs text-foreground/40">cu TVA</span>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">
                    {formatCurrency(monthlyRevenueRONwithVAT, "RON")}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-foreground/10">
                <div className="rounded-lg bg-foreground/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground/60">
                      Curs BNR (EUR/RON)
                    </span>
                    <span className="text-xs text-foreground/50">
                      {exchangeRate?.date || "N/A"}
                    </span>
                  </div>
                  <div className="text-3xl font-bold">
                    {eurRonRate.toFixed(4)}
                  </div>
                  <p className="text-xs text-foreground/60 mt-2">
                    1 EUR = {eurRonRate.toFixed(4)} RON
                  </p>
                </div>
              </div>

              {/* Estimated Total in RON */}
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between text-foreground/60">
                  <span>Total în RON (fără TVA):</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(monthlyRevenueRON, "RON")}
                  </span>
                </div>
                <div className="flex justify-between text-foreground/60">
                  <span>Total în RON (cu TVA):</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(monthlyRevenueRONwithVAT, "RON")}
                  </span>
                </div>
                <div className="text-xs text-foreground/50 mt-1">
                  * Totalurile RON includ facturile EUR convertite la cursul de la data emiterii
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expiring Contracts Detail */}
        {(expiring30.length > 0 ||
          expiring60.length > 0 ||
          expiring90.length > 0) && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-6 shadow-lg mb-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-500/20 p-3 mt-1">
                <svg
                  className="h-6 w-6 text-amber-600 dark:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
                  Atenție: Contracte ce expiră în curând
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                  Următoarele contracte necesită atenție pentru reînnoire sau
                  renegociere
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {expiring30.length > 0 && (
                    <div className="rounded-lg bg-background/50 p-4 border border-amber-500/20">
                      <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {expiring30.length}
                      </div>
                      <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        în următoarele 30 zile
                      </div>
                      <Link
                        href="/contracts"
                        className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                      >
                        Vezi contracte →
                      </Link>
                    </div>
                  )}
                  {expiring60.length > 0 && (
                    <div className="rounded-lg bg-background/50 p-4 border border-amber-500/20">
                      <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {expiring60.length}
                      </div>
                      <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        în 30-60 zile
                      </div>
                    </div>
                  )}
                  {expiring90.length > 0 && (
                    <div className="rounded-lg bg-background/50 p-4 border border-amber-500/20">
                      <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {expiring90.length}
                      </div>
                      <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        în 60-90 zile
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Action Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Link
            href="/invoices/monthly"
            className="group rounded-xl border border-foreground/10 bg-background p-5 shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all duration-200"
          >
            <div className="rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 p-3 w-fit mx-auto mb-3 transition-colors">
              <svg
                className="h-7 w-7 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="font-semibold text-center group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Facturi Lunare
            </div>
            <p className="text-xs text-foreground/60 text-center mt-1">
              Emitere & gestionare
            </p>
          </Link>

          <Link
            href="/contracts"
            className="group rounded-xl border border-foreground/10 bg-background p-5 shadow-sm hover:shadow-xl hover:border-green-500/30 transition-all duration-200"
          >
            <div className="rounded-lg bg-green-500/10 group-hover:bg-green-500/20 p-3 w-fit mx-auto mb-3 transition-colors">
              <svg
                className="h-7 w-7 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="font-semibold text-center group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              Contracte
            </div>
            <p className="text-xs text-foreground/60 text-center mt-1">
              Vezi & editează
            </p>
          </Link>

          <Link
            href="/indexing-schedule"
            className="group rounded-xl border border-foreground/10 bg-background p-5 shadow-sm hover:shadow-xl hover:border-amber-500/30 transition-all duration-200"
          >
            <div className="rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 p-3 w-fit mx-auto mb-3 transition-colors">
              <svg
                className="h-7 w-7 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="font-semibold text-center group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Indexări
            </div>
            <p className="text-xs text-foreground/60 text-center mt-1">
              Grafic & istoric
            </p>
          </Link>

          <Link
            href="/partners"
            className="group rounded-xl border border-foreground/10 bg-background p-5 shadow-sm hover:shadow-xl hover:border-purple-500/30 transition-all duration-200"
          >
            <div className="rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 p-3 w-fit mx-auto mb-3 transition-colors">
              <svg
                className="h-7 w-7 text-purple-600 dark:text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div className="font-semibold text-center group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Parteneri
            </div>
            <p className="text-xs text-foreground/60 text-center mt-1">
              Clienți activi
            </p>
          </Link>

          <Link
            href="/owners"
            className="group rounded-xl border border-foreground/10 bg-background p-5 shadow-sm hover:shadow-xl hover:border-cyan-500/30 transition-all duration-200"
          >
            <div className="rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 p-3 w-fit mx-auto mb-3 transition-colors">
              <svg
                className="h-7 w-7 text-cyan-600 dark:text-cyan-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div className="font-semibold text-center group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
              Proprietari
            </div>
            <p className="text-xs text-foreground/60 text-center mt-1">
              Gestionare date
            </p>
          </Link>

          <Link
            href="/admin"
            className="group rounded-xl border border-foreground/10 bg-background p-5 shadow-sm hover:shadow-xl hover:border-pink-500/30 transition-all duration-200"
          >
            <div className="rounded-lg bg-pink-500/10 group-hover:bg-pink-500/20 p-3 w-fit mx-auto mb-3 transition-colors">
              <svg
                className="h-7 w-7 text-pink-600 dark:text-pink-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div className="font-semibold text-center group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
              Administrare
            </div>
            <p className="text-xs text-foreground/60 text-center mt-1">
              Setări & rapoarte
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
