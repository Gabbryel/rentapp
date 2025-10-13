import dotenv from "dotenv";
import { getDb } from "../lib/mongodb";

dotenv.config();

type AnyObj = Record<string, any>;

function toYmd(v: any): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") {
    const s = v.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

function isIndexareNote(note: any): boolean {
  return typeof note === "string" && note.trim().toLowerCase().startsWith("indexare");
}

function effectiveFromNote(note?: string, fallback?: string): string | undefined {
  if (!note) return fallback;
  const parts = String(note).split(/\s+/);
  const token = parts[1];
  if (token && token !== "imediat" && /\d{4}-\d{2}-\d{2}/.test(token)) return token;
  return fallback;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGODB_URI) {
    console.error("MongoDB nu este configurat (MONGODB_URI lipsă). Renunț.");
    process.exit(1);
  }
  const db = await getDb();
  const col = db.collection("contracts");

  const cursor = col.find({}, { projection: { _id: 0 } });
  let scanned = 0;
  let changed = 0;
  while (await cursor.hasNext()) {
    const doc = (await cursor.next()) as AnyObj;
    if (!doc) continue;
    scanned++;

    const id = doc.id;
    const rentHistory = Array.isArray(doc.rentHistory) ? doc.rentHistory.slice() : [];
    const idxDates: Array<{ forecastDate: string; actualDate?: string; newRentAmount?: number; done?: boolean }> = Array.isArray(doc.indexingDates)
      ? doc.indexingDates
      : [];

    // Build a lookup of effective dates by new amount for done indexings
    const doneIndexings = idxDates.filter((x) => x && x.done && typeof x.newRentAmount === "number");
    // Normalize snapshots: we want the snapshot to store the NEW amount and the note 'indexare {date}' with changedAt = actualDate|forecastDate
    // Keep non-indexare entries as-is.
    type Snap = {
      changedAt: string;
      rentAmountEuro: number;
      exchangeRateRON?: number;
      correctionPercent?: number;
      tvaPercent?: number;
      note?: string;
    };

    const mapped: Snap[] = [];
    for (const raw of rentHistory) {
      if (!raw || typeof raw !== "object") continue;
      const ch = toYmd((raw as any).changedAt);
      const amt = Number((raw as any).rentAmountEuro ?? (raw as any).amountEUR);
      if (!ch || !Number.isFinite(amt) || amt <= 0) continue;
      const snap: Snap = {
        changedAt: ch,
        rentAmountEuro: amt,
        exchangeRateRON: Number((raw as any).exchangeRateRON) || undefined,
        correctionPercent: Number((raw as any).correctionPercent) || undefined,
        tvaPercent: Number((raw as any).tvaPercent) || undefined,
        note: typeof (raw as any).note === "string" ? (raw as any).note : undefined,
      };
      mapped.push(snap);
    }

    // Detect likely legacy indexation snapshots where note is indexare but value stored might be the previous amount
    // We'll reconstruct indexation snapshots from indexingDates when possible; otherwise, we trust the stored value but adjust note/effective date.
    let patched: Snap[] = [];
    const initialNonIndexare = mapped.filter((s) => !isIndexareNote(s.note));
    const indexareSnaps = mapped.filter((s) => isIndexareNote(s.note));

    // Start from non-indexare snapshots as the baseline
    patched.push(...initialNonIndexare);

    // Rebuild indexation snapshots from doneIndexings: each done entry yields a snapshot with the new amount
    for (const ix of doneIndexings) {
      const date = toYmd(ix.actualDate) || toYmd(ix.forecastDate);
      const amt = Number(ix.newRentAmount);
      if (!date || !Number.isFinite(amt) || amt <= 0) continue;
      patched.push({
        changedAt: date,
        rentAmountEuro: amt,
        note: `indexare ${date}`,
      });
    }

    // For any indexare snapshots not covered by doneIndexings, keep them but ensure the note/date consistency
    for (const s of indexareSnaps) {
      const eff = effectiveFromNote(s.note, s.changedAt) || s.changedAt;
      // If a done indexing exists for this effective date, prefer the rebuilt snapshot and skip legacy one
      const coveredByDone = doneIndexings.some((x) => (toYmd(x.actualDate) || toYmd(x.forecastDate)) === eff);
      if (coveredByDone) continue;
      // Else, keep it but normalize note/date if not already present
      const exists = patched.some((p) => p.changedAt === eff && p.rentAmountEuro === s.rentAmountEuro);
      if (!exists) {
        patched.push({ ...s, changedAt: eff, note: `indexare ${eff}` });
      }
    }

    // Deduplicate and sort ascending by changedAt
    patched = patched.reduce((acc: Snap[], cur) => {
      const key = `${cur.changedAt}|${cur.rentAmountEuro}`;
      const i = acc.findIndex((x) => `${x.changedAt}|${x.rentAmountEuro}` === key);
      if (i >= 0) acc[i] = { ...acc[i], ...cur }; else acc.push(cur);
      return acc;
    }, []);
    patched.sort((a, b) => a.changedAt.localeCompare(b.changedAt));

    // If history changed, update
    const changedHistory = JSON.stringify(mapped) !== JSON.stringify(patched);
    if (changedHistory) {
      if (!dryRun) {
        await col.updateOne({ id }, { $set: { rentHistory: patched } });
      }
      changed++;
      console.log(`Contract ${id}: rentHistory normalized (${mapped.length} -> ${patched.length}).`);
    }
  }

  console.log(`Scan complete. Contracts scanned: ${scanned}. Modified: ${changed}.${process.argv.includes("--dry-run") ? " (dry-run)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
