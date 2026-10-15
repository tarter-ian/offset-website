import { NextResponse } from "next/server";
import { db, NoDatabaseError } from "@/lib/db";
import { PLEDGE_MAX_BODY, PLEDGE_SIGNATURE_HEADER, verifyPledgeSignature } from "@/lib/pledgeWebhook";

export const dynamic = "force-dynamic";

/**
 * Pledge's webhook. The signature is checked against the raw body with
 * PLEDGE_API_KEY, then the body is stored as it came in pledge_events. Nothing
 * is marked confirmed from it: Pledge doesn't document the payload, so matching
 * a notice to a plan or gift waits until a real one has arrived and been read.
 */
export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > PLEDGE_MAX_BODY) return NextResponse.json({ error: "Too large." }, { status: 413 });
  if (!(await verifyPledgeSignature(body, req.headers.get(PLEDGE_SIGNATURE_HEADER), process.env.PLEDGE_API_KEY))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await (await db()).execute({ sql: "INSERT INTO pledge_events (body, received_at) VALUES (?, ?)", args: [body, new Date().toISOString()] });
  } catch (e) {
    // A 5xx asks Pledge to try again later. Only the error is logged, never the body or the key.
    console.error("pledge-webhook: couldn't store event", e instanceof NoDatabaseError ? "no database" : e);
    return NextResponse.json({ error: "Couldn't store it." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
