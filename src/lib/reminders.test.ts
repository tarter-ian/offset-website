import { describe, expect, it } from "vitest";
import { itemName, reminderEmail, reminderFor } from "./reminders";

const NOW = Date.parse("2026-10-13T12:00:00Z");
const ended = { ai: { kind: "period" as const, until: "2026-10-12T00:00:00Z" } };

describe("reminderFor", () => {
  it("is due once a month has ended", () => expect(reminderFor(ended, null, NOW)).toEqual({ ids: ["ai"], ended: "2026-10-12T00:00:00Z" }));
  it("goes once per ended month", () => expect(reminderFor(ended, "2026-10-12T00:00:00Z", NOW)).toBeNull());
  it("goes again for a later month", () => expect(reminderFor(ended, "2026-09-12T00:00:00Z", NOW)).not.toBeNull());
  it("never for a gift or a cover still running", () => {
    expect(reminderFor({ ai: { ...ended.ai, giftFrom: "Sam" } }, null, NOW)).toBeNull();
    expect(reminderFor({ ai: { kind: "period", until: "2026-11-12T00:00:00Z" } }, null, NOW)).toBeNull();
  });
});

describe("reminderEmail", () => {
  it("names the items without numbers", () => {
    const e = reminderEmail({ ids: ["ai", "video"], ended: "2026-10-12T00:00:00Z" }, "https://myoffset.org", "abc");
    expect(e.text).toContain("Your AI chat and video streaming were offset through October 12.");
    expect(e.text).toContain("https://myoffset.org/reminders/stop?t=abc");
    expect(e.text).not.toMatch(/\$|prompts/);
  });
  it("keeps acronyms", () => expect(itemName("ai")).toBe("AI chat"));
});
