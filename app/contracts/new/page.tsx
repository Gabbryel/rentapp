import { ContractSchema } from "@/lib/schemas/contract";
import { upsertContract } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import { redirect } from "next/navigation";
import type { ZodIssue } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import MultiDateInput from "@/app/components/multi-date-input";
import ExchangeRateField from "@/app/components/exchange-rate-field";

async function createContract(formData: FormData) {
  "use server";
  // Collect basic fields
  const data = {
    id: (formData.get("id") as string) || `c_${Date.now()}`,
    name: (formData.get("name") as string) ?? "",
    partner: (formData.get("partner") as string) ?? "",
    owner: (formData.get("owner") as string) || undefined,
    signedAt: (formData.get("signedAt") as string) ?? "",
    startDate: (formData.get("startDate") as string) ?? "",
    endDate: (formData.get("endDate") as string) ?? "",
    indexingDates: (formData.getAll("indexingDates") as string[]).filter(
      Boolean
    ),
    scanUrl: undefined as string | undefined,
    amountEUR: (() => {
      const raw = (formData.get("amountEUR") as string) || "";
      const n = Number(raw.replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    exchangeRateRON: (() => {
      const raw = (formData.get("exchangeRateRON") as string) || "";
      const n = Number(raw.replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    tvaPercent: (() => {
      const raw = (formData.get("tvaPercent") as string) || "";
      const n = Number(raw);
      if (!Number.isInteger(n)) return undefined;
      if (n < 0 || n > 100) return undefined;
      return n;
    })(),
    correctionPercent: (() => {
      const raw = (formData.get("correctionPercent") as string) || "";
      const n = Number(raw);
      if (!Number.isInteger(n)) return undefined;
      if (n < 0 || n > 100) return undefined;
      return n;
    })(),
  };

  // Prefer uploaded file over URL, if provided
  const uploaded = formData.get("scanFile");
  const urlInput = (formData.get("scanUrl") as string | null) || null;

  // Utility: simple slugify and extension derivation
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const extFromMime = (mime: string) => {
    if (mime === "application/pdf") return "pdf";
    if (mime === "image/png") return "png";
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/gif") return "gif";
    if (mime === "image/webp") return "webp";
    if (mime === "image/svg+xml") return "svg";
    return null;
  };

  if (uploaded && uploaded instanceof File && uploaded.size > 0) {
    const file = uploaded as File;
    // Enforce type and size limits (10 MB)
    const okType = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ].includes(file.type);
    if (!okType) {
      throw new Error(
        "Fișierul trebuie să fie PDF sau imagine (png/jpg/jpeg/gif/webp/svg)"
      );
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("Fișierul este prea mare (max 10MB)");
    }

    const orig = file.name || "scan";
    const base = sanitize(orig.replace(/\.[^.]+$/, "")) || "scan";
    const fromNameExtMatch = /\.([a-z0-9]+)$/i.exec(orig ?? "");
    const ext = (
      fromNameExtMatch?.[1] ||
      extFromMime(file.type) ||
      "dat"
    ).toLowerCase();

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `${sanitize(data.id)}-${base}.${ext}`;
    const filepath = path.join(uploadsDir, filename);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filepath, Buffer.from(arrayBuffer));
    data.scanUrl = `/uploads/${filename}`;
  } else if (urlInput) {
    data.scanUrl = urlInput || undefined;
  }

  const parsed = ContractSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((e: ZodIssue) => e.message).join("; ")
    );
  }

  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    throw new Error(
      "MongoDB nu este configurat. Adăugați MONGODB_URI și MONGODB_DB în .env."
    );
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
    },
  });
  redirect(`/contracts/${parsed.data.id}`);
}

export default function NewContractPage() {
  const mongoConfigured = Boolean(
    process.env.MONGODB_URI && process.env.MONGODB_DB
  );
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold">Adaugă contract</h1>
      {!mongoConfigured && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          MongoDB nu este configurat. Completați variabilele MONGODB_URI și
          MONGODB_DB în .env pentru a salva.
        </p>
      )}

      <form
        action={createContract}
        className="mt-6 max-w-xl space-y-4"
        encType="multipart/form-data"
      >
        <div>
          <label className="block text-sm font-medium">ID (opțional)</label>
          <input
            name="id"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Sumă (EUR)</label>
            <input
              name="amountEUR"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="ex: 1200"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <ExchangeRateField name="exchangeRateRON" />
          <div>
            <label className="block text-sm font-medium">TVA (%)</label>
            <input
              name="tvaPercent"
              type="number"
              step="1"
              min="0"
              max="100"
              inputMode="numeric"
              placeholder="ex: 19"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Corecție (%)</label>
            <input
              name="correctionPercent"
              type="number"
              step="1"
              min="0"
              max="100"
              inputMode="numeric"
              placeholder="ex: 10"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Proprietar</label>
          <select
            name="owner"
            defaultValue="Markov Services s.r.l."
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          >
            <option value="Markov Services s.r.l.">
              Markov Services s.r.l.
            </option>
            <option value="MKS Properties s.r.l.">MKS Properties s.r.l.</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Nume</label>
          <input
            name="name"
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Partener</label>
          <input
            name="partner"
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Semnat</label>
            <input
              type="date"
              name="signedAt"
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Început</label>
            <input
              type="date"
              name="startDate"
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Expiră</label>
            <input
              type="date"
              name="endDate"
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <MultiDateInput name="indexingDates" />
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium">
              Încarcă scan (PDF sau imagine)
            </label>
            <input
              type="file"
              name="scanFile"
              accept="application/pdf,image/*"
              className="mt-1 block w-full text-sm"
            />
            <p className="mt-1 text-xs text-foreground/60">
              Max 10MB. Tipuri permise: PDF, PNG, JPG/JPEG, GIF, WEBP, SVG.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium">sau introdu URL</label>
            <input
              name="scanUrl"
              placeholder="/uploads/contract.pdf sau https://exemplu.com/contract.pdf"
              pattern=".*\.(pdf|png|jpe?g|gif|webp|svg)(?:$|[?#]).*"
              title="Acceptat: PDF sau imagine (png, jpg, jpeg, gif, webp, svg)"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-foreground/60">
              Dacă alegi fișier, acesta va avea prioritate față de URL.
            </p>
          </div>
        </div>
        <div className="pt-2">
          <button
            disabled={!mongoConfigured}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Salvează
          </button>
        </div>
      </form>
    </main>
  );
}
