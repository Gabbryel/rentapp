"use server";

import { fetchContractById, upsertContract } from "@/lib/contracts";
import { ContractSchema } from "@/lib/schemas/contract";
import { logAction, computeDiffContract } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import type { ZodIssue } from "zod";
import { saveScanFile, deleteScanByUrl } from "@/lib/storage";
import { notifyContractUpdated } from "@/lib/notify";
import { getDailyEurRon } from "@/lib/exchange";
import { redirect } from "next/navigation";

export type EditFormState = {
  ok: boolean;
  message?: string;
  values: Record<string, unknown>;
};

export async function updateContractAction(
  prevState: EditFormState,
  formData: FormData
): Promise<EditFormState> {
  const id = (formData.get("id") as string) || "";
  const rawValues = {
    id,
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
    amountEUR: (formData.get("amountEUR") as string) || "",
    exchangeRateRON: (formData.get("exchangeRateRON") as string) || "",
    tvaPercent: (formData.get("tvaPercent") as string) || "",
    correctionPercent: (formData.get("correctionPercent") as string) || "",
  // legacy indexing fields removed
    // Multi-scan edit fields
    existingUrl: (formData.getAll("existingUrl") as string[]) || [],
    existingTitle: (formData.getAll("existingTitle") as string[]) || [],
    existingRemoveIdx: (formData.getAll("existingRemoveIdx") as string[]) || [],
    scanUrls: (formData.getAll("scanUrls") as string[]).filter(Boolean),
    scanTitles: (formData.getAll("scanTitles") as string[]).filter(() => true),
    rentType: (formData.get("rentType") as string) || "",
  invoiceMonthMode: (formData.get("invoiceMonthMode") as string) || "current",
    monthlyInvoiceDay: (formData.get("monthlyInvoiceDay") as string) || "",
    // yearly invoices rows
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
    const prev = await fetchContractById(id);
    if (!prev) {
      return { ok: false, message: "Contract inexistent", values: rawValues };
    }

    let amountEUR = (() => {
      const n = Number(String(rawValues.amountEUR).replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })();
    let exchangeRateRON = (() => {
      const n = Number(String(rawValues.exchangeRateRON).replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })();
    const tvaPercent = (() => {
      const n = Number(String(rawValues.tvaPercent));
      if (!Number.isInteger(n)) return undefined;
      if (n < 0 || n > 100) return undefined;
      return n;
    })();
    const correctionPercent = (() => {
      const n = Number(String(rawValues.correctionPercent).replace(",", "."));
      if (!Number.isFinite(n)) return undefined;
      if (n < 0 || n > 100) return undefined;
      return Math.round(n * 10000) / 10000;
    })();

    // Autofill logic similar to server page
    if (typeof amountEUR === "number" && typeof exchangeRateRON !== "number") {
      if (typeof prev.exchangeRateRON === "number") {
        exchangeRateRON = prev.exchangeRateRON;
      } else {
        try {
          const { rate } = await getDailyEurRon({ forceRefresh: false });
          if (Number.isFinite(rate) && rate > 0) exchangeRateRON = rate;
        } catch {}
      }
    }
    if (typeof exchangeRateRON === "number" && typeof amountEUR !== "number") {
      if (typeof prev.amountEUR === "number") {
        amountEUR = prev.amountEUR;
      }
    }

    // Multi-scan processing
    const existingUrls = (rawValues.existingUrl as string[]) || [];
    const existingTitles = (rawValues.existingTitle as string[]) || [];
    const removeIdxSet = new Set(((rawValues.existingRemoveIdx as string[]) || []).map((s) => String(s)));

    const nextScans: { url: string; title?: string }[] = [];
    const removedUrls: string[] = [];
    for (let i = 0; i < existingUrls.length; i++) {
      const url = existingUrls[i];
      const title = (existingTitles[i] || "").trim() || undefined;
      if (removeIdxSet.has(String(i))) {
        removedUrls.push(url);
      } else if (url) {
        nextScans.push({ url, title });
      }
    }
    // Delete removed from storage best-effort
    for (const u of removedUrls) {
      try { await deleteScanByUrl(u); } catch {}
    }
    // New uploads
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
        return { ok: false, message: "Fișierele trebuie să fie PDF sau imagini", values: rawValues };
      }
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return { ok: false, message: "Fișier prea mare (max 10MB)", values: rawValues };
      }
      const orig = file.name || "scan";
      const base = orig.replace(/\.[^.]+$/, "");
      const res = await saveScanFile(file, `${String(id)}-${base}`, { contractId: id });
      nextScans.push({ url: res.url });
    }
    // New URLs
    const urls = (rawValues.scanUrls as string[]) || [];
    const titles = (rawValues.scanTitles as string[]) || [];
    urls.forEach((u, i) => {
      if (u) nextScans.push({ url: u, title: (titles[i] || "").trim() || undefined });
    });

    const base = {
      id,
      name: rawValues.name,
      assetId: rawValues.assetId || undefined,
      asset: rawValues.asset || undefined,
      partnerId: rawValues.partnerId || undefined,
  partner: rawValues.partner,
  ownerId: rawValues.ownerId || undefined,
  owner: rawValues.owner,
      signedAt: rawValues.signedAt,
      startDate: rawValues.startDate,
      endDate: rawValues.endDate,
      extensionDate: rawValues.extensionDate || undefined,
  extendedAt: (rawValues as any).extendedAt || undefined,
      paymentDueDays: (() => {
        const n = Number(String(rawValues.paymentDueDays));
        return Number.isInteger(n) && n >= 0 && n <= 120 ? n : undefined;
      })(),
  // legacy indexing dates removed
  scans: nextScans,
  // Back-compat single field derived from first scan
  scanUrl: nextScans.length > 0 ? nextScans[0].url : prev.scanUrl ?? undefined,
      amountEUR,
      exchangeRateRON,
      tvaPercent,
      correctionPercent,
      rentType: String(rawValues.rentType) === "yearly" ? "yearly" : "monthly",
      invoiceMonthMode:
        String((rawValues as any).invoiceMonthMode) === "next"
          ? "next"
          : "current",
      monthlyInvoiceDay: (() => {
        const n = Number(String(rawValues.monthlyInvoiceDay));
        return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
      })(),
      yearlyInvoices: (() => {
        const rows: { month: number; day: number; amountEUR: number }[] = [];
        for (let i = 0; i < 24; i++) {
          const m = Number(String(formData.get(`yearlyInvoices[${i}][month]`) ?? ""));
          const d = Number(String(formData.get(`yearlyInvoices[${i}][day]`) ?? ""));
          const a = Number(String(formData.get(`yearlyInvoices[${i}][amountEUR]`) ?? ""));
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
    } as Record<string, unknown>;

    // Recompute name from asset + partner if present
    if (typeof base.asset === "string" && base.asset && typeof base.partner === "string" && base.partner) {
      base.name = `${base.asset} ${base.partner}`.trim();
    }

  // (indexing schedule feature removed)

    const parsed = ContractSchema.safeParse(base);

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues.map((e: ZodIssue) => e.message).join("; "),
        values: rawValues,
      };
    }

    if (!parsed.data.ownerId || !parsed.data.owner) {
      return { ok: false, message: "Selectează proprietarul din listă.", values: rawValues };
    }

    if (!parsed.data.assetId || !parsed.data.asset) {
      return { ok: false, message: "Selectează un asset pentru contract.", values: rawValues };
    }

    if (!process.env.MONGODB_URI) {
      return { ok: false, message: "MongoDB nu este configurat.", values: rawValues };
    }

    const { changes, scanChange } = computeDiffContract(prev, parsed.data);

    await upsertContract(parsed.data);
    await logAction({
      action: "contract.update",
      targetType: "contract",
      targetId: id,
      meta: {
        assetId: (parsed.data as any).assetId,
        asset: (parsed.data as any).asset,
        name: parsed.data.name,
        changes,
  scanChange,
  scansCount: parsed.data.scans?.length ?? 0,
    owner: parsed.data.owner,
    ownerId: (parsed.data as any).ownerId,
  // schedule fields removed
        rentType: parsed.data.rentType,
        monthlyInvoiceDay: parsed.data.monthlyInvoiceDay,
        yearlyInvoices: parsed.data.yearlyInvoices,
      },
    });
      try { await notifyContractUpdated(parsed.data); } catch {}
      try {
        const scansBefore = Array.isArray(prev.scans) ? prev.scans.length : 0;
        const scansAfter = parsed.data.scans?.length ?? 0;
        const scansDelta = scansAfter - scansBefore;
        const scanChangeLabel = scanChange && scanChange !== "none" ? ` • scanUrl: ${scanChange}` : "";
  const sched = ""; // schedule removed
        const fmtVal = (v: unknown) => {
          if (v === null || typeof v === "undefined") return "—";
          if (typeof v === "string") return v;
          if (typeof v === "number" || typeof v === "boolean") return String(v);
          try { return JSON.stringify(v); } catch { return String(v); }
        };
        const changedFields = changes
          .map((c) => `${c.field}: ${fmtVal(c.from)} → ${fmtVal(c.to)}`)
          .join("; ");
        const diffSection = changedFields ? ` • Modificări: ${changedFields}` : "";
        await createMessage({
          text: `Contract actualizat: ${parsed.data.name} • Partener: ${parsed.data.partner} • ${parsed.data.startDate} → ${parsed.data.endDate} • Scanuri: ${scansBefore} → ${scansAfter} (${scansDelta >= 0 ? "+" : ""}${scansDelta})${scanChangeLabel}${sched}${diffSection}`,
        });
      } catch {}

    redirect(`/contracts/${id}`);
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
}
