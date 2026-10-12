import { NextResponse } from "next/server";
import { db, rowsOf } from "@/lib/db";
import { paidRows } from "@/lib/everyWebhook";
import { PLAN_ID } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Which gifts of a checkout Every.org has confirmed, so the return page can show
 * a payment really arrived. Returns row keys only, never emails or amounts.
 */
export async function GET(req: Request) {
  const plan = new URL(req.url).searchParams.get("plan") ?? "";
  const headers = { "cache-control": "private, no-store" };
  if (!PLAN_ID.test(plan)) return NextResponse.json({ error: "Unknown plan." }, { status: 400, headers });
  try {
    const result = await (await db()).execute({
      sql: "SELECT partner_donation_id FROM donations WHERE partner_donation_id LIKE ?",
      args: [`${plan}.%`],
    });
    const ids = rowsOf(result).map((r) => (typeof r.partner_donation_id === "string" ? r.partner_donation_id : null));
    return NextResponse.json({ paid: paidRows(plan, ids) }, { headers });
  } catch {
    return NextResponse.json({ paid: [] }, { status: 503, headers });
  }
}
