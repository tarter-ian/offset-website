import { NextResponse } from "next/server";
import { isCode, normalizeEmail } from "@/lib/account";
import { guarded, json, withSessionCookie } from "@/lib/accountHttp";
import { accountFor, finishSignIn, newSession } from "@/lib/accountStore";

export const dynamic = "force-dynamic";

/** Signs in with the emailed code or link token, making the account the first time. */
export async function POST(req: Request) {
  return guarded(req, async () => {
    const body = (await req.json().catch(() => null)) as { email?: unknown; code?: unknown; token?: unknown } | null;
    const email = normalizeEmail(body?.email);
    const code = isCode(body?.code) ? body.code : undefined;
    const token = typeof body?.token === "string" && /^[0-9a-f]{48}$/.test(body.token) ? body.token : undefined;
    if (!email || (!code && !token)) return json({ error: "Enter the 6-digit code from the email." }, 400);
    if (!(await finishSignIn(email, { code, token }))) {
      return json({ error: token ? "This link has expired or was already used. Send a new one." : "That code isn't right, or it has expired." }, 400);
    }
    const account = await accountFor(email);
    const session = await newSession(account.id);
    const res = NextResponse.json({ email: account.email, covered: account.covered }, { headers: { "cache-control": "no-store" } });
    return withSessionCookie(res, session, new URL(req.url).protocol === "https:");
  });
}
