import type { Metadata } from "next";
import * as F from "@/lib/factors";
import { usd } from "@/lib/pricing";
import { DEFAULT_CONTEXT } from "@/lib/store";
import { questionBySlug, rawWater, SOURCES, streamingHour, TYPICAL_STREAMING_HOURS_PER_DAY, typicalStreamingMonth } from "@/lib/questions";
import { Cite, life, energy, mass, Method, QuestionPage, Receipt, volume } from "@/components/QuestionPage";

const q = questionBySlug("netflix-streaming-carbon-footprint")!;
export const metadata: Metadata = { title: q.title, description: q.description, alternates: { canonical: `/questions/${q.slug}` } };

export default function Page() {
  const hour = streamingHour();
  const month = typicalStreamingMonth();
  const monthWater = rawWater(month.hours * F.STREAMING_KWH_PER_HOUR);
  return (
    <QuestionPage
      q={q}
      answer={
        <p>
          About {mass(hour.impacts.carbon)} of CO₂e for an hour of Netflix, YouTube or any streamed video, from the data centers and
          networks that deliver it. That&apos;s like driving {hour.carMiles.toFixed(2)} miles in an average gas car. Your TV or laptop&apos;s
          own power is extra, and shows up on your home electricity bill.
        </p>
      }
      receipts={
        <>
          <Receipt
            title="One hour"
            rows={[
              ["Data center and network power", energy(hour.kwh * 1000)],
              ["Carbon", `${mass(hour.impacts.carbon)} CO₂e`],
              ["Water consumed", volume(hour.water.total)],
            ]}
          />
          <Receipt
            title={`A month at ${TYPICAL_STREAMING_HOURS_PER_DAY} hours a day`}
            rows={[
              ["Hours", Math.round(month.hours).toLocaleString("en-US")],
              ["Carbon", `${mass(month.impacts.carbon)} CO₂e`],
              ["Healthy life lost", life(month.impacts.air)],
              ["Water consumed", volume(monthWater.total)],
            ]}
          />
        </>
      }
      how={
        <>
          <p>
            <Cite s={SOURCES.iea} /> puts an hour of streaming at about {Math.round(F.KG_PER_STREAMING_HOUR * 1000)} g of CO₂ and{" "}
            {F.STREAMING_KWH_PER_HOUR} kWh for the data centers and networks. To that we add {Math.round(F.GRID_UPSTREAM_SHARE * 100)}% for
            getting fuel to the power plants, {Math.round(F.GRID_LINE_LOSS * 100)}% for power lost on the wires, and a quarter for building
            the servers and the buildings they sit in. Cooling water and the water used at power plants come from the same power figure.
          </p>
          <p>
            The car comparison uses {F.KG_CO2_PER_GAL_GASOLINE} kg of CO₂ a gallon at {F.DEFAULT_MPG} miles a gallon. Every factor and
            source is on <Method />.
          </p>
        </>
      }
      cover={
        <>
          <p>
            A month at {TYPICAL_STREAMING_HOURS_PER_DAY} hours a day comes to {usd(month.donation)} in donations, including our margin for an
            estimate. That&apos;s below our {usd(month.monthly.donation)} smallest payment, so you can add it to a plan with other items, or
            pay once. For someone born in {DEFAULT_CONTEXT.birthYear}, {usd(month.lifetime.total)} with fees covers every hour since age{" "}
            {F.ONLINE_FROM_AGE} and every year to age {F.LIFETIME_TO_AGE}, on a grid that gets cleaner each year.
          </p>
        </>
      }
    />
  );
}
