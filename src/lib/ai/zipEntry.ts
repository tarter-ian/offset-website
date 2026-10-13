import { Inflate } from "fflate";

// Reads one file out of a .zip without loading the whole archive. A ChatGPT
// export with years of images can be several GB, more than a phone browser will
// hold, but the conversations.json inside is a small part of it. So this reads
// the zip's table of contents from the end of the file, then only the bytes of
// the one entry it needs, a few MB at a time.

const CHUNK = 4 * 1024 * 1024;
const u16 = (b: DataView, o: number) => b.getUint16(o, true);
const u32 = (b: DataView, o: number) => b.getUint32(o, true);
const u64 = (b: DataView, o: number) => u32(b, o) + u32(b, o + 4) * 2 ** 32;

async function view(file: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  headerOffset: number;
}

/** Lists the files in a zip from its central directory, ZIP64 included. */
export async function listZip(file: Blob): Promise<ZipEntry[]> {
  // The end record is the last 22 bytes, plus a comment of up to 64 KB.
  const tailStart = Math.max(0, file.size - 22 - 65535);
  const tail = await view(file, tailStart, file.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");
  let count = u16(tail, eocd + 10);
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);
  // Archives over 4 GB keep the real figures in a ZIP64 record.
  if (eocd >= 20 && u32(tail, eocd - 20) === 0x07064b50) {
    const at = u64(tail, eocd - 12);
    const z = await view(file, at, at + 56);
    if (u32(z, 0) === 0x06064b50) {
      count = u64(z, 32);
      cdSize = u64(z, 40);
      cdOffset = u64(z, 48);
    }
  }
  const cd = await view(file, cdOffset, cdOffset + cdSize);
  const names = new TextDecoder();
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength && u32(cd, p) === 0x02014b50; n++) {
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    const e: ZipEntry = {
      name: names.decode(new Uint8Array(cd.buffer, p + 46, nameLen)),
      method: u16(cd, p + 10),
      compressedSize: u32(cd, p + 20),
      size: u32(cd, p + 24),
      headerOffset: u32(cd, p + 42),
    };
    // ZIP64 extra field: full sizes and offset, in this order, for each one that overflowed.
    let x = p + 46 + nameLen;
    const xEnd = x + extraLen;
    while (x + 4 <= xEnd) {
      const id = u16(cd, x);
      const len = u16(cd, x + 2);
      if (id === 0x0001) {
        let f = x + 4;
        for (const k of ["size", "compressedSize", "headerOffset"] as const) {
          if (e[k] !== 0xffffffff) continue;
          e[k] = u64(cd, f);
          f += 8;
        }
      }
      x += 4 + len;
    }
    entries.push(e);
    p = xEnd + commentLen;
  }
  return entries;
}

/** One entry's contents as text, inflated a chunk at a time. */
export async function readZipText(file: Blob, e: ZipEntry, chunkSize = CHUNK): Promise<string> {
  const local = await view(file, e.headerOffset, e.headerOffset + 30);
  if (u32(local, 0) !== 0x04034b50) throw new Error("bad entry");
  const start = e.headerOffset + 30 + u16(local, 26) + u16(local, 28);
  const end = start + e.compressedSize;
  const decoder = new TextDecoder();
  const parts: string[] = [];
  const take = (chunk: Uint8Array, final: boolean) => parts.push(decoder.decode(chunk, { stream: !final }));
  if (e.method !== 0 && e.method !== 8) throw new Error("unsupported compression");
  const inflate = e.method === 8 ? new Inflate(take) : null;
  if (start === end) take(new Uint8Array(), true);
  for (let at = start; at < end; at += chunkSize) {
    const chunk = new Uint8Array(await file.slice(at, Math.min(end, at + chunkSize)).arrayBuffer());
    const final = at + chunkSize >= end;
    if (inflate) inflate.push(chunk, final);
    else take(chunk, final);
  }
  return parts.join("");
}
