import { fetchContractById, upsertContract } from "@/lib/contracts";
import { ContractSchema } from "@/lib/schemas/contract";
import {
  logAction,
  computeDiffContract,
  deleteLocalUploadIfPresent,
} from "@/lib/audit";
import { notFound, redirect } from "next/navigation";
import type { ZodIssue } from "zod";
import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import MultiDateInput from "@/app/components/multi-date-input";
import ExchangeRateField from "@/app/components/exchange-rate-field";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await fetchContractById(id);
  if (!contract) return notFound();
  const prevContract = contract as NonNullable<typeof contract>;

  async function updateContract(formData: FormData) {
    "use server";
    const idFromParam = id;
    const name = (formData.get("name") as string) ?? "";
    const partner = (formData.get("partner") as string) ?? "";
    const owner = (formData.get("owner") as string) || undefined;
    const signedAt = (formData.get("signedAt") as string) ?? "";
    const startDate = (formData.get("startDate") as string) ?? "";
    const endDate = (formData.get("endDate") as string) ?? "";
    const amountEURRaw = (formData.get("amountEUR") as string) || "";
    const exchangeRateRONRaw =
      (formData.get("exchangeRateRON") as string) || "";
    const tvaRaw = (formData.get("tvaPercent") as string) || "";
    const amountEUR = (() => {
      const n = Number(amountEURRaw.replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })();
    const exchangeRateRON = (() => {
      const n = Number(exchangeRateRONRaw.replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })();
    const tvaPercent = (() => {
      const n = Number(tvaRaw);
      if (!Number.isInteger(n)) return undefined;
      if (n < 0 || n > 100) return undefined;
      return n;
    })();
    const existingScanUrl =
      (formData.get("existingScanUrl") as string) || undefined;
    const indexingDates = (formData.getAll("indexingDates") as string[]).filter(
      Boolean
    );
    const uploaded = formData.get("scanFile");
    const urlInput = (formData.get("scanUrl") as string | null) || null;

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

    let scanUrl: string | undefined = existingScanUrl;
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
      const filename = `${sanitize(idFromParam)}-${base}.${ext}`;
      const filepath = path.join(uploadsDir, filename);
      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(filepath, Buffer.from(arrayBuffer));
      scanUrl = `/uploads/${filename}`;
    } else if (urlInput) {
      scanUrl = urlInput || undefined;
    }

    const parsed = ContractSchema.safeParse({
      id: idFromParam,
      name,
      partner,
      owner,
      signedAt,
      startDate,
      endDate,
      indexingDates,
      scanUrl,
      amountEUR,
      exchangeRateRON,
      tvaPercent,
    });
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

    // Compute diff against previous contract for auditing
    const { changes, scanChange } = computeDiffContract(
      prevContract,
      parsed.data
    );

    // If the scan was removed or replaced, try to delete old local file
    let scanDeletion:
      | { deleted: boolean; reason: string; path?: string }
      | undefined;
    if (scanChange === "removed" || scanChange === "replaced") {
      scanDeletion = await deleteLocalUploadIfPresent(
        prevContract.scanUrl ?? undefined
      );
    }

    await upsertContract(parsed.data);
    await logAction({
      action: "contract.update",
      targetType: "contract",
      targetId: idFromParam,
      meta: {
        name: parsed.data.name,
        changes,
        scanChange,
        deletedScan: scanDeletion,
      },
    });
    redirect(`/contracts/${idFromParam}`);
  }

  const mongoConfigured = Boolean(
    process.env.MONGODB_URI && process.env.MONGODB_DB
  );

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Editează contract</h1>
        <Link
          href={`/contracts/${contract.id}`}
          className="text-sm text-foreground/70 hover:underline"
        >
          ← Înapoi la contract
        </Link>
      </div>
      {!mongoConfigured && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          MongoDB nu este configurat. Completați variabilele MONGODB_URI și
          MONGODB_DB în .env pentru a salva.
        </p>
      )}

      <form
        action={updateContract}
        className="mt-6 max-w-xl space-y-4"
        encType="multipart/form-data"
      >
        <div>
          <label className="block text-sm font-medium">ID</label>
          <input
            name="id"
            defaultValue={contract.id}
            readOnly
            disabled
            className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
          />
          <input
            type="hidden"
            name="existingScanUrl"
            defaultValue={contract.scanUrl || ""}
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
              defaultValue={
                typeof contract.amountEUR === "number"
                  ? String(contract.amountEUR)
                  : ""
              }
              placeholder="ex: 1200"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <ExchangeRateField
            name="exchangeRateRON"
            defaultValue={
              typeof contract.exchangeRateRON === "number"
                ? String(contract.exchangeRateRON)
                : ""
            }
          />
          <div>
            <label className="block text-sm font-medium">TVA (%)</label>
            <input
              name="tvaPercent"
              type="number"
              step="1"
              min="0"
              max="100"
              inputMode="numeric"
              defaultValue={
                typeof contract.tvaPercent === "number"
                  ? String(contract.tvaPercent)
                  : ""
              }
              placeholder="ex: 19"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Nume</label>
          <input
            name="name"
            defaultValue={contract.name}
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Partener</label>
          <input
            name="partner"
            defaultValue={contract.partner}
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Proprietar</label>
          <select
            name="owner"
            defaultValue={contract.owner ?? "Markov Services s.r.l."}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          >
            <option value="Markov Services s.r.l.">
              Markov Services s.r.l.
            </option>
            <option value="MKS Properties s.r.l.">MKS Properties s.r.l.</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Semnat</label>
            <input
              type="date"
              name="signedAt"
              defaultValue={contract.signedAt}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Început</label>
            <input
              type="date"
              name="startDate"
              defaultValue={contract.startDate}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Expiră</label>
            <input
              type="date"
              name="endDate"
              defaultValue={contract.endDate}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <MultiDateInput
          name="indexingDates"
          initial={contract.indexingDates ?? []}
        />
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
              pattern={".*\\.(pdf|png|jpe?g|gif|webp|svg)(?:$|[?#]).*"}
              title="Acceptat: PDF sau imagine (png, jpg, jpeg, gif, webp, svg)"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-foreground/60">
              Dacă nu alegi nimic, rămâne scan-ul actual.
            </p>
            {contract.scanUrl ? (
              <p className="mt-1 text-xs text-foreground/60">
                Scan curent: {contract.scanUrl}
              </p>
            ) : null}
          </div>
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button
            disabled={!mongoConfigured}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Salvează modificările
          </button>
          <Link
            href={`/contracts/${contract.id}`}
            className="text-sm text-foreground/70 hover:underline"
          >
            Anulează
          </Link>
        </div>
      </form>
    </main>
  );
}
