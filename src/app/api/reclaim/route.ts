import { NextResponse } from "next/server";
import { enabledReclaimServices } from "@/lib/reclaim";

/** Which services can be signed in to right now. */
export function GET() {
  return NextResponse.json({ services: enabledReclaimServices() });
}
