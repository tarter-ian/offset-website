import type { Metadata } from "next";
import * as F from "@/lib/factors";
import { MARGINS } from "@/lib/footprint";
import { impactCost, usd, WATER_MODES, DEFAULT_WATER_MODE } from "@/lib/pricing";
import { aiAnswer, questionBySlug, SOURCES, TYPICAL_PROMPTS_PER_DAY, typicalChatMonth } from "@/lib/questions";
import { Cite, mass, Method, QuestionPage, Receipt, volume } from "@/components/QuestionPage";

const q = questionBySlug("how-much-water-does-chatgpt-use")!;
export const metadata: Metadata = { title: q.title, description: q.description, alternates: { canonical: `/questions/${q.slug}` } };

export default function Page() {
  const one = aiAnswer(F.WH_PER_AI_PROMPT);
  const month = typicalChatMonth();
  const perBottle = Math.round(0.5 / one.water.total);
  const waterCost = impactCost(month.impacts).water * (1 + MARGINS.estimated);
  return (
    <QuestionPage
      q={q}
      answer={
        <p>
          About {volume(one.water.total)} for a typical prompt, counting its share of training. Only {volume(one.water.cooling)} of that
          evaporates cooling the data center; the other {volume(one.water.power)} is used up at the power plants that make its electricity.
          That&apos;s a half-liter bottle every {perBottle} prompts or so, and about {volume(month.water.total)} for a month of everyday
          use.
        </p>
      }
      receipts={
        <>
          <Receipt
            title="One prompt"
            rows={[
              ["Data center cooling", volume(one.water.cooling)],
              ["Power plants", volume(one.water.power)],
            ]}
            total={["Water consumed", volume(one.water.total)]}
          />
          <Receipt
            title={`A month at ${TYPICAL_PROMPTS_PER_DAY} prompts a day`}
            rows={[
              ["Data center cooling", volume(month.water.cooling)],
              ["Power plants", volume(month.water.power)],
              ["Carbon, for comparison", `${mass(month.impacts.carbon)} CO₂e`],
            ]}
            total={["Water consumed", volume(month.water.total)]}
          />
        </>
      }
      how={
        <>
          <p>
            I start from the energy: about {F.WH_PER_AI_PROMPT} Wh to answer a prompt (<Cite s={SOURCES.epoch} />), plus its share of
            training the model, which is about {Math.round(F.AI_TRAINING_SHARE * 100)}% of machine learning energy (
            <Cite s={SOURCES.patterson} />
            ). <Cite s={SOURCES.google} /> imply about {F.DATACENTER_L_PER_KWH} liters of cooling water per kWh of server power. Power
            plants on the US grid consume about {F.GRID_L_PER_KWH} liters per kWh, mostly in cooling towers (<Cite s={SOURCES.li} />
            ), and {Math.round(F.GRID_LINE_LOSS * 100)}% of the power is lost on the way.
          </p>
          <p>
            These are liters consumed, meaning evaporated or otherwise not returned, not liters withdrawn and given back. Where the water comes
            from matters more than the amount, and I assume about {Math.round(F.STRESSED_WATER_SHARE.datacenter * 100)}% of data center
            water and {Math.round(F.STRESSED_WATER_SHARE.grid * 100)}% of power plant water comes from water-stressed areas. When I price
            it, a liter from a stressed basin counts in full and a liter from a well-watered one counts{" "}
            {Math.round(F.UNSTRESSED_WATER_WEIGHT * 100)}%, which brings a prompt to {volume(one.impacts.water)} of scarce water.
          </p>
          <p>
            Every factor and source is on <Method />.
          </p>
        </>
      }
      cover={
        <>
          <p>
            The water in a month of everyday use costs {usd(waterCost)} to cover, at {usd(WATER_MODES[DEFAULT_WATER_MODE].per1000Gal)} per
            1,000 scarce gallons, which funds paid water-saving work in dry regions. Covering all of a month&apos;s AI use, with its carbon and
            air pollution, comes to {usd(month.donation)} in donations.
          </p>
          <p>
            That&apos;s below the {usd(month.monthly.donation)} smallest payment, so most people pay once: {usd(month.lifetime.total)} with
            fees covers past use and every year ahead.
          </p>
        </>
      }
    />
  );
}
