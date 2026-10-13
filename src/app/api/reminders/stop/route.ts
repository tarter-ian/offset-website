import { NextResponse } from "next/server";
import { stopRemindersByToken } from "@/lib/accountStore";
import { sameOrigin } from "@/lib/accountHttp";

export const dynamic = "force-dynamic";

/** The email's stop link, confirmed with a tap on our page (a POST, so mail scanners opening the link don't stop anything). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Wrong origin." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const ok = typeof body?.token === "string" && (await stopRemindersByToken(body.token).catch(() => false));
  return NextResponse.json(ok ? { stopped: true } : { error: "That link didn't match an account. Sign in and turn the emails off from your record." }, { status: ok ? 200 : 400 });
}
