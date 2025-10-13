#!/usr/bin/env tsx
import { fetchContracts, effectiveEndDate } from "@/lib/contracts";
import { upsertIndexing } from "@/lib/indexing";

async function main() {
  if (!process.env.MONGODB_URI) {
    console.warn("MongoDB nu este configurat (MONGODB_URI lipsă). Backfill ignorat.");
    process.exit(0);
  }
  const contracts = await fetchContracts();
  let created = 0;
  for (const c of contracts) {
    const day = (c as any).indexingDay as number | undefined;
    const month = (c as any).indexingMonth as number | undefined;
    if (!day || !month) continue;
    const start = new Date(c.startDate);
    const end = new Date(effectiveEndDate(c));
    const today = new Date();
    let y = today.getFullYear();
    let candidate = new Date(y, month - 1, day);
    if (candidate < today) candidate = new Date(y + 1, month - 1, day);
    if (candidate < start) {
      y = start.getFullYear();
      candidate = new Date(y, month - 1, day);
      if (candidate < start) candidate = new Date(y + 1, month - 1, day);
    }
    if (candidate >= start && candidate <= end) {
      const yyyy = candidate.getFullYear();
      const mm = String(candidate.getMonth() + 1).padStart(2, "0");
      const dd = String(candidate.getDate()).padStart(2, "0");
      const indexDate = `${yyyy}-${mm}-${dd}`;
      await upsertIndexing({
        contractId: c.id,
        indexDate,
        startDate: indexDate,
      } as any);
      created++;
      console.log(`[backfill] ${c.id} -> ${indexDate}`);
    }
  }
  console.log(`Backfill complet: ${created} indexări programate.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
