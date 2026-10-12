// Sending email through Resend (resend.com), with RESEND_API_KEY and EMAIL_FROM
// set in Cloudflare. Without a key, nothing is sent: in development the message
// is printed instead, so sign-in can be tried locally.

export const emailOn = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailOn()) {
    if (process.env.NODE_ENV !== "production") console.log(`[email to ${to}] ${subject}\n${text}`);
    return process.env.NODE_ENV !== "production";
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    });
    if (!r.ok) console.error("email: Resend refused", r.status);
    return r.ok;
  } catch (e) {
    console.error("email: couldn't reach Resend", e);
    return false;
  }
}
