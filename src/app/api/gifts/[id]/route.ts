import { NextResponse } from "next/server";
import { db, rowsOf } from "@/lib/db";
import { type Gift, giftPaid, giftRows } from "@/lib/gifts";
import { PLAN_ID } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * A gift for its card: what it covers, the names and note, and whether every
 * charity's gift has arrived. Only someone with the link's random id can read it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "cache-control": "private, no-store" };
  if (!PLAN_ID.test(id)) return NextResponse.json({ error: "Unknown gift." }, { status: 404, headers });
  try {
    const database = await db();
    const [row] = rowsOf(
      await database.execute({ sql: "SELECT product_id, span, from_name, to_name, note, created_at FROM gifts WHERE id = ?", args: [id] }),
    );
    if (!row) return NextResponse.json({ error: "Unknown gift." }, { status: 404, headers });
    const gift: Gift = {
      id,
      productId: String(row.product_id),
      span: row.span === "life" ? "life" : "year",
      from: String(row.from_name),
      to: String(row.to_name),
      note: String(row.note ?? ""),
      createdAt: String(row.created_at),
    };
    const donations = rowsOf(
      await database.execute({ sql: "SELECT partner_donation_id, amount FROM donations WHERE partner_donation_id LIKE ?", args: [`${id}.%`] }),
    ).map((d) => ({ partnerDonationId: typeof d.partner_donation_id === "string" ? d.partner_donation_id : null, amount: Number(d.amount) || 0 }));
    return NextResponse.json({ gift, paid: giftPaid(id, giftRows(gift.productId, gift.span), donations) }, { headers });
  } catch {
    return NextResponse.json({ error: "Couldn't look it up." }, { status: 503, headers });
  }
}
