import { getDb } from "@/lib/mongodb";
import { AssetSchema, type Asset, type ScanItem } from "@/lib/schemas/asset";

function toYmd(input: Date | string | undefined | null): string | undefined {
  if (!input) return undefined;
  if (typeof input === "string") return input;
  if (input instanceof Date && !isNaN(input.getTime())) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

function normalize(raw: unknown): Partial<Asset> {
  const r = (raw ?? {}) as Record<string, unknown>;
  // Normalize scans: accept legacy string[] or {url,title?}[]
  let scans: ScanItem[] = [];
  if (Array.isArray((r as any).scans)) {
    const arr = (r as any).scans as unknown[];
    scans = arr
      .map((it): ScanItem | null => {
        if (typeof it === "string") return { url: it, title: undefined } as ScanItem;
        if (it && typeof it === "object") {
          const url = (it as any).url;
          const title = (it as any).title;
          if (typeof url === "string") return { url, title: typeof title === "string" ? title : undefined };
        }
        return null;
      })
      .filter(Boolean) as ScanItem[];
  }
  return {
    id: typeof r.id === "string" ? r.id : (r.id as string | undefined),
    name: typeof r.name === "string" ? r.name : (r.name as string | undefined),
    address: typeof r.address === "string" ? r.address : (r.address as string | undefined),
    areaSqm: typeof (r as any).areaSqm === "number" ? ((r as any).areaSqm as number) : undefined,
    scans,
    createdAt: toYmd((r as any).createdAt),
    updatedAt: toYmd((r as any).updatedAt),
  };
}

export async function listAssets(): Promise<Asset[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const docs = await db.collection<Asset>("assets").find({}, { projection: { _id: 0 } }).toArray();
  const out: Asset[] = [];
  for (const d of docs) {
    const parsed = AssetSchema.safeParse(normalize(d));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function getAssetById(id: string): Promise<Asset | null> {
  if (!process.env.MONGODB_URI) return null;
  const db = await getDb();
  const doc = await db.collection<Asset>("assets").findOne({ id }, { projection: { _id: 0 } });
  if (!doc) return null;
  const parsed = AssetSchema.safeParse(normalize(doc));
  return parsed.success ? parsed.data : null;
}

export async function upsertAsset(asset: Asset): Promise<void> {
  AssetSchema.parse(asset);
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  await db.collection<Asset>("assets").updateOne({ id: asset.id }, { $set: asset }, { upsert: true });
}

export async function deleteAssetById(id: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  const res = await db.collection<Asset>("assets").deleteOne({ id });
  return Boolean(res.acknowledged && (res.deletedCount ?? 0) > 0);
}
