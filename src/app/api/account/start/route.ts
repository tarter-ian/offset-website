import { normalizeEmail } from "@/lib/account";
import { sendSignIn } from "@/lib/accountEmails";
import { guarded, json } from "@/lib/accountHttp";
import { startSignIn } from "@/lib/accountStore";

export const dynamic = "force-dynamic";

/** Emails a sign-in code and link. Answers the same whether or not the address has an account. */
export async function POST(req: Request) {
  return guarded(req, async () => {
    const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
    const email = normalizeEmail(body?.email);
    if (!email) return json({ error: "That doesn't look like an email address." }, 400);
    const started = await startSignIn(email);
    if (!started) return json({ error: "We just sent one. Check your inbox, or wait a minute to send another." }, 429);
    const sent = await sendSignIn(email, new URL(req.url).origin, started.code, started.token);
    if (!sent) return json({ error: "We couldn't send the email. Try again in a minute." }, 502);
    return json({ ok: true });
  });
}
