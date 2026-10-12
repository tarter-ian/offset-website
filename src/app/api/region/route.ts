import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { STATES, type StateCode } from "@/lib/data/states";

export const dynamic = "force-dynamic";

/** Where the host says the request came from: Cloudflare's request info, or Vercel's headers. */
function location(req: Request): { country?: string | null; region?: string | null } {
  try {
    const cf = getCloudflareContext().cf as { country?: string; regionCode?: string } | undefined;
    if (cf?.country) return { country: cf.country, region: cf.regionCode };
  } catch {
    // Not running on Cloudflare.
  }
  return { country: req.headers.get("x-vercel-ip-country"), region: req.headers.get("x-vercel-ip-country-region") };
}

/**
 * The visitor's US state, from the location the host attaches to each request
 * by IP address. Only the state code is returned, and nothing is stored.
 */
export function GET(req: Request) {
  const { country, region } = location(req);
  const code = region?.toUpperCase();
  const state = country === "US" && code && code in STATES ? (code as StateCode) : null;
  return NextResponse.json({ state }, { headers: { "cache-control": "private, no-store" } });
}
