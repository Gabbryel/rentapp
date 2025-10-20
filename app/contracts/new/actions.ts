"use server";

import { ContractSchema } from "@/lib/schemas/contract";
import { upsertContract, fetchContractById, computeFutureIndexingDates } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import { notifyContractCreated } from "@/lib/notify";
import type { ZodIssue } from "zod";
import { saveScanFile } from "@/lib/storage";
import { redirect } from "next/navigation";
import { effectiveEndDate } from "@/lib/contracts";

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
  partnerIds: (formData.getAll("partnerIds") as string[]).filter(Boolean),
  partnerNames: (formData.getAll("partnerNames") as string[]).filter((n) => typeof n === "string" && n.trim()),
  partnerShares: (formData.getAll("partnerShares") as string[]).filter(() => true),
  ownerId: (formData.get("ownerId") as string) || "",
  owner: (formData.get("owner") as string) || "",
    signedAt: (formData.get("signedAt") as string) ?? "",
    startDate: (formData.get("startDate") as string) ?? "",
    endDate: (formData.get("endDate") as string) ?? "",
  // legacy extension fields removed
  paymentDueDays: (formData.get("paymentDueDays") as string) || "",
    indexingDay: (formData.get("indexingDay") as string) || "",
    indexingMonth: (formData.get("indexingMonth") as string) || "",
    howOftenIsIndexing: (formData.get("howOftenIsIndexing") as string) || "",
  scanUrls: (formData.getAll("scanUrls") as string[]).filter(Boolean),
  scanTitles: (formData.getAll("scanTitles") as string[]).filter(() => true),
  amountEUR: (formData.get("amountEUR") as string) || "",
    exchangeRateRON: (formData.get("exchangeRateRON") as string) || "",
    tvaPercent: (formData.get("tvaPercent") as string) || "",
    correctionPercent: (formData.get("correctionPercent") as string) || "",
    rentType: (formData.get("rentType") as string) || "monthly",
    invoiceMonthMode: (formData.get("invoiceMonthMode") as string) || "current",
    monthlyInvoiceDay: (formData.get("monthlyInvoiceDay") as string) || "",
  contractExtensions: (formData.get("contractExtensions") as string) || "[]",
  // collect irregularInvoices flat fields
  ...(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < 24; i++) {
        const m = (formData.get(`irregularInvoices[${i}][month]`) as string) || "";
        const d = (formData.get(`irregularInvoices[${i}][day]`) as string) || "";
        const a = (formData.get(`irregularInvoices[${i}][amountEUR]`) as string) || "";
        if (m || d || a) {
          out[`irregularInvoices[${i}][month]`] = m;
          out[`irregularInvoices[${i}][day]`] = d;
          out[`irregularInvoices[${i}][amountEUR]`] = a;
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
      partners: (() => {
        const ids = (rawValues.partnerIds as unknown as string[]) || [];
        const names = (rawValues.partnerNames as unknown as string[]) || [];
        const shares = (rawValues.partnerShares as unknown as string[]) || [];
        const rows: { id?: string; name: string; sharePercent?: number }[] = [];
        for (let i = 0; i < Math.max(ids.length, names.length, shares.length); i++) {
          const name = (names[i] || "").trim();
          if (!name) continue;
          const id = (ids[i] || "").trim() || undefined;
          const raw = (shares[i] || "").trim();
          const pct = raw === '' ? undefined : Number(raw.replace(',', '.'));
          rows.push({ id, name, sharePercent: (typeof pct === 'number' && isFinite(pct)) ? pct : undefined });
        }
        if (rows.length === 0 && (rawValues.partner as string)) {
          rows.push({ id: (rawValues.partnerId as string) || undefined, name: rawValues.partner as string });
        }
        return rows.length > 0 ? rows : undefined;
      })(),
  ownerId: ((rawValues.ownerId as string) || undefined) as string | undefined,
  owner: (rawValues.owner as string) || "",
      signedAt: (rawValues.signedAt as string) ?? "",
      startDate: (rawValues.startDate as string) ?? "",
    endDate: (rawValues.endDate as string) ?? "",
      paymentDueDays: (() => {
        const n = Number(rawValues.paymentDueDays as string);
        return Number.isInteger(n) && n >= 0 && n <= 120 ? n : undefined;
      })(),
      // indexing settings on Contract
      indexingDay: (() => {
        const n = Number(rawValues.indexingDay as string);
        return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
      })(),
      indexingMonth: (() => {
        const n = Number(rawValues.indexingMonth as string);
        return Number.isInteger(n) && n >= 1 && n <= 12 ? n : undefined;
      })(),
      howOftenIsIndexing: (() => {
        const n = Number(rawValues.howOftenIsIndexing as string);
        return Number.isInteger(n) && n >= 1 && n <= 12 ? n : undefined;
      })(),
  scanUrl: undefined as string | undefined,
  scans: [] as { url: string; title?: string }[],
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
      irregularInvoices: (() => {
        const rows: { month: number; day: number; amountEUR: number }[] = [];
        for (let i = 0; i < 24; i++) {
          const m = Number(String(rawValues[`irregularInvoices[${i}][month]`] ?? ""));
          const d = Number(String(rawValues[`irregularInvoices[${i}][day]`] ?? ""));
          const a = Number(String(rawValues[`irregularInvoices[${i}][amountEUR]`] ?? ""));
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
      contractExtensions: (() => {
        try {
          const raw = String((rawValues as any).contractExtensions || "[]");
          const arr = JSON.parse(raw) as Array<{ docDate?: string; document?: string; extendedUntil?: string }>;
          const rows = Array.isArray(arr)
            ? arr
                .map((r) => ({
                  docDate: (r.docDate || "").trim(),
                  document: (r.document || "").trim(),
                  extendedUntil: (r.extendedUntil || "").trim(),
                }))
                .filter((r) => r.docDate && r.document && r.extendedUntil)
            : [];
          return rows.length > 0 ? rows : undefined;
        } catch {
          return undefined;
        }
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
    if (data.asset && (data.partners?.length || data.partner)) {
      const partnerNames = data.partners?.map((p) => p.name) || [data.partner];
      const partnersLabel = partnerNames.slice(0,3).join("+") + (partnerNames.length>3?`+${partnerNames.length-3}`:"");
      const baseName = `${data.asset} ${partnersLabel}`.trim();
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
    // indexing schedule removed

    // Prefer uploaded file over URL, if provided
    // Multiple uploads
    const files = (formData.getAll("scanFiles") as File[]).filter((f) => f && f.size > 0);
    // Enforce total payload limit of 2MB across all uploaded files
    const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
    if (totalSize > 2 * 1024 * 1024) {
      return { ok: false, message: "Dimensiunea totală a fișierelor depășește 2MB", values: rawValues };
    }
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
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        return { ok: false, message: "Fișier prea mare (max 2MB)", values: rawValues };
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

  // Auto-fill owner from asset if not provided
  if (data.assetId && (!data.ownerId || !data.owner)) {
    try {
      const { getAssetById } = await import("@/lib/assets");
      const asset = await getAssetById(String(data.assetId));
      if (asset && (asset as any).owner && (asset as any).ownerId) {
        data.owner = (asset as any).owner;
        data.ownerId = (asset as any).ownerId;
      }
    } catch {}
  }

  const fut = computeFutureIndexingDates(data as any);
  // Always set the first (earliest) entry's amount to the form value if provided
  const initAmount = (() => {
    const raw = (rawValues.amountEUR as string) || "";
    const n = Number((raw || "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  })();
  let indexingDates: { forecastDate: string; done: boolean; actualDate?: string; newRentAmount?: number; document?: string }[] =
    [...(fut as any[])]
      .map((r: any) => ({
        forecastDate: String(r.forecastDate),
        done: Boolean(r.done),
        actualDate: r.actualDate ? String(r.actualDate) : undefined,
        document: typeof r.document === "string" ? r.document : undefined,
        newRentAmount: typeof r.newRentAmount === "number" ? r.newRentAmount : undefined,
      }))
      .sort((a, b) => String(a.forecastDate).localeCompare(String(b.forecastDate)));
  if (typeof initAmount === "number") {
    if (indexingDates.length > 0) {
      indexingDates[0] = { ...indexingDates[0], newRentAmount: initAmount };
    } else {
      const initDate = (data.startDate as string) || (data.signedAt as string) || new Date().toISOString().slice(0, 10);
      indexingDates = [{ forecastDate: initDate, actualDate: initDate, newRentAmount: initAmount, done: false }];
    }
  }
  const parsed = ContractSchema.safeParse({ ...(data as any), indexingDates });
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
    if (!(data.ownerId) || !(data.owner)) {
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
  // Indexing schedule creation moved to Indexing model UI section
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
  // legacy indexing fields removed
        scanUrl: parsed.data.scanUrl,
        exchangeRateRON: parsed.data.exchangeRateRON,
        tvaPercent: parsed.data.tvaPercent,
        correctionPercent: parsed.data.correctionPercent,
        rentType: parsed.data.rentType,
        monthlyInvoiceDay: parsed.data.monthlyInvoiceDay,
        irregularInvoices: (parsed.data as any).irregularInvoices,
      },
    });
  // Notify subscribers
  try { await notifyContractCreated(parsed.data); } catch {}
  // Broadcast to Messages + toasts
  try {
    const scansCount = parsed.data.scans?.length ?? 0;
    const sched = ""; // indexing schedule removed
    const fmtVal = (v: unknown) => {
      if (v === null || typeof v === "undefined") return "—";
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      try { return JSON.stringify(v); } catch { return String(v); }
    };
    const initialFields = [
  "name","partner","owner","ownerId","asset","assetId","signedAt","startDate","endDate","paymentDueDays","exchangeRateRON","tvaPercent","correctionPercent","rentType","monthlyInvoiceDay","irregularInvoices","contractExtensions"
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
