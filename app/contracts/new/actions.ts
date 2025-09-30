"use server";

import { ContractSchema } from "@/lib/schemas/contract";
import { upsertContract } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
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
    partnerId: (formData.get("partnerId") as string) || "",
    partner: (formData.get("partner") as string) ?? "",
    owner: (formData.get("owner") as string) || "Markov Services s.r.l.",
    signedAt: (formData.get("signedAt") as string) ?? "",
    startDate: (formData.get("startDate") as string) ?? "",
    endDate: (formData.get("endDate") as string) ?? "",
  extensionDate: (formData.get("extensionDate") as string) || "",
  paymentDueDays: (formData.get("paymentDueDays") as string) || "",
    indexingDates: (formData.getAll("indexingDates") as string[]).filter(Boolean),
    scanUrl: (formData.get("scanUrl") as string) || "",
    amountEUR: (formData.get("amountEUR") as string) || "",
    exchangeRateRON: (formData.get("exchangeRateRON") as string) || "",
    tvaPercent: (formData.get("tvaPercent") as string) || "",
    correctionPercent: (formData.get("correctionPercent") as string) || "",
    rentType: (formData.get("rentType") as string) || "monthly",
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
      partnerId: ((rawValues.partnerId as string) || undefined) as string | undefined,
      partner: (rawValues.partner as string) ?? "",
      owner: (rawValues.owner as string) || undefined,
      signedAt: (rawValues.signedAt as string) ?? "",
      startDate: (rawValues.startDate as string) ?? "",
      endDate: (rawValues.endDate as string) ?? "",
      indexingDates: (rawValues.indexingDates as string[]) ?? [],
      extensionDate: (rawValues.extensionDate as string) || undefined,
      paymentDueDays: (() => {
        const n = Number(rawValues.paymentDueDays as string);
        return Number.isInteger(n) && n >= 0 && n <= 120 ? n : undefined;
      })(),
      scanUrl: undefined as string | undefined,
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
        const n = Number(raw);
        if (!Number.isInteger(n)) return undefined;
        if (n < 0 || n > 100) return undefined;
        return n;
      })(),
      rentType: ((): "monthly" | "yearly" =>
        String(rawValues.rentType) === "yearly" ? "yearly" : "monthly")(),
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

    // Prefer uploaded file over URL, if provided
    const uploaded = formData.get("scanFile");
    const urlInput = (formData.get("scanUrl") as string | null) || null;

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
        return {
          ok: false,
          message: "Fișierul este prea mare (max 10MB)",
          values: rawValues,
        };
      }

      const orig = file.name || "scan";
      const base = orig.replace(/\.[^.]+$/, "");

      const res = await saveScanFile(file, `${String(data.id)}-${base}`, {
        contractId: data.id,
      });
      data.scanUrl = res.url;
    } else if (urlInput) {
      data.scanUrl = urlInput || undefined;
    }

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
        name: parsed.data.name,
        owner: parsed.data.owner,
        partner: parsed.data.partner,
        signedAt: parsed.data.signedAt,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        indexingDates: parsed.data.indexingDates,
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
