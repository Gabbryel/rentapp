"use server";

import { fetchContractById, upsertContract } from "@/lib/contracts";
import { ContractSchema } from "@/lib/schemas/contract";
import { logAction, computeDiffContract } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import type { ZodIssue } from "zod";
import { notifyContractUpdated } from "@/lib/notify";
import { getDailyEurRon } from "@/lib/exchange";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { computeFutureIndexingDates } from "@/lib/contracts";
import { netFromGross } from "@/lib/utils/vat";

export type EditFormValues = {
  id: string;
  name: string;
  assetId: string;
  asset: string;
  partnerId: string;
  partner: string;
  partnerIds: string[];
  partnerNames: string[];
  partnerShares: string[];
  ownerId: string;
  owner: string;
  signedAt: string;
  startDate: string;
  endDate: string;
  paymentDueDays: string;
  amountEUR: string;
  exchangeRateRON: string;
  tvaPercent: string;
  tvaType: string;
  correctionPercent: string;
  rentType: string;
  invoiceMonthMode: string;
  monthlyInvoiceDay: string;
  indexingDay: string;
  indexingMonth: string;
  howOftenIsIndexing: string;
  contractExtensions: string;
  customInvoices: Array<{ date: string; amountEUR: string }>;
};

export type EditFormState = {
  ok: boolean;
  message?: string;
  values: Partial<EditFormValues>;
};

