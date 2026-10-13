import { NextResponse } from "next/server";
import { accountsOn } from "@/lib/account";
import { markReminded, reminderTargets } from "@/lib/accountStore";
import { sendEmail } from "@/lib/email";
import { offeredSecret, safeEqual } from "@/lib/everyWebhook";
import { reminderEmail, reminderFor } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Sends the monthly "your month is ready" emails that are due. Called once a
 * day by the worker's cron trigger, with CRON_SECRET as a bearer token.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const offered = offeredSecret(req);
  if (!secret || !offered || !(await safeEqual(offered, secret))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!accountsOn()) return NextResponse.json({ sent: 0, note: "Accounts are off." });
  const origin = process.env.SITE_ORIGIN || new URL(req.url).origin;
  let sent = 0;
  for (const a of await reminderTargets()) {
    const r = reminderFor(a.covered, a.remindedFor);
    if (!r) continue;
    const e = reminderEmail(r, origin, a.emailToken);
    // Marked only once sent, so a failed send is tried again tomorrow.
    if (await sendEmail(a.email, e.subject, e.text)) {
      await markReminded(a.id, r.ended);
      sent++;
    }
  }
  return NextResponse.json({ sent });
}
