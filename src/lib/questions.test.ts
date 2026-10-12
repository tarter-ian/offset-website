import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as F from "./factors";
import { aiImpacts } from "./footprint";
import { aiAnswer, codingHour, codingPlanMonth, QUESTIONS, rawWater, SOURCES, streamingHour, typicalChatMonth, typicalStreamingMonth } from "./questions";

describe("question pages", () => {
  it("have unique slugs and full metadata", () => {
    expect(new Set(QUESTIONS.map((q) => q.slug)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.question.endsWith("?")).toBe(true);
      expect(q.title.length).toBeGreaterThan(10);
      expect(q.description.length).toBeLessThan(170);
      expect(`${q.question} ${q.title} ${q.description}`).not.toMatch(/—/);
    }
  });

  it("cite only sources listed on the method page", () => {
    const method = readFileSync(path.join(__dirname, "../app/method/page.tsx"), "utf8");
    for (const s of Object.values(SOURCES)) expect(method, s.url).toContain(s.url);
  });

  it("work a prompt out from the factors", () => {
    const one = aiAnswer(F.WH_PER_AI_PROMPT);
    expect(one.totalWh).toBeCloseTo(F.WH_PER_AI_PROMPT / (1 - F.AI_TRAINING_SHARE));
    expect(one.impacts).toEqual(aiImpacts(F.WH_PER_AI_PROMPT / 1000));
    expect(one.water.total).toBeCloseTo(one.water.cooling + one.water.power);
    expect(rawWater(1).cooling).toBe(F.DATACENTER_L_PER_KWH);
  });

  it("price a typical month the way the calculator does", () => {
    const m = typicalChatMonth();
    expect(m.donation).toBeGreaterThan(0);
    expect(m.monthly.donation).toBeGreaterThanOrEqual(1);
    expect(m.lifetime.total).toBeGreaterThan(m.lifetime.donation);
    const s = typicalStreamingMonth();
    expect(s.donation).toBeGreaterThan(0);
    expect(streamingHour().impacts.carbon).toBeGreaterThan(F.KG_PER_STREAMING_HOUR);
  });

  it("scale coding agents with the weekly limits", () => {
    expect(codingHour().answerWh).toBe(F.WH_PER_CLAUDE_CODE_HOUR);
    const pro = codingPlanMonth("pro");
    const max = codingPlanMonth("max_20x");
    expect(max.impacts.carbon / pro.impacts.carbon).toBeCloseTo(F.CLAUDE_WEEKLY_HOURS.max_20x / F.CLAUDE_WEEKLY_HOURS.pro);
    expect(pro.charged.total).toBeGreaterThan(pro.donation);
  });
});
