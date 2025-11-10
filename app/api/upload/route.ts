import { NextRequest, NextResponse } from 'next/server';
import { parseMultipart } from '@/lib/upload/streaming-multipart';

export const runtime = 'nodejs'; // ensure Node.js runtime (streaming libs)
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { fields, files } = await parseMultipart(req, {
      maxFileSize: 50 * 1024 * 1024, // 50MB per file
      maxTotalFileSize: 200 * 1024 * 1024, // 200MB aggregate
      bufferFilesInMemory: true,
    });

    return NextResponse.json({
      ok: true,
      fields,
      files: files.map(f => ({
        fieldname: f.fieldname,
        filename: f.filename,
        mimeType: f.mimeType,
        size: f.size,
        hasBuffer: !!f.data,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
