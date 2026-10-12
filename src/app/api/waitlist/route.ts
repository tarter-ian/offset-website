import { NextResponse } from "next/server";
import { db, NoDatabaseError } from "@/lib/db";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  try {
    const client = await db();
    await client.execute({ sql: "INSERT OR IGNORE INTO waitlist (email) VALUES (?)", args: [email] });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("waitlist", e instanceof NoDatabaseError ? e.message : "database error");
    return NextResponse.json({ error: "We couldn't save your email just now. Please try again later." }, { status: 503 });
  }
}

/** Takes an email off the waitlist. Answers the same whether or not it was there, so it can't be used to check who signed up. */
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  try {
    const client = await db();
    await client.execute({ sql: "DELETE FROM waitlist WHERE email = ?", args: [email] });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("waitlist delete", e instanceof NoDatabaseError ? e.message : "database error");
    return NextResponse.json({ error: "We couldn't reach our database just now. Please try again later." }, { status: 503 });
  }
}
