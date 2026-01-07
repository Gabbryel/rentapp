import { revalidatePath } from "next/cache";
import {
  readHicpFallback,
  upsertHicpFallback,
  deleteHicpFallback,
} from "@/lib/inflation-fallback";

export const dynamic = "force-dynamic";

async function saveMonth(formData: FormData) {
  "use server";
  const month = String(formData.get("month") || "").trim();
  const indexRaw = String(formData.get("index") || "").trim();
  const index = Number(indexRaw.replace(",", "."));
  if (!month || !/^[0-9]{4}-[0-9]{2}$/.test(month)) return;
  if (!Number.isFinite(index) || index <= 0) return;
  await upsertHicpFallback(month, index);
  revalidatePath("/admin/inflation");
}

async function deleteMonth(formData: FormData) {
  "use server";
  const month = String(formData.get("month") || "").trim();
  if (!month) return;
  await deleteHicpFallback(month);
  revalidatePath("/admin/inflation");
}

export default async function InflationAdminPage() {
  const entries = await readHicpFallback();
  const rows = Object.entries(entries).sort((a, b) => b[0].localeCompare(a[0]));
  const byYear = rows.reduce<
    Record<string, Array<{ month: string; index: number }>>
  >((acc, [m, idx]) => {
    const year = m.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push({ month: m, index: idx });
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inflație (fallback)</h1>
        <p className="text-foreground/70 mt-1 text-sm">
          Completează manual indicele HICP (2015=100) per lună. Aceste valori
          sunt folosite ca fallback dacă nu se poate accesa API-ul ECB. Fișier:{" "}
          <code>.data/hicp-fallback.json</code>.
        </p>
      </div>

      <div className="rounded-lg border border-foreground/15 p-4 space-y-4">
        <h2 className="text-lg font-semibold">Adaugă / actualizează lună</h2>
        <form action={saveMonth} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-1">
              Luna (YYYY-MM)
            </label>
            <input
              name="month"
              type="month"
              required
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground/60 mb-1">
              Indice HICP (2015=100)
            </label>
            <input
              name="index"
              type="number"
              step="0.01"
              min="0"
              required
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm"
              placeholder="ex: 119.23"
            />
          </div>
          <button className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold hover:bg-foreground/5">
            Salvează
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-foreground/15 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Valori existente</h2>
        {rows.length === 0 ? (
          <div className="text-sm text-foreground/60">
            Nicio valoare setată.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byYear)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([year, months]) => (
                <div key={year} className="space-y-2">
                  <div className="text-sm font-semibold">{year}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {months
                      .slice()
                      .sort((a, b) => b.month.localeCompare(a.month))
                      .map(({ month, index }) => (
                        <div
                          key={month}
                          className="flex items-center justify-between rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm"
                        >
                          <div>
                            <div className="font-medium">{month}</div>
                            <div className="text-foreground/60 text-xs">
                              Indice: {index.toFixed(2)}
                            </div>
                          </div>
                          <form action={deleteMonth}>
                            <input type="hidden" name="month" value={month} />
                            <button className="text-xs text-red-500 hover:underline">
                              Șterge
                            </button>
                          </form>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
