import 'dotenv/config';
import { getDb } from '@/lib/mongodb';
import { fetchPartners } from '@/lib/partners';
import type { Contract } from '@/lib/schemas/contract';

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MongoDB nu este configurat. Setați MONGODB_URI și MONGODB_DB.');
    process.exit(1);
  }
  const db = await getDb();
  const partners = await fetchPartners();
  if (partners.length === 0) {
    console.log('Nu există parteneri în baza de date; nimic de actualizat.');
    return;
  }

  // Build map by exact name (case-sensitive) and lowercased variant for lenient match
  const byName = new Map<string, string>(); // name -> id
  const byLower = new Map<string, string>(); // lower(name) -> id
  for (const p of partners) {
    byName.set(p.name, p.id);
    byLower.set(p.name.toLowerCase(), p.id);
  }

  const coll = db.collection<Contract>('contracts');
  const cursor = coll.find({}, { projection: { _id: 0, id: 1, partner: 1, partnerId: 1 } });
  let updates = 0;
  let skipped = 0;
  let total = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    total++;
    if (doc.partnerId) { skipped++; continue; }
    const name = (doc.partner || '').trim();
    if (!name) { skipped++; continue; }

    let pid = byName.get(name);
    if (!pid) pid = byLower.get(name.toLowerCase());

    if (pid) {
      const res = await coll.updateOne({ id: doc.id }, { $set: { partnerId: pid } });
      if (res.acknowledged) updates++;
      console.log(`Updated ${doc.id}: partnerId -> ${pid}`);
    } else {
      console.warn(`No matching partner for contract ${doc.id} (${name})`);
      skipped++;
    }
  }

  console.log(`Done. Total: ${total}, Updated: ${updates}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
