import type { Covered } from "./covered";
import { recordStatus } from "./record";
import { productById } from "./store";

// The monthly email: when a month or year someone covered has ended, one short
// note saying it's ready, with no numbers in it (Ian, 2026-10-12: usage stays on
// their computer). It goes once per ended month, never for someone else's gift,
// and never for what Every.org's autopay already renews (Ian, 2026-10-13).

export interface Reminder {
  ids: string[];
  /** The earliest end date among them; the email goes once per date. */
  ended: string;
}

/** What's ready to cover again, unless the email for it already went out. */
export function reminderFor(covered: Record<string, Covered>, remindedFor: string | null, now: number = Date.now()): Reminder | null {
  const s = recordStatus(covered, now);
  if (s.kind !== "due") return null;
  if (remindedFor && s.ended <= remindedFor) return null;
  return { ids: s.ids, ended: s.ended };
}

/** "AI chat", but lower case after the first word only when it isn't an acronym: "video streaming". */
export const itemName = (id: string) => {
  const n = productById(id)?.name ?? id;
  return /^[A-Z]{2}/.test(n) ? n : n[0].toLowerCase() + n.slice(1);
};

const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

export function reminderEmail(r: Reminder, origin: string, stopToken: string) {
  const what = list(r.ids.map(itemName));
  return {
    subject: "Your next month is ready to offset",
    text:
      `Your ${what} ${r.ids.length > 1 ? "were" : "was"} offset through ${day(r.ended)}.\n\n` +
      `When you have a minute, open your record on the computer you measure with. It counts this month's use there and shows the price before anything is charged:\n${origin}/record\n\n` +
      `Nothing is charged unless you choose to give. If you'd rather not get these, one tap stops them:\n${origin}/reminders/stop?t=${stopToken}\n\nMy Offset`,
  };
}
