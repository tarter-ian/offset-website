import { describe, expect, it } from "vitest";
import { cleanCovered, coversAll, isCode, mergeCovered, newCode, normalizeEmail } from "./account";

describe("normalizeEmail", () => {
  it("trims and lowers", () => expect(normalizeEmail("  Ian@Example.COM ")).toBe("ian@example.com"));
  it("rejects non-addresses", () => {
    expect(normalizeEmail("ian")).toBeNull();
    expect(normalizeEmail("a b@c.de")).toBeNull();
    expect(normalizeEmail(3)).toBeNull();
  });
});

describe("codes", () => {
  it("makes six digits", () => {
    for (let i = 0; i < 50; i++) expect(isCode(newCode())).toBe(true);
  });
  it("only accepts six digits", () => {
    expect(isCode("12345")).toBe(false);
    expect(isCode("12345a")).toBe(false);
  });
});

describe("cleanCovered", () => {
  it("keeps valid items and drops the rest", () =>
    expect(
      cleanCovered({
        ai: { kind: "life", since: "2026-03-01T00:00:00Z", extra: 1 },
        video: { kind: "period", until: "2026-11-01T00:00:00Z", giftFrom: " Sam " },
        bad: { kind: "period" },
        "Bad Id": { kind: "life" },
      }),
    ).toEqual({ ai: { kind: "life", since: "2026-03-01T00:00:00Z" }, video: { kind: "period", until: "2026-11-01T00:00:00Z", giftFrom: "Sam" } }));
  it("ignores non-objects", () => expect(cleanCovered([1])).toEqual({}));
});

describe("mergeCovered", () => {
  const p = (until: string, since?: string) => ({ kind: "period" as const, until, ...(since ? { since } : {}) });
  it("prefers life, then the later end, and keeps the first start", () => {
    expect(mergeCovered({ ai: p("2026-11-01", "2026-05-01") }, { ai: { kind: "life", since: "2026-06-01" } })).toEqual({ ai: { kind: "life", since: "2026-05-01" } });
    expect(mergeCovered({ v: p("2026-11-01", "2026-06-01") }, { v: p("2026-12-01", "2026-07-01") })).toEqual({ v: p("2026-12-01", "2026-06-01") });
    expect(mergeCovered({ a: { kind: "life" } }, { b: p("2026-12-01") })).toEqual({ a: { kind: "life" }, b: p("2026-12-01") });
  });
  it("tells when one record already covers another", () => {
    expect(coversAll({ a: { kind: "life" } }, { a: p("2026-12-01") })).toBe(true);
    expect(coversAll({ a: p("2026-11-01") }, { a: p("2026-12-01") })).toBe(false);
  });
});
