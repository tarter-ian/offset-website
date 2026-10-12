import { NextResponse } from "next/server";
import { db, NoDatabaseError } from "@/lib/db";
import { offeredSecret, parseEveryWebhook, safeEqual } from "@/lib/everyWebhook";

export const dynamic = "force-dynamic";

/**
 * Every.org's partner webhook: one POST per gift made through our donate links.
 * Every.org doesn't sign these, so the URL set in its dashboard carries a shared
 * secret (EVERY_WEBHOOK_SECRET), checked in constant time. Each gift is stored
 * once by its charge id.
 */
export async function POST(req: Request) {
  const secret = process.env.EVERY_WEBHOOK_SECRET;
  const offered = offeredSecret(req);
  if (!secret || !offered || !(await safeEqual(offered, secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body isn't JSON." }, { status: 400 });
  }
  const parsed = parseEveryWebhook(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.donation;
  try {
    await (await db()).execute({
      sql: `INSERT OR IGNORE INTO donations (charge_id, partner_donation_id, nonprofit, amount, net_amount, frequency, email, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [d.chargeId, d.partnerDonationId, d.nonprofit, d.amount, d.netAmount, d.frequency, d.email, d.createdAt],
    });
  } catch (e) {
    // A 5xx asks Every.org to try again later.
    console.error("every-webhook: couldn't store donation", e instanceof NoDatabaseError ? "no database" : e);
    return NextResponse.json({ error: "Couldn't store it." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
