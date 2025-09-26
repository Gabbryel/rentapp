import { ContractSchema } from "@/lib/schemas/contract";
import { upsertContract } from "@/lib/contracts";
import { redirect } from "next/navigation";
import type { ZodIssue } from "zod";

async function createContract(formData: FormData) {
  "use server";
  const data = {
    id: (formData.get("id") as string) || `c_${Date.now()}`,
    name: (formData.get("name") as string) ?? "",
    partner: (formData.get("partner") as string) ?? "",
    signedAt: (formData.get("signedAt") as string) ?? "",
    startDate: (formData.get("startDate") as string) ?? "",
    endDate: (formData.get("endDate") as string) ?? "",
    scanUrl: (formData.get("scanUrl") as string) || undefined,
  };

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

      <form action={createContract} className="mt-6 max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium">ID (opțional)</label>
          <input
            name="id"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
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
        <div>
          <label className="block text-sm font-medium">Scan (URL)</label>
          <input
            name="scanUrl"
            placeholder="/contract-scan.svg sau https://…"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
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
