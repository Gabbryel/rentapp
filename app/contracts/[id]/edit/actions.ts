"use server";

import { fetchContractById, upsertContract } from "@/lib/contracts";
import { ContractSchema } from "@/lib/schemas/contract";
import { logAction, computeDiffContract } from "@/lib/audit";
import type { ZodIssue } from "zod";
import { saveScanFile, deleteScanByUrl } from "@/lib/storage";
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
    partnerId: (formData.get("partnerId") as string) || "",
    partner: (formData.get("partner") as string) ?? "",
    owner: (formData.get("owner") as string) || "Markov Services s.r.l.",
    signedAt: (formData.get("signedAt") as string) ?? "",
    startDate: (formData.get("startDate") as string) ?? "",
    endDate: (formData.get("endDate") as string) ?? "",
    extensionDate: (formData.get("extensionDate") as string) || "",
  paymentDueDays: (formData.get("paymentDueDays") as string) || "",
    amountEUR: (formData.get("amountEUR") as string) || "",
    exchangeRateRON: (formData.get("exchangeRateRON") as string) || "",
    tvaPercent: (formData.get("tvaPercent") as string) || "",
    correctionPercent: (formData.get("correctionPercent") as string) || "",
    indexingDates: (formData.getAll("indexingDates") as string[]).filter(Boolean),
    existingScanUrl: (formData.get("existingScanUrl") as string) || "",
    scanUrl: (formData.get("scanUrl") as string) || "",
    rentType: (formData.get("rentType") as string) || "",
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
      const n = Number(String(rawValues.correctionPercent));
      if (!Number.isInteger(n)) return undefined;
      if (n < 0 || n > 100) return undefined;
      return n;
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

    let scanUrl: string | undefined = rawValues.existingScanUrl || undefined;
    const uploaded = formData.get("scanFile");
    const urlInput = rawValues.scanUrl || null;
    if (uploaded && uploaded instanceof File && uploaded.size > 0) {
      const file = uploaded as File;
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
          message:
            "Fișierul trebuie să fie PDF sau imagine (png/jpg/jpeg/gif/webp/svg)",
          values: rawValues,
        };
      }
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return { ok: false, message: "Fișierul este prea mare (max 10MB)", values: rawValues };
      }
      const orig = file.name || "scan";
      const base = orig.replace(/\.[^.]+$/, "");
      const res = await saveScanFile(file, `${String(id)}-${base}`, { contractId: id });
      scanUrl = res.url;
    } else if (urlInput) {
      scanUrl = urlInput || undefined;
    }

    const parsed = ContractSchema.safeParse({
      id,
      name: rawValues.name,
      partnerId: rawValues.partnerId || undefined,
      partner: rawValues.partner,
      owner: rawValues.owner,
      signedAt: rawValues.signedAt,
      startDate: rawValues.startDate,
      endDate: rawValues.endDate,
      extensionDate: rawValues.extensionDate || undefined,
      paymentDueDays: (() => {
        const n = Number(String(rawValues.paymentDueDays));
        return Number.isInteger(n) && n >= 0 && n <= 120 ? n : undefined;
      })(),
      indexingDates: rawValues.indexingDates,
      scanUrl,
      amountEUR,
      exchangeRateRON,
      tvaPercent,
      correctionPercent,
      rentType: String(rawValues.rentType) === "yearly" ? "yearly" : "monthly",
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
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues.map((e: ZodIssue) => e.message).join("; "),
        values: rawValues,
      };
    }

    if (!process.env.MONGODB_URI) {
      return { ok: false, message: "MongoDB nu este configurat.", values: rawValues };
    }

    const { changes, scanChange } = computeDiffContract(prev, parsed.data);
    if (scanChange === "removed" || scanChange === "replaced") {
      await deleteScanByUrl(prev.scanUrl ?? undefined);
    }

    await upsertContract(parsed.data);
    await logAction({
      action: "contract.update",
      targetType: "contract",
      targetId: id,
      meta: {
        name: parsed.data.name,
        changes,
        scanChange,
        rentType: parsed.data.rentType,
        monthlyInvoiceDay: parsed.data.monthlyInvoiceDay,
        yearlyInvoices: parsed.data.yearlyInvoices,
      },
    });

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
