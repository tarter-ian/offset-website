import type { Metadata } from "next";
import * as F from "@/lib/factors";
import { CONFIDENCE_LABELS, MARGINS, type Confidence } from "@/lib/footprint";
import { DONATION_PER_TONNE_USD, usd } from "@/lib/pricing";

export const metadata: Metadata = { title: "How we calculate | Offset" };

const SOURCES = [
  { name: "EPA eGRID2023 state emission rates", url: "https://www.epa.gov/egrid/summary-data" },
  { name: "EIA 2024 residential electricity use and prices", url: "https://www.eia.gov/electricity/sales_revenue_price/" },
  { name: "Epoch AI, energy per ChatGPT query", url: "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" },
  {
    name: "IEA, carbon footprint of streaming video",
    url: "https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines",
  },
];

const ROWS = [
  {
    category: "Home electricity",
    method: "Your bill or your state's average use, times your state's grid emission rate.",
  },
  {
    category: "Home heating",
    method: `Your fuel bill or a typical home's use. Natural gas is ${F.KG_CO2_PER_THERM_GAS} kg CO₂ a therm.`,
  },
  {
    category: "Car travel",
    method: `Miles driven divided by fuel economy, at ${F.KG_CO2_PER_GAL_GASOLINE} kg CO₂ a gallon of gasoline. Electric cars use ${F.EV_KWH_PER_MILE} kWh a mile on your state's grid.`,
  },
  {
    category: "Flights",
    method: `Round trips a year, spread over 12 months, times ${F.FLIGHT_NON_CO2_MULTIPLIER} for contrails and other high-altitude warming.`,
  },
  { category: "Food", method: "A yearly per-person figure for your type of diet." },
  { category: "Goods and services", method: "A yearly per-person figure for your level of spending." },
  {
    category: "AI and streaming",
    method: `About ${F.WH_PER_AI_PROMPT} Wh a chatbot prompt and ${F.KG_PER_STREAMING_HOUR * 1000} g CO₂ an hour of streaming. Your devices' own power is already in your electricity bill.`,
  },
];

export default function MethodPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">How we calculate your footprint</h1>
      <p className="mt-4 text-lg text-muted">
        We estimate each part of your footprint separately in kilograms of CO₂e, which counts methane and other
        greenhouse gases as well as CO₂. Then we add a margin that depends on how good the data is, so you&apos;re never
        under-offset.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Categories</h2>
      <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {ROWS.map((r) => (
          <div key={r.category} className="grid gap-1 p-4 sm:grid-cols-3">
            <dt className="font-medium">{r.category}</dt>
            <dd className="text-muted sm:col-span-2">{r.method}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-xl font-semibold">Margins</h2>
      <p className="mt-2 text-muted">Linking an account replaces an estimate with measured data and shrinks its margin.</p>
      <ul className="mt-4 space-y-2">
        {(Object.keys(MARGINS) as Confidence[]).map((c) => (
          <li key={c} className="flex justify-between rounded-lg border border-border bg-card px-4 py-2">
            <span>{CONFIDENCE_LABELS[c]}</span>
            <span className="font-medium">+{Math.round(MARGINS[c] * 100)}%</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">What &ldquo;Fully Offset&rdquo; means</h2>
      <p className="mt-2 text-muted">
        A Fully Offset month is one where you approved a donation covering your estimated footprint plus its margin, at{" "}
        {usd(DONATION_PER_TONNE_USD)} a tonne, to the climate charities listed on your summary. Donations fund charity
        work; they are not certified carbon credits. If you lower an estimate by hand by more than its margin, the badge
        pauses until a linked account confirms the new number.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What we don&apos;t count yet</h2>
      <p className="mt-2 text-muted">
        Air pollution, water use and harm to nature are real costs, but they don&apos;t convert cleanly into tonnes of
        CO₂e, so they aren&apos;t in your number.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Sources</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {SOURCES.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {s.name}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        Food, shopping and heating figures are approximate national averages and will be refined.
      </p>
    </article>
  );
}
