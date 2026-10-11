import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const client = await db();
  await client.execute({ sql: "INSERT OR IGNORE INTO waitlist (email) VALUES (?)", args: [email] });
  return NextResponse.json({ ok: true });
}
