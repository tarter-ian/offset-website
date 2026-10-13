import { db, rowsOf } from "./db";
import { type Gift, GIFT_SPANS, type GiftItem, giftPaid, giftRows, recipients } from "./gifts";
import { PLAN_ID } from "./payments";
import { DEFAULT_CONTEXT, productById } from "./store";

// Reading a gift back from the database, for its page, its API and its preview image. Server only.

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

/** A gift and whether every charity's gift for it has arrived; null when there's no such gift. Throws when the database can't be reached. */
export async function loadGift(id: string): Promise<{ gift: Gift; paid: boolean } | null> {
  if (!PLAN_ID.test(id)) return null;
  const database = await db();
  const [row] = rowsOf(
    await database.execute({
      sql: "SELECT product_id, span, items, birth_year, from_name, to_name, note, created_at FROM gifts WHERE id = ?",
      args: [id],
    }),
  );
  if (!row) return null;
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
  return { gift, paid: giftPaid(id, giftRows(gift.items, gift.birthYear, recipients(gift).length), donations) };
}
