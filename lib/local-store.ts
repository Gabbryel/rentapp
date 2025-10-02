import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".data");

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
    return fallback;
  }
}

export async function writeJson<T = unknown>(fileName: string, data: T): Promise<void> {
  await ensureDir();
  const filePath = path.join(dataDir, fileName);
  await fs.writeFile(filePath, Buffer.from(JSON.stringify(data, null, 2)));
}
