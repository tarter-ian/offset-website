import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { listZip, readZipText } from "./zipEntry";
import { readExportFile } from "./exportParser";

const chats = JSON.stringify([
  {
    mapping: {
      a: { message: { author: { role: "user" }, create_time: 1_780_000_000, content: { parts: ["héllo ".repeat(5000)] } } },
      b: { message: { author: { role: "assistant" }, create_time: 1_780_000_010, content: { parts: ["hi"] } } },
    },
  },
]);

/** Random bytes don't compress, like the photos in a real export. */
const noise = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 2654435761) >>> 24);

describe("listZip and readZipText", () => {
  it("reads one deflated entry next to big stored files", async () => {
    const zip = zipSync(
      {
        "user-1/file-abc.png": [noise(300_000), { level: 0 }],
        "conversations.json": strToU8(chats),
        "chat.html": strToU8("<html></html>"),
      },
      { comment: "export" } as never,
    );
    const file = new Blob([zip]);
    const entries = await listZip(file);
    expect(entries.map((e) => e.name)).toEqual(["user-1/file-abc.png", "conversations.json", "chat.html"]);
    const e = entries.find((x) => x.name === "conversations.json")!;
    expect(e.method).toBe(8);
    expect(await readZipText(file, e)).toBe(chats);
    // A few bytes at a time, splitting the é across chunks.
    expect(await readZipText(file, e, 7)).toBe(chats);
    const stored = entries[0];
    expect((await readZipText(file, stored, 1001)).length).toBeGreaterThan(0);
  });

  it("reads stored and empty entries", async () => {
    const zip = zipSync({ "a.json": [strToU8("[1,2]"), { level: 0 }], "empty.json": [new Uint8Array(), { level: 0 }] });
    const file = new Blob([zip]);
    const [a, empty] = await listZip(file);
    expect(await readZipText(file, a)).toBe("[1,2]");
    expect(await readZipText(file, empty)).toBe("");
  });

  it("follows ZIP64 records for exports over 4 GB", async () => {
    const name = strToU8("conversations.json");
    const data = strToU8("[]");
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(26, name.length, true);
    const localBytes = [new Uint8Array(local.buffer), name, data];
    const cdOffset = 30 + name.length + data.length;
    const cd = new DataView(new ArrayBuffer(46 + 4 + 24));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint32(20, 0xffffffff, true);
    cd.setUint32(24, 0xffffffff, true);
    cd.setUint16(28, name.length, true);
    cd.setUint16(30, 28, true);
    cd.setUint32(42, 0xffffffff, true);
    const extra = new DataView(new ArrayBuffer(28));
    extra.setUint16(0, 1, true);
    extra.setUint16(2, 24, true);
    extra.setUint32(4, data.length, true);
    extra.setUint32(12, data.length, true);
    extra.setUint32(20, 0, true);
    const cdBytes = [new Uint8Array(cd.buffer, 0, 46), name, new Uint8Array(extra.buffer)];
    const cdSize = 46 + name.length + 28;
    const z64 = new DataView(new ArrayBuffer(56));
    z64.setUint32(0, 0x06064b50, true);
    z64.setUint32(32, 1, true);
    z64.setUint32(40, cdSize, true);
    z64.setUint32(48, cdOffset, true);
    const loc = new DataView(new ArrayBuffer(20));
    loc.setUint32(0, 0x07064b50, true);
    loc.setUint32(8, cdOffset + cdSize, true);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(10, 0xffff, true);
    end.setUint32(12, 0xffffffff, true);
    end.setUint32(16, 0xffffffff, true);
    const file = new Blob([...localBytes, ...cdBytes, z64.buffer, loc.buffer, end.buffer]);
    const [e] = await listZip(file);
    expect(e).toMatchObject({ name: "conversations.json", compressedSize: 2, size: 2, headerOffset: 0 });
    expect(await readZipText(file, e)).toBe("[]");
  });

  it("rejects a file that isn't a zip", async () => {
    await expect(listZip(new Blob(["not a zip"]))).rejects.toThrow();
  });
});

describe("readExportFile", () => {
  it("measures a ChatGPT .zip without the rest of the archive", async () => {
    const zip = zipSync({ "file-1.jpg": [noise(100_000), { level: 0 }], "conversations.json": strToU8(chats) });
    const u = await readExportFile(new File([zip], "export.zip"));
    expect(u?.provider).toBe("chatgpt");
    expect(u?.turns).toHaveLength(1);
  });

  it("returns null for a .zip with no chats", async () => {
    const zip = zipSync({ "photo.jpg": strToU8("x") });
    expect(await readExportFile(new File([zip], "photos.zip"))).toBeNull();
  });

  it("still reads a bare conversations.json", async () => {
    const u = await readExportFile(new File([chats], "conversations.json"));
    expect(u?.turns).toHaveLength(1);
  });
});
