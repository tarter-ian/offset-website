// Pledge's webhook (pledge.to): a POST to the endpoint set in Pledge's Impact Hub,
// signed in the Pledgeling-Signature header as base64(HMAC-SHA256(raw body)), keyed
// with the partner's primary API key (PLEDGE_API_KEY). Pledge doesn't document the
// body, so it's kept as it came and nothing is read from it yet.

export const PLEDGE_SIGNATURE_HEADER = "Pledgeling-Signature";
/** Larger than any donation notice should be; anything bigger isn't stored. */
export const PLEDGE_MAX_BODY = 64 * 1024;

const fromBase64 = (s: string): Uint8Array<ArrayBuffer> | null => {
  try {
    return Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

/**
 * Whether a webhook's signature matches its raw body under this key. Web Crypto's
 * HMAC verify compares in constant time, so how much of a forged signature matches doesn't leak.
 */
export async function verifyPledgeSignature(rawBody: string, signature: string | null, apiKey: string | undefined): Promise<boolean> {
  if (!apiKey || !signature) return false;
  const sig = fromBase64(signature);
  if (!sig?.length) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(apiKey), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(rawBody));
}
