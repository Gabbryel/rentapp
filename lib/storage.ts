import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { ObjectId, GridFSBucket } from "mongodb";
import { getDb } from "@/lib/mongodb";

function sanitize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function saveScanFile(
  file: File,
  baseName: string,
  opts?: { contractId?: string }
): Promise<{ url: string; storage: "gridfs" | "local"; id?: string }> {
  const original = file.name || "scan";
  const base = sanitize(baseName || original.replace(/\.[^.]+$/, "")) || "scan";
  const fromNameExtMatch = /\.([a-z0-9]+)$/i.exec(original ?? "");
  const ext = (fromNameExtMatch?.[1] || inferExt(file.type) || "dat").toLowerCase();
  const filename = `${base}.${ext}`;

  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const bucket = new GridFSBucket(db, { bucketName: "uploads" });
    const buffer = Buffer.from(await file.arrayBuffer());
    const readable = Readable.from(buffer);
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.type || inferMime(ext) || "application/octet-stream",
      metadata: { originalName: original, contractId: opts?.contractId ?? null },
    });
    await new Promise<void>((resolve, reject) => {
      readable.pipe(uploadStream).on("finish", () => resolve()).on("error", reject);
    });
    const id = uploadStream.id as ObjectId;
    return { url: `/api/uploads/${id.toString()}`, storage: "gridfs", id: id.toString() };
  }

  // Local dev fallback
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
  return { url: `/uploads/${filename}`, storage: "local" };
}

export async function deleteScanByUrl(url?: string | null) {
  if (!url) return { deleted: false as const, reason: "no-scan" as const };
  if (url.startsWith("/api/uploads/")) {
    // GridFS-backed
    const id = url.replace("/api/uploads/", "").split(/[?#]/)[0];
    try {
      const db = await getDb();
      const bucket = new GridFSBucket(db, { bucketName: "uploads" });
      await bucket.delete(new ObjectId(id));
      return { deleted: true as const, reason: "removed-gridfs" as const };
    } catch {
      return { deleted: false as const, reason: "gridfs-delete-failed" as const };
    }
  }
  if (url.startsWith("/uploads/")) {
    try {
      const rel = url.replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", rel);
      await fs.unlink(filePath);
      return { deleted: true as const, reason: "removed-local" as const };
    } catch {
      return { deleted: false as const, reason: "unlink-failed" as const };
    }
  }
  return { deleted: false as const, reason: "external-or-unsupported" as const };
}

function inferExt(mime: string | null | undefined): string | null {
  if (!mime) return null;
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return null;
  }
}

function inferMime(ext: string | null | undefined): string | null {
  if (!ext) return null;
  switch (ext.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return null;
  }
}
