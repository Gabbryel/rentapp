import { getDb } from "@/lib/mongodb";

// Migration: ensure phone/email fields exist (set to undefined so future code can rely on presence)
async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MongoDB nu este configurat.");
    return;
  }
  const db = await getDb();
  const coll = db.collection("partners");
  // Ensure fields are either absent or non-null (remove explicit nulls)
  const res = await coll.updateMany(
    { $or: [ { phone: { $type: 'missing' } }, { email: { $type: 'missing' } }, { phone: null }, { email: null } ] },
    { $unset: { phone: "", email: "" } }
  );
  console.log("Migration partner contact fields:", {
    matched: res.matchedCount,
    modified: res.modifiedCount,
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});