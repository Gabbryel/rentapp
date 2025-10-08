import dotenv from 'dotenv';
import { getDb } from '@/lib/mongodb';

(async function run() {
  dotenv.config({ path: '.env' });
  dotenv.config({ path: '.env.local', override: true });
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    console.error('Missing MONGODB_URI / MONGODB_DB. Aborting migration.');
    process.exit(1);
  }
  const db = await getDb();
  const coll = db.collection('notification_settings');
  const deprecated = ['indexingNext60', 'indexingNext15', 'indexingNext1'];
  const unsetSpec: Record<string, ''> = {};
  for (const f of deprecated) unsetSpec[f] = '';
  const res = await coll.updateMany({ $or: deprecated.map(f => ({ [f]: { $exists: true } })) }, { $unset: unsetSpec });
  console.log(`Notification settings migration complete. Matched ${res.matchedCount}, modified ${res.modifiedCount}.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
