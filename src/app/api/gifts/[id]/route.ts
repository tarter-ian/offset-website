import { NextResponse } from "next/server";
import { db, rowsOf } from "@/lib/db";
import { type Gift, GIFT_SPANS, type GiftItem, giftPaid, giftRows } from "@/lib/gifts";
import { DEFAULT_CONTEXT, productById } from "@/lib/store";
import { PLAN_ID } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** A gift's items as saved: the JSON list, or the single item of a gift saved before gifts held several. */
function storedItems(items: unknown, productId: unknown, span: unknown): GiftItem[] {
  try {
    const list = typeof items === "string" ? (JSON.parse(items) as GiftItem[]) : null;
    if (Array.isArray(list)) return list.filter((i) => productById(i?.productId) && GIFT_SPANS.includes(i?.span));
  } catch {
    // Fall back to the first item's columns.
  }
  return [{ productId: String(productId), span: span === "life" ? "life" : "year" }];
}

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
      await database.execute({
        sql: "SELECT product_id, span, items, birth_year, from_name, to_name, note, created_at FROM gifts WHERE id = ?",
        args: [id],
      }),
    );
    if (!row) return NextResponse.json({ error: "Unknown gift." }, { status: 404, headers });
    const gift: Gift = {
      id,
      items: storedItems(row.items, row.product_id, row.span),
      birthYear: typeof row.birth_year === "number" ? row.birth_year : DEFAULT_CONTEXT.birthYear,
      from: String(row.from_name),
      to: String(row.to_name),
      note: String(row.note ?? ""),
      createdAt: String(row.created_at),
    };
    const donations = rowsOf(
      await database.execute({ sql: "SELECT partner_donation_id, amount FROM donations WHERE partner_donation_id LIKE ?", args: [`${id}.%`] }),
    ).map((d) => ({ partnerDonationId: typeof d.partner_donation_id === "string" ? d.partner_donation_id : null, amount: Number(d.amount) || 0 }));
    return NextResponse.json({ gift, paid: giftPaid(id, giftRows(gift.items, gift.birthYear), donations) }, { headers });
  } catch {
    return NextResponse.json({ error: "Couldn't look it up." }, { status: 503, headers });
  }
}
