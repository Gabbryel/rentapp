import Busboy, { FileInfo } from 'busboy';
import type { BusboyFileStream } from 'busboy';
import { NextRequest } from 'next/server';

export type UploadedFile = {
  fieldname: string;
  filename: string;
  encoding: string;
  mimeType: string;
  size: number; // bytes actually read
  data?: Buffer; // optional if you decide to buffer small files
  tempFilePath?: string; // if you decide to stream to disk (not implemented yet)
};

export type MultipartResult = {
  fields: Record<string, string>;
  files: UploadedFile[];
};

export interface MultipartOptions {
  /**
   * Maximum per-file size in bytes. If exceeded we abort (default 25MB)
   */
  maxFileSize?: number;
  /**
   * Aggregate size limit for all files (default 100MB)
   */
  maxTotalFileSize?: number;
  /**
   * If true, buffers file fully in memory up to maxFileSize. Otherwise discards data (placeholder for future streaming to disk/cloud).
   */
  bufferFilesInMemory?: boolean;
  /**
   * Abort controller timeout (ms) for safety (default 2 minutes)
   */
  timeoutMs?: number;
}

/**
 * Parse a multipart/form-data request in a streaming, backpressure-aware manner using Busboy.
 * Designed for Next.js App Router route handlers. Must be called before reading the body elsewhere.
 */
export function parseMultipart(req: NextRequest, opts: MultipartOptions = {}): Promise<MultipartResult> {
  const {
    maxFileSize = 25 * 1024 * 1024,
    maxTotalFileSize = 100 * 1024 * 1024,
    bufferFilesInMemory = true,
    timeoutMs = 120_000,
  } = opts;

  return new Promise((resolve, reject) => {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return reject(new Error('Unsupported content type (expected multipart/form-data)'));
    }

    const busboy = Busboy({ headers: { 'content-type': contentType } });
    const fields: Record<string, string> = {};
    const files: UploadedFile[] = [];
    let totalSize = 0;
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error('Upload parsing timed out'));
      }
    }, timeoutMs);

    function safeReject(err: any) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    }

    function safeResolve() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ fields, files });
    }

  busboy.on('field', (name: string, val: string) => {
      // If multiple same-name fields: keep last (simple strategy)
      fields[name] = val;
    });

  busboy.on('file', (name: string, file: BusboyFileStream, info: FileInfo) => {
      const { filename, encoding, mimeType } = info;
      const uploaded: UploadedFile = {
        fieldname: name,
        filename,
        encoding,
        mimeType,
        size: 0,
      };
      let chunks: Buffer[] = [];

  file.on('data', (data: Buffer) => {
        uploaded.size += data.length;
        totalSize += data.length;
        if (uploaded.size > maxFileSize) {
          file.truncate();
          safeReject(new Error(`File ${filename} exceeds max per-file size`));
          return;
        }
        if (totalSize > maxTotalFileSize) {
          file.truncate();
          safeReject(new Error('Aggregate file size limit exceeded'));
          return;
        }
        if (bufferFilesInMemory) {
          chunks.push(data);
        }
      });

      file.on('limit', () => {
        safeReject(new Error(`File ${filename} size limit hit`));
      });

      file.on('end', () => {
        if (bufferFilesInMemory) {
          uploaded.data = Buffer.concat(chunks);
          chunks = [];
        }
        files.push(uploaded);
      });
    });

    busboy.on('error', (err: Error) => {
      safeReject(err);
    });

    busboy.on('finish', () => {
      safeResolve();
    });

    // Pipe request body stream into busboy
    // NextRequest body is a ReadableStream. Convert to Node stream.
    const nodeReadable = ReadableFromWeb(req.body);
    nodeReadable.on('error', (err) => safeReject(err));
    nodeReadable.pipe(busboy);
  });
}

// Helper: convert WHATWG ReadableStream (from NextRequest) to Node.js Readable
import { Readable } from 'node:stream';
function ReadableFromWeb(stream: ReadableStream<Uint8Array> | null): Readable {
  if (!stream) return Readable.from([]);
  const reader = stream.getReader();
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      } catch (e) {
        this.destroy(e as Error);
      }
    },
  });
}
