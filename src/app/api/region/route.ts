import { NextResponse } from "next/server";
import { STATES, type StateCode } from "@/lib/data/states";

export const dynamic = "force-dynamic";

/**
 * The visitor's US state, from the location Vercel attaches to each request
 * by IP address. Only the state code is returned, and nothing is stored.
 */
export function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country");
  const region = req.headers.get("x-vercel-ip-country-region")?.toUpperCase();
  const state = country === "US" && region && region in STATES ? (region as StateCode) : null;
  return NextResponse.json({ state }, { headers: { "cache-control": "private, no-store" } });
}
