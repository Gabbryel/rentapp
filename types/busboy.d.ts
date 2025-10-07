declare module 'busboy' {
  import { Readable, Writable } from 'stream';
  interface BusboyConfig { headers: { [k: string]: any } }
  export interface FileInfo { filename: string; encoding: string; mimeType: string }
  export interface BusboyFileStream extends Readable {
    truncated?: boolean;
    truncate: () => void;
  }
  interface BusboyEvents extends Writable {
    on(event: 'field', cb: (name: string, val: string, info?: any) => void): this;
    on(event: 'file', cb: (name: string, file: BusboyFileStream, info: FileInfo) => void): this;
    on(event: 'finish', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
  }
  interface BusboyConstructor {
    (config: BusboyConfig): BusboyEvents;
  }
  const Busboy: BusboyConstructor;
  export default Busboy;
}