import { SIGN_IN_MINUTES } from "./account";
import { sendEmail } from "./email";

// The two emails accounts send. Plain text, short, and no usage numbers in them.

export function sendSignIn(email: string, origin: string, code: string, token: string, next?: "delete") {
  const link = `${origin}/signin?email=${encodeURIComponent(email)}&t=${token}${next ? `&next=${next}` : ""}`;
  const why = next === "delete" ? "to finish deleting your My Offset account" : "to sign in to My Offset";
  return sendEmail(
    email,
    `${code} is your My Offset code`,
    `Your code ${why} is ${code}.\n\nOr open this link on the device you're signing in on:\n${link}\n\nBoth work once and for ${SIGN_IN_MINUTES} minutes. If you didn't ask for this, you can ignore it; nothing happens without the code.\n\nMy Offset`,
  );
}

export function sendDeleted(email: string) {
  return sendEmail(
    email,
    "Your My Offset account was deleted",
    `Your My Offset account and everything it held (this email address and what you'd offset) were deleted just now.\n\nYour gifts already went to the charities, and Every.org keeps its own receipts.\n\nIf this wasn't you, reply to this email and tell us.\n\nMy Offset`,
  );
}
