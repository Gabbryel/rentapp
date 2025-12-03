import { randomUUID } from "crypto";
import { getDb } from "@/lib/mongodb";
import { readJson, writeJson } from "@/lib/local-store";
import {
  WrittenContractSchema,
  type WrittenContract,
  type WrittenContractDraft,
} from "@/lib/schemas/written-contract";

const COLLECTION = "written_contracts";
const FILE_NAME = "written_contracts.json";

type UpsertInput = WrittenContractDraft & {
  authorEmail?: string;
  createdAt?: string;
};

function normalizePayload(
  input: UpsertInput,
  createdAt: string,
  updatedAt: string
): WrittenContract {
  const parsed = WrittenContractSchema.parse({
    ...input,
    id: input.id ?? randomUUID(),
    createdAt,
    updatedAt,
  });
  return parsed;
}

export async function listWrittenContracts(): Promise<WrittenContract[]> {
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      const docs = await db
        .collection<WrittenContract>(COLLECTION)
        .find({}, { projection: { _id: 0 } })
        .sort({ updatedAt: -1 })
        .toArray();
      return docs.map((doc) => WrittenContractSchema.parse(doc));
    } catch (error) {
      console.warn(
        "Mongo indisponibil (listWrittenContracts), fallback local.",
        error
      );
    }
  }
  const local = await readJson<WrittenContract[]>(FILE_NAME, []);
  return local.map((doc) => WrittenContractSchema.parse(doc));
}

export async function getWrittenContractById(
  id: string
): Promise<WrittenContract | null> {
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      const doc = await db
        .collection<WrittenContract>(COLLECTION)
        .findOne({ id }, { projection: { _id: 0 } });
      return doc ? WrittenContractSchema.parse(doc) : null;
    } catch (error) {
      console.warn(
        "Mongo indisponibil (getWrittenContractById), fallback local.",
        error
      );
    }
  }
  const local = await readJson<WrittenContract[]>(FILE_NAME, []);
  const found = local.find((item) => item.id === id);
  return found ? WrittenContractSchema.parse(found) : null;
}

export async function upsertWrittenContract(
  input: UpsertInput
): Promise<WrittenContract> {
  const now = new Date().toISOString();
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const existing = input.id
      ? await db
          .collection<WrittenContract>(COLLECTION)
          .findOne({ id: input.id }, { projection: { _id: 0 } })
      : null;
    const createdAt = existing?.createdAt ?? input.createdAt ?? now;
    const payload = normalizePayload(
      { ...input, id: input.id ?? existing?.id },
      createdAt,
      now
    );
    await db
      .collection<WrittenContract>(COLLECTION)
      .updateOne({ id: payload.id }, { $set: payload }, { upsert: true });
    return payload;
  }
  const all = await readJson<WrittenContract[]>(FILE_NAME, []);
  const idx = input.id
    ? all.findIndex((item) => item.id === input.id)
    : -1;
  const existing = idx >= 0 ? all[idx] : null;
  const createdAt = existing?.createdAt ?? input.createdAt ?? now;
  const payload = normalizePayload(
    { ...input, id: input.id ?? existing?.id },
    createdAt,
    now
  );
  if (idx >= 0) {
    all[idx] = payload;
  } else {
    all.push(payload);
  }
  await writeJson(FILE_NAME, all);
  return payload;
}

export async function deleteWrittenContract(id: string): Promise<boolean> {
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const res = await db
      .collection<WrittenContract>(COLLECTION)
      .deleteOne({ id });
    return Boolean(res.acknowledged && (res.deletedCount || 0) > 0);
  }
  const all = await readJson<WrittenContract[]>(FILE_NAME, []);
  const next = all.filter((item) => item.id !== id);
  const changed = next.length !== all.length;
  if (changed) {
    await writeJson(FILE_NAME, next);
  }
  return changed;
}
