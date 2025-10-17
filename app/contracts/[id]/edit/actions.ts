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
import { effectiveEndDate, computeFutureIndexingDates } from "@/lib/contracts";

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
  partnerIds: (formData.getAll("partnerIds") as string[]).filter(Boolean),
  partnerNames: (formData.getAll("partnerNames") as string[]).filter((n) => typeof n === "string" && n.trim()),
  ownerId: (formData.get("ownerId") as string) || "",
  owner: (formData.get("owner") as string) || "",
    signedAt: (formData.get("signedAt") as string) ?? "",
    startDate: (formData.get("startDate") as string) ?? "",
    endDate: (formData.get("endDate") as string) ?? "",
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
  // indexing schedule settings on Contract
  indexingDay: (formData.get("indexingDay") as string) || "",
  indexingMonth: (formData.get("indexingMonth") as string) || "",
  howOftenIsIndexing: (formData.get("howOftenIsIndexing") as string) || "",
  contractExtensions: (formData.get("contractExtensions") as string) || "[]",
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

    const parsedAmountEUR = (() => {
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
    if (typeof parsedAmountEUR === "number" && typeof exchangeRateRON !== "number") {
      if (typeof prev.exchangeRateRON === "number") {
        exchangeRateRON = prev.exchangeRateRON;
      } else {
        try {
          const { rate } = await getDailyEurRon({ forceRefresh: false });
          if (Number.isFinite(rate) && rate > 0) exchangeRateRON = rate;
        } catch {}
      }
    }
    if (typeof exchangeRateRON === "number" && typeof parsedAmountEUR !== "number") {
      if (typeof (prev as any).rentAmountEuro === "number") {
        // no-op: amount now derived from history; keep previous for compatibility when needed
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
        return { ok: false, message: "Fișierele trebuie să fie PDF sau imagini", values: rawValues };
      }
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        return { ok: false, message: "Fișier prea mare (max 2MB)", values: rawValues };
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
  partners: (() => {
    const ids = (rawValues.partnerIds as any as string[]) || [];
    const names = (rawValues.partnerNames as any as string[]) || [];
    const rows: { id?: string; name: string }[] = [];
    for (let i=0;i<Math.max(ids.length, names.length);i++) {
      const name = (names[i]||"").trim();
      if (!name) continue;
      const id = (ids[i]||"").trim() || undefined;
      rows.push({ id, name });
    }
    if (rows.length === 0 && rawValues.partner) rows.push({ id: rawValues.partnerId || undefined, name: rawValues.partner });
    return rows.length>0 ? rows : undefined;
  })(),
  ownerId: rawValues.ownerId || undefined,
  owner: rawValues.owner,
      signedAt: rawValues.signedAt,
      startDate: rawValues.startDate,
    endDate: rawValues.endDate,
      paymentDueDays: (() => {
        const n = Number(String(rawValues.paymentDueDays));
        return Number.isInteger(n) && n >= 0 && n <= 120 ? n : undefined;
      })(),
      // indexing settings on Contract
      indexingDay: (() => {
        const n = Number(String(rawValues.indexingDay));
        return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
      })(),
      indexingMonth: (() => {
        const n = Number(String(rawValues.indexingMonth));
        return Number.isInteger(n) && n >= 1 && n <= 12 ? n : undefined;
      })(),
      howOftenIsIndexing: (() => {
        const n = Number(String(rawValues.howOftenIsIndexing));
        return Number.isInteger(n) && n >= 1 && n <= 12 ? n : undefined;
      })(),
  // legacy indexing dates removed
  scans: nextScans,
  // Back-compat single field derived from first scan
  scanUrl: nextScans.length > 0 ? nextScans[0].url : prev.scanUrl ?? undefined,
  // amount now derived from rentHistory; keep for compatibility in upsert logic
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
    } as Record<string, unknown>;

    // Recompute name from asset + partner if present
    if (typeof base.asset === "string" && base.asset) {
      const partnersArr = Array.isArray((base as any).partners) ? (base as any).partners as {name:string}[] : (base.partner ? [{name: String(base.partner)}] : []);
      if (partnersArr.length>0) {
        const names = partnersArr.map(p=>p.name);
        const label = names.slice(0,3).join("+") + (names.length>3?`+${names.length-3}`:"");
        base.name = `${base.asset} ${label}`.trim();
      }
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

  // Recompute futureIndexingDates and ensure the first entry has the Suma EUR value
  const fut = computeFutureIndexingDates(parsed.data as any);
  const initAmount = parsedAmountEUR;
  const initDate = parsed.data.startDate || parsed.data.signedAt;
  const init = typeof initAmount === "number"
    ? [{ forecastDate: initDate, actualDate: initDate, newRentAmount: initAmount, done: true }]
    : [];
  const byDate = new Map<string, any>();
  for (const r of [...init, ...fut]) byDate.set(r.forecastDate, r);
  const indexingDates = Array.from(byDate.values()).sort((a, b) => String(a.forecastDate).localeCompare(String(b.forecastDate)));
  await upsertContract({ ...(parsed.data as any), indexingDates } as any);
  // Indexing model upsert removed; schedule is kept on Contract
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
    // No Indexing model writes here (model changed)
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
