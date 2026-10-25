import type { Metadata } from "next";
import * as F from "@/lib/factors";
import { usd } from "@/lib/pricing";
import { codingHour, codingPlanMonth, questionBySlug, SOURCES } from "@/lib/questions";
import { Cite, life, energy, mass, Method, QuestionPage, Receipt, volume } from "@/components/QuestionPage";

const q = questionBySlug("claude-code-energy-use")!;
export const metadata: Metadata = { title: q.title, description: q.description, alternates: { canonical: `/questions/${q.slug}` } };

const PLANS = [
  { key: "pro", name: "Pro" },
  { key: "max_5x", name: "Max 5x" },
  { key: "max_20x", name: "Max 20x" },
] as const;

export default function Page() {
  const hour = codingHour();
  const prompts = Math.round(F.WH_PER_CLAUDE_CODE_HOUR / F.WH_PER_AI_PROMPT);
  const [low, high] = F.WH_PER_CLAUDE_CODE_HOUR_RANGE;
  const pro = codingPlanMonth("pro");
  return (
    <QuestionPage
      q={q}
      answer={
        <p>
          I estimate about {energy(F.WH_PER_CLAUDE_CODE_HOUR)} for an hour of Claude Code, or {energy(hour.totalWh)} with its share of
          training. That&apos;s as much as {prompts.toLocaleString("en-US")} typical chat prompts, and about {mass(hour.impacts.carbon)} of
          CO₂e. The real figure could be anywhere from {low} to {high} Wh an hour, depending on the model and how much code it reads.
        </p>
      }
      receipts={
        <>
          <Receipt
            title="One hour"
            rows={[
              ["Energy to run it", energy(hour.answerWh)],
              ["Share of training", energy(hour.totalWh - hour.answerWh)],
              ["Carbon", `${mass(hour.impacts.carbon)} CO₂e`],
              ["Water consumed", volume(hour.water.total)],
            ]}
            total={["Energy in all", energy(hour.totalWh)]}
          />
          <Receipt
            title="A month using a whole Pro limit"
            rows={[
              ["Hours", Math.round(pro.hours).toLocaleString("en-US")],
              ["Carbon", `${mass(pro.impacts.carbon)} CO₂e`],
              ["Healthy life lost", life(pro.impacts.air)],
            ]}
            total={["To offset, a month", usd(pro.charged.total)]}
          />
        </>
      }
      how={
        <>
          <p>
            A coding agent works very differently from a chat. Each step re-reads a large part of your code and the conversation so far,
            most of it from a cache, and an hour can run to millions of tokens. I priced a typical day of tokens at the per-token energy
            worked back from <Cite s={SOURCES.epoch} /> and <Cite s={SOURCES.google} />, which gives about {F.WH_PER_CLAUDE_CODE_HOUR} Wh an
            hour. Nobody outside the AI companies has measured it directly, so treat it as rough.
          </p>
          <p>
            Claude&apos;s apps don&apos;t list Claude Code sessions, so when you link a Claude account I read how much of your weekly limit you
            used. Each plan&apos;s limit is a number of hours a week; I take the low end: {F.CLAUDE_WEEKLY_HOURS.pro} for Pro,{" "}
            {F.CLAUDE_WEEKLY_HOURS.max_5x} for Max 5x and {F.CLAUDE_WEEKLY_HOURS.max_20x} for Max 20x. ChatGPT&apos;s Codex and agent report
            tokens instead, which I count at about {F.WH_PER_MILLION_AGENT_TOKENS} Wh a million.
          </p>
          <p>
            Carbon, training and water are counted the same way as for chat: power at the plants that ramp up for new demand (
            <Cite s={SOURCES.avert} />
            ), {Math.round(F.AI_TRAINING_SHARE * 100)}% of energy for training (<Cite s={SOURCES.patterson} />
            ), and a quarter more carbon for the chips and buildings. Every factor and source is on <Method />.
          </p>
        </>
      }
      cover={
        <>
          <p>If you used your whole weekly limit every week, offsetting it would cost about this each month, with fees:</p>
          <ul className="figures divide-y divide-border border-y border-rule text-sm text-foreground">
            {PLANS.map((p) => {
              const m = codingPlanMonth(p.key);
              return (
                <li key={p.key} className="flex justify-between gap-4 py-2">
                  <span className="font-sans">
                    {p.name} <span className="text-muted">· {Math.round(m.hours).toLocaleString("en-US")} hours</span>
                  </span>
                  <span>
                    {mass(m.impacts.carbon)} CO₂e · {usd(m.charged.total)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p>Linking your Claude account counts only the share of the limit you actually used.</p>
        </>
      }
    />
  );
}
