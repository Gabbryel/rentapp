import fs from "fs/promises";
import path from "path";

const FALLBACK_FILE = path.join(process.cwd(), ".data", "hicp-fallback.json");

function isMonthKey(key: string): boolean {
  return /^[0-9]{4}-[0-9]{2}$/.test(key);
}

export async function readHicpFallback(): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(FALLBACK_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter(([k, v]) => isMonthKey(k) && typeof v === "number");
    return Object.fromEntries(entries) as Record<string, number>;
  } catch {
    return {};
  }
}

export async function writeHicpFallback(map: Record<string, number>): Promise<void> {
  const safeEntries = Object.entries(map || {}).filter(
    ([k, v]) => isMonthKey(k) && typeof v === "number" && Number.isFinite(v)
  );
  const sorted = safeEntries.sort((a, b) => a[0].localeCompare(b[0]));
  await fs.mkdir(path.dirname(FALLBACK_FILE), { recursive: true });
  const json = JSON.stringify(Object.fromEntries(sorted), null, 2);
  await fs.writeFile(FALLBACK_FILE, json, "utf8");
}

export async function upsertHicpFallback(month: string, index: number): Promise<Record<string, number>> {
  const normalizedMonth = month.trim();
  if (!isMonthKey(normalizedMonth)) throw new Error("Format lună invalid (YYYY-MM)");
  if (!Number.isFinite(index) || index <= 0) throw new Error("Indice invalid");
  const current = await readHicpFallback();
  const next = { ...current, [normalizedMonth]: index };
  await writeHicpFallback(next);
  return next;
}

export async function deleteHicpFallback(month: string): Promise<Record<string, number>> {
  const normalizedMonth = month.trim();
  const current = await readHicpFallback();
  if (!(normalizedMonth in current)) return current;
  const { [normalizedMonth]: _, ...rest } = current;
  await writeHicpFallback(rest);
  return rest;
}
