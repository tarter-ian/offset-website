import { NextResponse } from "next/server";
import { accountsOn, SESSION_COOKIE } from "./account";
import { NoDatabaseError } from "./db";
import { sessionFor } from "./accountStore";

// Shared bits of the account routes. Server only.

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/** The session cookie's token, from the request. */
export function cookieToken(req: Request): string | undefined {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([0-9a-f]{64})`));
  return m?.[1];
}

export const currentSession = (req: Request) => sessionFor(cookieToken(req));

/** Refuses requests from other sites: a change must come from one of our own pages. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

/** Runs a route only when accounts are switched on, turning a missing database into a 503. */
export async function guarded(req: Request, run: () => Promise<Response>): Promise<Response> {
  if (!accountsOn()) return json({ error: "Accounts aren't open yet." }, 404);
  if (req.method !== "GET" && !sameOrigin(req)) return json({ error: "Wrong origin." }, 403);
  try {
    return await run();
  } catch (e) {
    console.error("account:", e instanceof NoDatabaseError ? "no database" : e);
    return json({ error: "Something went wrong on my side. Try again in a minute." }, 503);
  }
}

export function withSessionCookie(res: NextResponse, token: string | null, secure: boolean) {
  res.cookies.set(SESSION_COOKIE, token ?? "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: token ? 60 * 60 * 24 * 365 : 0,
  });
  return res;
}
