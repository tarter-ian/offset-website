import type { Metadata } from "next";
import * as F from "@/lib/factors";
import { usd } from "@/lib/pricing";
import { DEFAULT_CONTEXT } from "@/lib/store";
import { aiAnswer, questionBySlug, SOURCES, TYPICAL_PROMPTS_PER_DAY, typicalChatMonth } from "@/lib/questions";
import { Cite, life, energy, mass, Method, QuestionPage, Receipt, volume } from "@/components/QuestionPage";

const q = questionBySlug("how-much-energy-does-a-chatgpt-prompt-use")!;
export const metadata: Metadata = { title: q.title, description: q.description, alternates: { canonical: `/questions/${q.slug}` } };

export default function Page() {
  const one = aiAnswer(F.WH_PER_AI_PROMPT);
  const month = typicalChatMonth();
  const streamPrompts = Math.round((F.STREAMING_KWH_PER_HOUR * 1000) / one.totalWh);
  return (
    <QuestionPage
      q={q}
      answer={
        <p>
          About {energy(F.WH_PER_AI_PROMPT)} to answer a typical text prompt. Counting its share of the energy spent training the model,
          it comes to about {energy(one.totalWh)}, which puts about {mass(one.impacts.carbon)} of CO₂e in the air. An hour of streamed
          video uses about as much as {streamPrompts} prompts.
        </p>
      }
      receipts={
        <>
          <Receipt
            title="One prompt"
            rows={[
              ["Energy to answer it", energy(one.answerWh)],
              ["Share of training", energy(one.totalWh - one.answerWh)],
              ["Carbon", `${mass(one.impacts.carbon)} CO₂e`],
              ["Water consumed", volume(one.water.total)],
            ]}
            total={["Energy in all", energy(one.totalWh)]}
          />
          <Receipt
            title={`A month at ${TYPICAL_PROMPTS_PER_DAY} prompts a day`}
            rows={[
              ["Prompts, with AI in search and apps", Math.round(month.promptsPerMonth).toLocaleString("en-US")],
              ["Energy, with training", energy(month.answerWh / (1 - F.AI_TRAINING_SHARE))],
              ["Carbon", `${mass(month.impacts.carbon)} CO₂e`],
              ["Healthy life lost", life(month.impacts.air)],
              ["Water consumed", volume(month.water.total)],
            ]}
          />
        </>
      }
      how={
        <>
          <p>
            The {energy(F.WH_PER_AI_PROMPT)} is <Cite s={SOURCES.epoch} />
            &apos;s estimate for a typical ChatGPT reply of a few hundred words. Long chats cost more, because each turn re-reads the whole
            conversation, and reasoning models write hidden thinking before they answer. When you link your account we measure your own
            chats instead.
          </p>
          <p>
            About {Math.round(F.AI_TRAINING_SHARE * 100)}% of machine learning energy goes to training models rather than answering prompts (
            <Cite s={SOURCES.patterson} />, from Google), so each prompt carries its share. AI is new demand on the grid, so we count its
            carbon at the power plants that ramp up to meet it, mostly gas, at about {F.AI_NEW_POWER_LB_PER_MWH.toLocaleString("en-US")} lb
            of CO₂ a MWh (<Cite s={SOURCES.avert} />). We add {Math.round(F.GRID_UPSTREAM_SHARE * 100)}% for getting the fuel to the plant,{" "}
            {Math.round(F.GRID_LINE_LOSS * 100)}% for power lost on the wires, and a quarter for making the chips and building the data
            centers.
          </p>
          <p>
            Every factor and source is on <Method />.
          </p>
        </>
      }
      cover={
        <>
          <p>
            A month at {TYPICAL_PROMPTS_PER_DAY} prompts a day comes to {usd(month.donation)} in donations, including our margin for an
            estimate. That&apos;s below our {usd(month.monthly.donation)} smallest payment, so most people pay once instead. For someone
            born in {DEFAULT_CONTEXT.birthYear}, {usd(month.lifetime.total)} with fees covers everything since late 2022 and every year to
            age {F.LIFETIME_TO_AGE}, with room for use to grow.
          </p>
          <p>The money goes to charities that work on climate policy, clean air, water in dry places and protecting forest.</p>
        </>
      }
    />
  );
}
