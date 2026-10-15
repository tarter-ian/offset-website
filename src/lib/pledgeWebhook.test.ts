import { describe, expect, it } from "vitest";
import { verifyPledgeSignature } from "./pledgeWebhook";

// Pledgeling-Signature is base64(HMAC-SHA256(raw body)), keyed with the partner's API key.
const KEY = "test-api-key";
const body = '{"event":"donation","amount":"1.00"}';

async function sign(raw: string, key: string) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(raw)))));
}

describe("verifyPledgeSignature", () => {
  it("accepts the body's own signature", async () => {
    expect(await verifyPledgeSignature(body, await sign(body, KEY), KEY)).toBe(true);
  });

  it("matches a known HMAC-SHA256 vector", async () => {
    // RFC 4231 test case 2: key "Jefe", data "what do ya want for nothing?".
    const sig = Buffer.from("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843", "hex").toString("base64");
    expect(await verifyPledgeSignature("what do ya want for nothing?", sig, "Jefe")).toBe(true);
  });

  it("rejects a changed body, the wrong key, and missing or broken signatures", async () => {
    const sig = await sign(body, KEY);
    expect(await verifyPledgeSignature(body.replace("1.00", "9.00"), sig, KEY)).toBe(false);
    expect(await verifyPledgeSignature(body, sig, "another-key")).toBe(false);
    expect(await verifyPledgeSignature(body, await sign(body, "another-key"), KEY)).toBe(false);
    expect(await verifyPledgeSignature(body, null, KEY)).toBe(false);
    expect(await verifyPledgeSignature(body, "", KEY)).toBe(false);
    expect(await verifyPledgeSignature(body, "not base64!", KEY)).toBe(false);
    expect(await verifyPledgeSignature(body, sig.slice(0, 20), KEY)).toBe(false);
  });

  it("rejects everything when no key is set", async () => {
    expect(await verifyPledgeSignature(body, await sign(body, KEY), undefined)).toBe(false);
    expect(await verifyPledgeSignature(body, await sign(body, KEY), "")).toBe(false);
  });
});
