import { MongoClient, type Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoDb: Db | undefined;
}

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const name = process.env.MONGODB_DB;
  if (!uri || !name) {
    throw new Error("MONGODB_URI and MONGODB_DB must be set in env");
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    global._mongoClientPromise = client.connect().then(async (c) => {
      // Light ping to fail fast if the cluster is unreachable
      try {
        await c.db(name).command({ ping: 1 });
      } catch (err) {
        // Close the client if ping fails so future attempts can retry
        await c.close().catch(() => {});
        throw err;
      }
      return c;
    });
  }

  const client = await global._mongoClientPromise;
  if (!global._mongoDb) {
    global._mongoDb = client.db(name);
  }
  return global._mongoDb;
}
