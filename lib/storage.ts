import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { ObjectId, GridFSBucket } from "mongodb";
import { getDb } from "@/lib/mongodb";

function sanitize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function saveScanFile(
  file: File,
  baseName: string,
  opts?: { contractId?: string; partnerId?: string; assetId?: string }
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
      metadata: { originalName: original, contractId: opts?.contractId ?? null, partnerId: opts?.partnerId ?? null, assetId: opts?.assetId ?? null },
    });
    await new Promise<void>((resolve, reject) => {
      readable.pipe(uploadStream).on("finish", () => resolve()).on("error", reject);
    });
    const id = uploadStream.id as ObjectId;
    return { url: `/api/uploads/${id.toString()}`, storage: "gridfs", id: id.toString() };
  }

  // Local dev fallback
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = file.type || inferMime(ext) || "application/octet-stream";
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, buffer);
    return { url: `/uploads/${filename}`, storage: "local" };
  } catch (error) {
    console.warn("saveScanFile: local filesystem inaccessible, falling back to inline data URL", {
      filename,
      error,
    });
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    return { url: dataUrl, storage: "local" };
  }
}

// Save a raw buffer as an upload (useful for generated PDFs). Mirrors saveScanFile behavior.
export async function saveBufferAsUpload(
  data: Uint8Array,
  filename: string,
  contentType: string,
  opts?: { contractId?: string; partnerId?: string; assetId?: string }
): Promise<{ url: string; storage: "gridfs" | "local"; id?: string }> {
  const base = sanitize(filename.replace(/\.[^.]+$/, "")) || "file";
  const ext = (filename.split(".").pop() || "dat").toLowerCase();
  const finalName = `${base}.${ext}`;
  const mimeType = contentType || inferMime(ext) || "application/octet-stream";
  const dataBuffer = Buffer.from(data);
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      const bucket = new GridFSBucket(db, { bucketName: "uploads" });
      const readable = Readable.from(dataBuffer);
      const uploadStream = bucket.openUploadStream(finalName, {
        contentType: mimeType,
        metadata: { originalName: filename, contractId: opts?.contractId ?? null, partnerId: opts?.partnerId ?? null, assetId: opts?.assetId ?? null },
      });
      await new Promise<void>((resolve, reject) => {
        readable.pipe(uploadStream).on("finish", () => resolve()).on("error", reject);
      });
      const id = uploadStream.id as ObjectId;
      return { url: `/api/uploads/${id.toString()}`, storage: "gridfs", id: id.toString() };
    } catch {
      // fall through to local save
    }
  }

  // Local dev fallback
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, finalName);
    await fs.writeFile(filePath, dataBuffer);
    return { url: `/uploads/${finalName}`, storage: "local" };
  } catch (error) {
    console.warn("saveBufferAsUpload: local filesystem inaccessible, returning inline data URL", {
      filename: finalName,
      error,
    });
    const dataUrl = `data:${mimeType};base64,${dataBuffer.toString("base64")}`;
    return { url: dataUrl, storage: "local" };
  }
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

export async function getFileSizeByUrl(url?: string | null): Promise<number | null> {
  if (!url) return null;
  
  if (url.startsWith("/api/uploads/")) {
    // GridFS-backed
    const id = url.replace("/api/uploads/", "").split(/[?#]/)[0];
    try {
      const db = await getDb();
      const bucket = new GridFSBucket(db, { bucketName: "uploads" });
      const files = await bucket.find({ _id: new ObjectId(id) }).toArray();
      if (files.length > 0 && files[0].length) {
        return files[0].length;
      }
      return null;
    } catch {
      return null;
    }
  }
  
  if (url.startsWith("/uploads/")) {
    try {
      const rel = url.replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", rel);
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return null;
    }
  }
  
  return null;
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
