import { NextResponse } from "next/server";
import { enabledReclaimServices } from "@/lib/reclaim";

/** Which services can be signed in to right now: activity history, and AI accounts (plan only). */
export function GET() {
  return NextResponse.json({ services: enabledReclaimServices("activity"), ai: enabledReclaimServices("ai") });
}
