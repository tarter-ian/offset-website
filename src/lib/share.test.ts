import { describe, expect, it } from "vitest";
import * as F from "./factors";
import { aiImpacts } from "./footprint";
import { aiMonthTotals, parseShare, SHARE_MAX, shareLines, shareQuery } from "./share";

describe("share links", () => {
  it("reads only c and m, as plain non-negative numbers", () => {
    expect(parseShare(new URLSearchParams("c=1.25&m=3&email=a@b.c"))).toEqual({ carbon: 1.25, lifeMinutes: 3 });
    expect(parseShare({ c: ["2", "9"], m: undefined })).toEqual({ carbon: 2, lifeMinutes: 0 });
    for (const bad of ["-4", "abc", "1e3", "Infinity", "NaN", "", "0x10", "3;drop"]) {
      expect(parseShare(new URLSearchParams({ c: bad, m: bad }))).toEqual({ carbon: 0, lifeMinutes: 0 });
    }
  });

  it("clamps huge values", () => {
    expect(parseShare(new URLSearchParams("c=99999999&m=99999999"))).toEqual({ carbon: SHARE_MAX.carbon, lifeMinutes: SHARE_MAX.lifeMinutes });
  });

  it("round-trips through a link at the precision the card shows", () => {
    const q = shareQuery({ carbon: 0.123456, lifeMinutes: 42.7 });
    expect(q).toBe("c=0.12&m=43");
    expect(parseShare(new URLSearchParams(q))).toEqual({ carbon: 0.12, lifeMinutes: 43 });
    expect(shareQuery({ carbon: -1, lifeMinutes: NaN })).toBe("c=0&m=0");
  });

  it("counts a month of AI from the same factors as the footprint", () => {
    const t = aiMonthTotals({ prompts: 10, images: 0, videos: 0 }, {});
    const wh = (10 + F.AI_BUILT_IN_PROMPTS_PER_DAY) * F.DAYS_PER_MONTH * F.WH_PER_AI_PROMPT;
    expect(t.carbon).toBeCloseTo(aiImpacts(wh / 1000).carbon, 10);
    expect(t.lifeMinutes).toBeCloseTo(aiImpacts(wh / 1000).air * F.MINUTES_OF_LIFE_PER_DAMAGE_USD, 10);
    // Measured energy per prompt and media raise it.
    expect(aiMonthTotals({ prompts: 10, images: 2, videos: 1 }, { aiWhPerPrompt: 1 }).carbon).toBeGreaterThan(t.carbon);
    expect(aiMonthTotals({ prompts: -5, images: NaN, videos: 0 }, {}).carbon).toBeGreaterThan(0);
  });

  it("formats the card lines", () => {
    expect(shareLines({ carbon: 1.5, lifeMinutes: 0.5 })).toEqual({ carbon: "1.50 kg CO₂e", life: "30 sec" });
  });
});
