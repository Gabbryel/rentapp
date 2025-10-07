"use server";

import { ContractSchema } from "@/lib/schemas/contract";
import { upsertContract, generateIndexingDatesFromSchedule, fetchContractById } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import { notifyContractCreated } from "@/lib/notify";
import type { ZodIssue } from "zod";
import { saveScanFile } from "@/lib/storage";
import { redirect } from "next/navigation";

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  values: Record<string, string | string | string[] | undefined>;
};

const emptyState: FormState = { ok: false, values: {} };

export async function createContractAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // Collect values to repopulate fields on error
  const rawValues: FormState["values"] = {
    id: (formData.get("id") as string) || "",
    name: (formData.get("name") as string) ?? "",
    assetId: (formData.get("assetId") as string) || "",
    asset: (formData.get("asset") as string) || "",
    partnerId: (formData.get("partnerId") as string) || "",
    partner: (formData.get("partner") as string) ?? "",
  ownerId: (formData.get("ownerId") as string) || "",
  owner: (formData.get("owner") as string) || "",
    signedAt: (formData.get("signedAt") as string) ?? "",
    startDate: (formData.get("startDate") as string) ?? "",
    endDate: (formData.get("endDate") as string) ?? "",
  extensionDate: (formData.get("extensionDate") as string) || "",
  extendedAt: (formData.get("extendedAt") as string) || "",
  paymentDueDays: (formData.get("paymentDueDays") as string) || "",
    indexingDates: (formData.getAll("indexingDates") as string[]).filter(Boolean),
  indexingScheduleDay: (formData.get("indexingScheduleDay") as string) || "",
  indexingScheduleMonth: (formData.get("indexingScheduleMonth") as string) || "",
  indexingEveryMonths: (formData.get("indexingEveryMonths") as string) || "",
  scanUrls: (formData.getAll("scanUrls") as string[]).filter(Boolean),
  scanTitles: (formData.getAll("scanTitles") as string[]).filter(() => true),
    amountEUR: (formData.get("amountEUR") as string) || "",
    exchangeRateRON: (formData.get("exchangeRateRON") as string) || "",
    tvaPercent: (formData.get("tvaPercent") as string) || "",
    correctionPercent: (formData.get("correctionPercent") as string) || "",
    rentType: (formData.get("rentType") as string) || "monthly",
    invoiceMonthMode: (formData.get("invoiceMonthMode") as string) || "current",
    monthlyInvoiceDay: (formData.get("monthlyInvoiceDay") as string) || "",
    // collect yearlyInvoices flat fields
    ...(() => {
      const out: Record<string, string> = {};
      for (let i = 0; i < 24; i++) {
        const m = (formData.get(`yearlyInvoices[${i}][month]`) as string) || "";
        const d = (formData.get(`yearlyInvoices[${i}][day]`) as string) || "";
        const a = (formData.get(`yearlyInvoices[${i}][amountEUR]`) as string) || "";
        if (m || d || a) {
          out[`yearlyInvoices[${i}][month]`] = m;
          out[`yearlyInvoices[${i}][day]`] = d;
          out[`yearlyInvoices[${i}][amountEUR]`] = a;
        }
      }
      return out;
    })(),
  };

  try {
    const data = {
      id: (rawValues.id as string) || `c_${Date.now()}`,
      name: (rawValues.name as string) ?? "",
      assetId: ((rawValues.assetId as string) || undefined) as string | undefined,
      asset: (rawValues.asset as string) || undefined,
      partnerId: ((rawValues.partnerId as string) || undefined) as string | undefined,
      partner: (rawValues.partner as string) ?? "",
  ownerId: ((rawValues.ownerId as string) || undefined) as string | undefined,
  owner: (rawValues.owner as string) || "",
      signedAt: (rawValues.signedAt as string) ?? "",
      startDate: (rawValues.startDate as string) ?? "",
      endDate: (rawValues.endDate as string) ?? "",
  indexingDates: (rawValues.indexingDates as string[]) ?? [],
      extensionDate: (rawValues.extensionDate as string) || undefined,
  extendedAt: (rawValues.extendedAt as string) || undefined,
      paymentDueDays: (() => {
        const n = Number(rawValues.paymentDueDays as string);
        return Number.isInteger(n) && n >= 0 && n <= 120 ? n : undefined;
      })(),
  scanUrl: undefined as string | undefined,
  scans: [] as { url: string; title?: string }[],
      amountEUR: (() => {
        const raw = (rawValues.amountEUR as string) || "";
        const n = Number(raw.replace(",", "."));
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      exchangeRateRON: (() => {
        const raw = (rawValues.exchangeRateRON as string) || "";
        const n = Number(raw.replace(",", "."));
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      tvaPercent: (() => {
        const raw = (rawValues.tvaPercent as string) || "";
        const n = Number(raw);
        if (!Number.isInteger(n)) return undefined;
        if (n < 0 || n > 100) return undefined;
        return n;
      })(),
      correctionPercent: (() => {
        const raw = (rawValues.correctionPercent as string) || "";
        const n = Number(raw.replace(",", "."));
        if (!Number.isFinite(n)) return undefined;
        if (n < 0 || n > 100) return undefined;
        // keep up to 4 decimals to avoid floating noise
        return Math.round(n * 10000) / 10000;
      })(),
      rentType: ((): "monthly" | "yearly" =>
        String(rawValues.rentType) === "yearly" ? "yearly" : "monthly")(),
        invoiceMonthMode: (() =>
          String((rawValues as any).invoiceMonthMode) === "next" ? "next" : "current"
        )(),
      monthlyInvoiceDay: (() => {
        const n = Number(rawValues.monthlyInvoiceDay as string);
        return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
      })(),
      yearlyInvoices: (() => {
        const rows: { month: number; day: number; amountEUR: number }[] = [];
        for (let i = 0; i < 24; i++) {
          const m = Number(String(rawValues[`yearlyInvoices[${i}][month]`] ?? ""));
          const d = Number(String(rawValues[`yearlyInvoices[${i}][day]`] ?? ""));
          const a = Number(String(rawValues[`yearlyInvoices[${i}][amountEUR]`] ?? ""));
          if (
            Number.isInteger(m) && m >= 1 && m <= 12 &&
            Number.isInteger(d) && d >= 1 && d <= 31 &&
            Number.isFinite(a) && a > 0
          ) {
            rows.push({ month: m, day: d, amountEUR: a });
          }
        }
        return rows.length > 0 ? rows : undefined;
      })(),
    };

    // Compute name/id from asset + partner if asset is selected
    const safeSlug = (s: string) =>
      s
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
    if (data.asset && data.partner) {
      const baseName = `${data.asset} ${data.partner}`.trim();
      data.name = baseName;
      let baseId = `c_${safeSlug(baseName)}`;
      if (!baseId) baseId = `c_${Date.now()}`;
      // Ensure uniqueness by probing existing ids
      let uniqueId = baseId;
      if (process.env.MONGODB_URI) {
        let counter = 1;
        while (counter < 100) {
          const exists = await fetchContractById(uniqueId);
          if (!exists) break;
          counter++;
          uniqueId = `${baseId}-${counter}`;
        }
      }
      data.id = uniqueId || data.id;
    }

    // If schedule fields are present, compute indexingDates union existing manual ones (unique, sorted)
    const schedDayRaw = String(rawValues.indexingScheduleDay || "").trim();
    const schedMonthRaw = String(rawValues.indexingScheduleMonth || "").trim();
    const schedEveryRaw = String(rawValues.indexingEveryMonths || "").trim();
    const schedDay = Number(schedDayRaw);
    const schedMonth = Number(schedMonthRaw);
    const schedEvery = Number(schedEveryRaw);
    const hasSchedule =
      Number.isInteger(schedDay) && schedDay >= 1 &&
      Number.isInteger(schedMonth) && schedMonth >= 1;
    if (hasSchedule) {
      const gen = generateIndexingDatesFromSchedule({
        startDate: data.startDate,
        endDate: (data as any).extensionDate || data.endDate,
        day: schedDay,
        month: schedMonth,
        everyMonths: Number.isInteger(schedEvery) ? schedEvery : 12,
      });
      const manual = Array.isArray(data.indexingDates) ? data.indexingDates : [];
      const all = Array.from(new Set([...manual, ...gen])).sort();
      data.indexingDates = all;
      // Persist schedule fields as part of contract
      (data as any).indexingScheduleDay = schedDay;
      (data as any).indexingScheduleMonth = schedMonth;
      (data as any).indexingEveryMonths = Number.isInteger(schedEvery) && schedEvery >= 1 ? schedEvery : 12;
    }

    // Prefer uploaded file over URL, if provided
    // Multiple uploads
    const files = (formData.getAll("scanFiles") as File[]).filter((f) => f && f.size > 0);
    for (const file of files) {
      const okType = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ].includes(file.type);
      if (!okType) {
        return {
          ok: false,
          message: "Fișierele trebuie să fie PDF sau imagini",
          values: rawValues,
        };
      }
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return { ok: false, message: "Fișier prea mare (max 10MB)", values: rawValues };
      }
      const orig = file.name || "scan";
      const base = orig.replace(/\.[^.]+$/, "");
      const res = await saveScanFile(file, `${String(data.id)}-${base}`, { contractId: data.id });
      data.scans.push({ url: res.url });
    }
    const urls = (rawValues.scanUrls as string[]) || [];
    const titles = (rawValues.scanTitles as string[]) || [];
    urls.forEach((u, i) => {
      if (u) data.scans.push({ url: u, title: (titles[i] || "").trim() || undefined });
    });
    // Back-compat single scanUrl: set to first scan if available
    if (!data.scanUrl && data.scans.length > 0) data.scanUrl = data.scans[0].url;

    const parsed = ContractSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues
          .map((e: ZodIssue) => e.message)
          .join("; "),
        values: rawValues,
      };
    }

    // Enforce owner presence from selection
    if (!parsed.data.ownerId || !parsed.data.owner) {
      return {
        ok: false,
        message: "Selectează proprietarul din listă.",
        values: rawValues,
      };
    }

    // Enforce asset presence in create flow
    if (!parsed.data.assetId || !parsed.data.asset) {
      return {
        ok: false,
        message: "Selectează un asset pentru contract.",
        values: rawValues,
      };
    }

    if (!process.env.MONGODB_URI) {
      return {
        ok: false,
        message: "MongoDB nu este configurat. Adăugați MONGODB_URI în .env.",
        values: rawValues,
      };
    }

  await upsertContract(parsed.data);
    await logAction({
      action: "contract.create",
      targetType: "contract",
      targetId: parsed.data.id,
      meta: {
        assetId: (parsed.data as any).assetId,
        asset: (parsed.data as any).asset,
        name: parsed.data.name,
        owner: parsed.data.owner,
  ownerId: (parsed.data as any).ownerId,
        partner: parsed.data.partner,
        signedAt: parsed.data.signedAt,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        indexingDates: parsed.data.indexingDates,
        indexingScheduleDay: (parsed.data as any).indexingScheduleDay,
        indexingScheduleMonth: (parsed.data as any).indexingScheduleMonth,
        indexingEveryMonths: (parsed.data as any).indexingEveryMonths,
        scanUrl: parsed.data.scanUrl,
        amountEUR: parsed.data.amountEUR,
        exchangeRateRON: parsed.data.exchangeRateRON,
        tvaPercent: parsed.data.tvaPercent,
        correctionPercent: parsed.data.correctionPercent,
        rentType: parsed.data.rentType,
        monthlyInvoiceDay: parsed.data.monthlyInvoiceDay,
        yearlyInvoices: parsed.data.yearlyInvoices,
      },
    });
  // Notify subscribers
  try { await notifyContractCreated(parsed.data); } catch {}
  // Broadcast to Messages + toasts
  try {
    const scansCount = parsed.data.scans?.length ?? 0;
    const sched = (parsed.data as any).indexingScheduleDay && (parsed.data as any).indexingScheduleMonth
      ? ` • Indexare: ziua ${(parsed.data as any).indexingScheduleDay}, luna ${(parsed.data as any).indexingScheduleMonth}${(parsed.data as any).indexingEveryMonths ? ", la ${(parsed.data as any).indexingEveryMonths} luni" : ""}`
      : "";
    const fmtVal = (v: unknown) => {
      if (v === null || typeof v === "undefined") return "—";
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      try { return JSON.stringify(v); } catch { return String(v); }
    };
    const initialFields = [
      "name","partner","owner","ownerId","asset","assetId","signedAt","startDate","endDate","extensionDate","paymentDueDays",
      "indexingDates","indexingScheduleDay","indexingScheduleMonth","indexingEveryMonths","amountEUR","exchangeRateRON","tvaPercent","correctionPercent","rentType","monthlyInvoiceDay","yearlyInvoices"
    ] as const;
    const summary = initialFields
      .map((k) => `${k}: ${fmtVal((parsed.data as any)[k])}`)
      .join("; ");
    await createMessage({
      text: `Contract nou: ${parsed.data.name} • Partener: ${parsed.data.partner} • ${parsed.data.startDate} → ${parsed.data.endDate} • Scanuri: ${scansCount}${sched} • Detalii: ${summary}`,
    });
  } catch {}
  // On success, redirect to details
    redirect(`/contracts/${parsed.data.id}`);
  } catch (e: unknown) {
    // Allow Next.js redirect to bubble up to the router
    if (e && typeof e === "object" && "digest" in e) {
      const d = (e as { digest?: unknown }).digest;
      if (typeof d === "string" && d.startsWith("NEXT_REDIRECT")) {
        throw e;
      }
    }
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: string }).message) : String(e);
    return { ok: false, message: msg, values: rawValues };
  }

  return emptyState;
}
