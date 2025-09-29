import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { Readable } from "node:stream";

type GridFSFileDoc = {
  _id: ObjectId;
  filename: string;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  metadata?: { originalName?: string; contractId?: string | null } | null;
  contentType?: string;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.MONGODB_URI) {
      return new NextResponse("Service unavailable", { status: 503 });
    }
    const db = await getDb();
    const bucket = new GridFSBucket(db, { bucketName: "uploads" });
    const { id: idStr } = await params;
    if (!/^[a-f\d]{24}$/i.test(idStr)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const id = new ObjectId(idStr);
  const fileDocs = await db.collection("uploads.files").find({ _id: id }).limit(1).toArray();
    if (!fileDocs[0]) return new NextResponse("Not found", { status: 404 });
  const file = fileDocs[0] as GridFSFileDoc;
    const stream = bucket.openDownloadStream(id);

    const headers = new Headers();
    headers.set("Content-Type", file.contentType || "application/octet-stream");
    // Inline display; change to attachment for download behavior
    headers.set("Content-Disposition", `inline; filename="${file.filename || id.toString()}"`);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (typeof file.length === "number") headers.set("Content-Length", String(file.length));
    if (file.uploadDate) headers.set("Last-Modified", new Date(file.uploadDate).toUTCString());

  const webStream = Readable.toWeb(stream as unknown as Readable) as ReadableStream;
    return new NextResponse(webStream, { headers });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
