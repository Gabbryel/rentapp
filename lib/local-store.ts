import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".data");
const memoryStore = new Map<string, unknown>();

async function ensureDir() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch {}
}

export async function readJson<T = unknown>(fileName: string, fallback: T): Promise<T> {
  try {
    await ensureDir();
    const filePath = path.join(dataDir, fileName);
    const buf = await fs.readFile(filePath);
    return JSON.parse(String(buf)) as T;
  } catch {
    if (memoryStore.has(fileName)) {
      return memoryStore.get(fileName) as T;
    }
    return fallback;
  }
}

export async function writeJson<T = unknown>(fileName: string, data: T): Promise<void> {
  await ensureDir();
  const filePath = path.join(dataDir, fileName);
  try {
    await fs.writeFile(filePath, Buffer.from(JSON.stringify(data, null, 2)));
    memoryStore.delete(fileName);
  } catch (error) {
    memoryStore.set(fileName, data);
    console.warn("writeJson: filesystem write failed, using in-memory fallback", {
      fileName,
      error,
    });
  }
}
