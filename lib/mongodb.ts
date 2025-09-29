import { MongoClient, type Db, type MongoClientOptions, ServerApiVersion } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoDb: Db | undefined;
}

function extractDbNameFromUri(uri: string): string | null {
  // Match '/dbname' right after the host(s), before a '?' if present
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  if (!m) return null;
  const raw = decodeURIComponent(m[1]);
  // If multiple path segments appear, take the first
  const first = raw.split("/")[0];
  return first || null;
}

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const envName = process.env.MONGODB_DB || undefined;
  if (!uri) {
    throw new Error("MONGODB_URI must be set in env");
  }

  // Prefer explicit env, else derive from URI path, else error
  let desiredName = envName ?? extractDbNameFromUri(uri) ?? undefined;
  if (desiredName && desiredName.includes(".")) {
    // sanitize accidental host assignment
    desiredName = desiredName.split(".")[0];
  }
  if (!desiredName) {
    throw new Error(
      "Database name not found. Set MONGODB_DB or include '/<db>' in MONGODB_URI (e.g., mongodb+srv://.../rentapp)."
    );
  }

  if (!global._mongoClientPromise) {
    const opts: MongoClientOptions = {
      serverSelectionTimeoutMS: 8000,
      // Use MongoDB Stable API v1 for Atlas
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      appName: process.env.NEXT_PUBLIC_APP_NAME || "RentApp",
    };
    const client = new MongoClient(uri, opts);
    global._mongoClientPromise = client.connect().then(async (c) => {
      try {
        // Ping admin to validate cluster connection regardless of dbName
        await c.db("admin").command({ ping: 1 });
      } catch (err) {
        await c.close().catch(() => {});
        throw err;
      }
      return c;
    });
  }

  const client = await global._mongoClientPromise;
  if (!global._mongoDb) {
    // Explicitly select desired DB
    global._mongoDb = client.db(desiredName);
  }
  return global._mongoDb;
}