export async function updateContractAction(
  prevState: EditFormState,
  formData: FormData
): Promise<EditFormState> {
  const id = (formData.get("id") as string) || "";
  const getText = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const getAllText = (key: string) =>
    formData
      .getAll(key)
      .map((value) => (typeof value === "string" ? value : String(value)));

  const customInvoices: EditFormValues["customInvoices"] = [];
  for (let i = 0; i < 24; i++) {
    const date = getText(`customInvoices[${i}][date]`);
    const amountEUR = getText(`customInvoices[${i}][amountEUR]`);
    if (date || amountEUR) {
      customInvoices.push({ date, amountEUR });
    }
  }

  const rawValues: EditFormValues = {
    id,
    name: getText("name"),
    assetId: getText("assetId"),
    asset: getText("asset"),
    partnerId: getText("partnerId"),
    partner: getText("partner"),
    partnerIds: getAllText("partnerIds"),
    partnerNames: getAllText("partnerNames"),
    partnerShares: getAllText("partnerShares"),
    ownerId: getText("ownerId"),
    owner: getText("owner"),
    signedAt: getText("signedAt"),
    startDate: getText("startDate"),
    endDate: getText("endDate"),
    paymentDueDays: getText("paymentDueDays"),
    amountEUR: getText("amountEUR"),
    exchangeRateRON: getText("exchangeRateRON"),
    tvaPercent: getText("tvaPercent"),
    tvaType: getText("tvaType"),
    correctionPercent: getText("correctionPercent"),
    rentType: getText("rentType"),
    invoiceMonthMode: getText("invoiceMonthMode") || "current",
    monthlyInvoiceDay: getText("monthlyInvoiceDay"),
    indexingDay: getText("indexingDay"),
    indexingMonth: getText("indexingMonth"),
    howOftenIsIndexing: getText("howOftenIsIndexing"),
    contractExtensions: getText("contractExtensions") || "[]",
    customInvoices,
  };

  try {
    const prev = await fetchContractById(id);
    if (!prev) {
      return { ok: false, message: "Contract inexistent", values: rawValues };
    }

    const parsedAmountEUR = (() => {
      const n = Number(String(rawValues.amountEUR).replace(",", "."));
      if (!(Number.isFinite(n) && n > 0)) return undefined;
      // "gross" = entered with VAT included; store the canonical net amount
      if (getText("amountVatMode") === "gross") {
        const tva = Number(getText("tvaPercent"));
        return netFromGross(n, Number.isInteger(tva) ? tva : undefined);
      }
      return n;
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
    // Scans are managed on the contract page (ManageContractScans); this form
    // has no scan inputs, so keep the stored ones untouched.
    const nextScans: { url: string; title?: string }[] = Array.isArray(prev.scans)
      ? prev.scans
      : [];

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
    const shares = (rawValues.partnerShares as any as string[]) || [];
    const rows: { id?: string; name: string; sharePercent?: number }[] = [];
    for (let i=0;i<Math.max(ids.length, names.length, shares.length);i++) {
      const name = (names[i]||"").trim();
      if (!name) continue;
      const id = (ids[i]||"").trim() || undefined;
      const raw = (shares[i]||"").trim();
      const pct = raw === '' ? undefined : Number(raw.replace(',', '.'));
      rows.push({ id, name, sharePercent: (typeof pct === 'number' && isFinite(pct)) ? pct : undefined });
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
      tvaType: (() => {
        const trimmed = rawValues.tvaType.trim();
        return trimmed ? trimmed : undefined;
      })(),
      tvaPercent,
      correctionPercent,
      rentType:
        String(rawValues.rentType) === "custom" ||
        String(rawValues.rentType) === "yearly"
          ? "custom"
          : "monthly",
      invoiceMonthMode:
        String((rawValues as any).invoiceMonthMode) === "next"
          ? "next"
          : "current",
      monthlyInvoiceDay: (() => {
        const n = Number(String(rawValues.monthlyInvoiceDay));
        return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
      })(),
      customInvoices: (() => {
        const rows: { date: string; amountEUR: number }[] = [];
        for (let i = 0; i < 24; i++) {
          const dt = String(formData.get(`customInvoices[${i}][date]`) ?? "").trim();
          const a = Number(String(formData.get(`customInvoices[${i}][amountEUR]`) ?? "").replace(",", "."));
          if (/^\d{4}-\d{2}-\d{2}$/.test(dt) && Number.isFinite(a) && a > 0) {
            rows.push({ date: dt, amountEUR: a });
          }
        }
        // Fallback to the stored schedule so a save from this form never wipes it
        if (rows.length === 0) {
          return Array.isArray((prev as any).customInvoices)
            ? ((prev as any).customInvoices as { date: string; amountEUR: number }[])
            : undefined;
        }
        return rows;
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

    // Auto-fill owner from asset if not provided
    let parsedData: any = parsed.success ? parsed.data : base;
    if ((!parsedData.ownerId || !parsedData.owner) && parsedData.assetId) {
      try {
        const { getAssetById } = await import("@/lib/assets");
        const asset = await getAssetById(String(parsedData.assetId));
        if (asset && (asset as any).owner && (asset as any).ownerId) {
          parsedData.owner = (asset as any).owner;
          parsedData.ownerId = (asset as any).ownerId;
        }
      } catch {}
    }
    if (!parsedData.ownerId || !parsedData.owner) {
      return { ok: false, message: "Selectează proprietarul din listă.", values: rawValues };
    }

    if (!parsed.data.assetId || !parsed.data.asset) {
      return { ok: false, message: "Selectează un asset pentru contract.", values: rawValues };
    }

    if (!process.env.MONGODB_URI) {
      return { ok: false, message: "MongoDB nu este configurat.", values: rawValues };
    }

    const { changes, scanChange } = computeDiffContract(prev, parsedData);

  // Recompute futureIndexingDates and ensure the first (earliest) entry receives Suma EUR if provided
  const fut = computeFutureIndexingDates(parsedData as any);
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
  if (typeof parsedAmountEUR === "number") {
    if (indexingDates.length > 0) {
      indexingDates[0] = { ...indexingDates[0], newRentAmount: parsedAmountEUR };
    } else {
      const initDate = parsed.data.startDate || parsed.data.signedAt;
      indexingDates = [{ forecastDate: initDate, actualDate: initDate, newRentAmount: parsedAmountEUR, done: false }];
    }
  }
  await upsertContract({ ...(parsedData as any), indexingDates } as any);
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
    owner: parsedData.owner,
    ownerId: (parsedData as any).ownerId,
  // schedule fields removed
        rentType: parsedData.rentType,
        monthlyInvoiceDay: parsedData.monthlyInvoiceDay,
        customInvoices: (parsedData as any).customInvoices,
      },
    });
    // No Indexing model writes here (model changed)
      try { await notifyContractUpdated(parsed.data); } catch {}
      try {
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
          text: `Contract actualizat: ${parsed.data.name} • Partener: ${parsed.data.partner} • ${parsed.data.startDate} → ${parsed.data.endDate}${diffSection}`,
        });
      } catch {}

    revalidatePath("/");
    revalidatePath("/contracts");
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
