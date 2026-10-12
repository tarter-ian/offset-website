import type { Metadata } from "next";
import * as F from "@/lib/factors";
import { CONFIDENCE_LABELS, IMPACT_KEYS, MARGINS, type Confidence } from "@/lib/footprint";
import { STATES } from "@/lib/data/states";
import { IMPACT_INFO } from "@/lib/impacts";
import { DEFAULT_CONTEXT, PRODUCTS } from "@/lib/store";
import { PAYMENT_MODE } from "@/lib/payments";
import {
  AIR_DAMAGE_SHARE,
  CARBON_MODES,
  DEFAULT_CARBON_MODE,
  DEFAULT_WATER_MODE,
  impactCost,
  type CarbonMode,
  WATER_MODES,
  type WaterMode,
  CARD_FEE_LABEL,
  SPONSOR_FEE_LABEL,
  EWASTE_USD_PER_KG,
  LIFETIME_GROWTH_BUFFER,
  MIN_DONATION_USD,
  usd,
} from "@/lib/pricing";

export const metadata: Metadata = { title: "How we calculate | My Offset" };

const SOURCES = [
  { name: "EPA USEEIO v2.0 supply-chain model (clothing, home goods, services)", url: "https://www.epa.gov/land-research/us-environmentally-extended-input-output-useeio-models" },
  { name: "USGS consumptive water use (Circular 1200)", url: "https://pubs.usgs.gov/circ/1998/1200/report.pdf" },
  { name: "Levi Strauss 501 jeans life cycle assessment (2015)", url: "https://www.levistrauss.com/wp-content/uploads/2015/03/Full-LCA-Results-Deck-FINAL.pdf" },
  { name: "EPA eGRID2023 state emission rates (CO₂e, NOx, SO₂)", url: "https://www.epa.gov/egrid/summary-data" },
  { name: "EIA 2024 residential electricity use and prices", url: "https://www.eia.gov/electricity/sales_revenue_price/" },
  { name: "EIA, how much electricity is lost in transmission and distribution", url: "https://www.eia.gov/tools/faqs/faq.php?id=105&t=3" },
  { name: "Alvarez et al. 2018, methane emissions from the US oil and gas supply chain (Science)", url: "https://www.science.org/doi/10.1126/science.aar7204" },
  { name: "EPA AVERT, emissions from power plants that respond to new demand", url: "https://www.epa.gov/avert" },
  { name: "EIA Annual Energy Outlook (future grid carbon)", url: "https://www.eia.gov/outlooks/aeo/" },
  { name: "EPA Power Sector Programs Progress Report (power plant SO2 and NOx trends)", url: "https://www.epa.gov/power-sector/progress-report-emissions-reductions" },
  {
    name: "EPA benefit-per-ton estimates for power plants",
    url: "https://epa.gov/benmap/sector-based-pm25-and-ozone-benefit-ton-estimates",
  },
  {
    name: "EPA benefit-per-ton estimates for vehicles (Wolfe et al. 2019)",
    url: "https://www.epa.gov/benmap/mobile-sector-source-apportionment-air-quality-and-benefits-ton",
  },
  { name: "EPA, mortality risk valuation (value of a statistical life)", url: "https://19january2025snapshot.epa.gov/environmental-economics/mortality-risk-valuation" },
  {
    name: "Fann et al. 2012, national health burden of PM2.5 and ozone (life years lost)",
    url: "https://ideas.repec.org/a/wly/riskan/v32y2012i1p81-95.html",
  },
  { name: "EPA AP-42 natural gas combustion factors", url: "https://gaftp.epa.gov/ap42/ch01/s04/final/c1s4_2026.pdf" },
  {
    name: "Patterson et al. 2022, The Carbon Footprint of Machine Learning Training Will Plateau, Then Shrink",
    url: "https://arxiv.org/abs/2204.05149",
  },
  {
    name: "The Water Report, farm water conservation and the Colorado River",
    url: "https://www.thewaterreport.com/agricultural-water-conservation-saves-colorado-river/",
  },
  { name: "Li et al., Making AI Less Thirsty", url: "https://arxiv.org/html/2304.03271v4" },
  {
    name: "Google, environmental impact of AI inference (2025)",
    url: "https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference",
  },
  { name: "Epoch AI, energy per ChatGPT query", url: "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" },
  {
    name: "IEA, carbon footprint of streaming video",
    url: "https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines",
  },
  {
    name: "Scarborough et al. 2023, diet water and land use (Nature Food)",
    url: "https://ora.ox.ac.uk/objects/uuid:332d8ffb-75cf-4f59-bded-bc2042de955d",
  },
  { name: "Domingo et al. 2021, air quality deaths from US food production (PNAS)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8158015" },
  { name: "Yim et al. 2015, global health effects of aviation emissions", url: "https://doaj.org/article/883efa3bca1c4bcd80afca0ad6189c7b" },
  { name: "Fairphone 5 life cycle assessment (Fraunhofer, 2024), water consumed to make a phone", url: "https://www.fairphone.com/wp-content/uploads/2024/06/Fairphone5_LCA_Report_2024.pdf" },
  { name: "Friends of the Earth 2015, land used to make consumer products", url: "https://transform.iema.net/article/land-and-water-use-consumer-products-revealed" },
  { name: "Wu et al. 2009, Argonne, water used to make transport fuels", url: "https://publications.anl.gov/anlpubs/2009/01/63155.pdf" },
  { name: "Founders Pledge, climate donations and offsetting", url: "https://www.founderspledge.com/research/climate-and-lifestyle-donations-and-offsetting" },
];

const IMPACTS = [
  {
    name: "Climate",
    unit: "kg of greenhouse gases",
    priceShort: `${usd(CARBON_MODES[DEFAULT_CARBON_MODE].perTonne)} a tonne, to climate policy charities`,
    measure: "Greenhouse gases in kg of CO₂e, which counts methane and nitrous oxide as well as CO₂.",
    price: `You choose how: ${(Object.keys(CARBON_MODES) as CarbonMode[])
      .map((m) => `${CARBON_MODES[m].label.toLowerCase()} at ${usd(CARBON_MODES[m].perTonne)} a tonne`)
      .join(", ")}. Policy charities are estimated to avert a tonne for $0.10 to $10, and we use the middle, but those tonnes can't be measured; certified removal is measured per tonne but costs far more. The default is expected impact; you can opt into the blend (90% policy, 10% removal) or verified-only.`,
  },
  {
    name: "Air pollution",
    unit: "minutes of healthy life lost",
    priceShort: `${Math.round(AIR_DAMAGE_SHARE * 100)}% of the health damage, to clean-air work`,
    measure:
      `The harm to health from the NOx, SO₂ and fine particles released by power plants, cars, home furnaces, jet engines and farms (mostly ammonia from manure and fertilizer), using EPA's per-ton estimates and published death counts for flights and farms. Almost all of it is early deaths, so we show it as healthy life lost, shared across everyone who breathes the pollution: EPA values a statistical life at about $${(F.VSL_USD / 1e6).toFixed(0)} million, and each early death from fine particles costs about ${F.LIFE_YEARS_PER_AIR_DEATH} years of life, so $1 of damage is about ${F.MINUTES_OF_LIFE_PER_DAMAGE_USD.toFixed(2)} minutes.`,
    price: `We donate ${Math.round(AIR_DAMAGE_SHARE * 100)}% of that damage to clean-air work: the middle of what US pollution controls cost per ton of fine particles (EPA puts the next ton at about $15,000, against about $113,000 of health damage).`,
  },
  {
    name: "Water",
    unit: "liters used up, weighted by scarcity",
    priceShort: `${usd(WATER_MODES[DEFAULT_WATER_MODE].per1000Gal)} per 1,000 gallons, to put water back in dry rivers`,
    measure: `Fresh water consumed, in liters, to generate your electricity, cool data centers, grow your food, refine your fuel and make your electronics, weighted by scarcity: a liter from a water-stressed area counts in full and a liter from a well-watered one counts ${F.UNSTRESSED_WATER_WEIGHT * 100}%. We assume ${Math.round(F.STRESSED_WATER_SHARE.food * 100)}% of food water, ${Math.round(F.STRESSED_WATER_SHARE.datacenter * 100)}% of data center water and ${Math.round(F.STRESSED_WATER_SHARE.grid * 100)}% of power plant water come from stressed areas.`,
    price: `You choose how: ${(Object.keys(WATER_MODES) as WaterMode[])
      .map((m) => `${WATER_MODES[m].label.toLowerCase()} at ${usd(WATER_MODES[m].per1000Gal)} per 1,000 gallons`)
      .join(", or ")}. Expected impact, the default, goes to Colorado Water Trust, which leases water back into dry rivers for about $0.29 per 1,000 gallons all-in. Restoration certificates from Bonneville Environmental Foundation return every gallon to a stressed river.`,
  },
  {
    name: "Nature",
    unit: "square meters of land, for a year",
    priceShort: "About $2 an acre, to protect threatened forest",
    measure: "Land used to grow your food, to mine and make your electronics, and for the power plants and data centers behind your electricity and online use, in square meters. Power and data centers are a sliver of it: about 0.005 m² a year per kWh for power plants and their fuel (Lovering et al. 2022, weighted by the US mix) and 0.0005 for data centers.",
    price: "We fund protecting the same area of threatened forest through Rainforest Trust. Its projects cost $1 to $1,178 an acre, mostly legal protection at the low end and land purchases at the high end; across its projects it averages about $2 an acre.",
  },
  {
    name: "E-waste",
    unit: "kg of electronics thrown away",
    priceShort: `${usd(EWASTE_USD_PER_KG)} a kg, to reuse and proper recycling`,
    measure:
      "What your phones, laptops, tablets, computers, TVs and consoles weigh when you replace them, plus the electronics you buy. Only about a fifth of the world's e-waste is recycled properly (Global E-waste Monitor 2024); the rest is dumped or burned, leaking lead, mercury and flame retardants.",
    price: `We pay ${usd(EWASTE_USD_PER_KG)} a kg to a charity that refurbishes devices and recycles the rest responsibly. Nonprofit refurbishers spend about $8 to $14 for each kg they handle, so we take the low end.`,
  },
];

const ROWS = [
  {
    category: "Home electricity",
    method:
      `Your bill or your state's average use, times your state's grid rates for greenhouse gases, NOx, SO₂ and water. Those rates count only what leaves the power plant, so we add ${Math.round(F.GRID_UPSTREAM_SHARE * 100)}% to carbon for getting the fuel there (drilling, processing and methane leaking from gas lines) and ${Math.round(F.GRID_LINE_LOSS * 100)}% to everything for power lost on the wires. The same applies to all electricity on this page.`,
  },
  {
    category: "Home heating",
    method: `Your fuel bill or a typical home's use. Natural gas is ${F.KG_CO2_PER_THERM_GAS} kg CO₂ a therm, plus its NOx and particles.`,
  },
  {
    category: "Car travel",
    method: `Miles divided by fuel economy, at ${F.KG_CO2_PER_GAL_GASOLINE} kg CO₂ a gallon, plus tailpipe NOx and particles, plus about 1.5 gallons of water consumed to make each gallon of gasoline. Electric cars use ${F.EV_KWH_PER_MILE} kWh a mile on your state's grid.`,
  },
  {
    category: "Flights",
    method: `Round trips a year, spread over 12 months, times ${F.FLIGHT_NON_CO2_MULTIPLIER} for contrails and other high-altitude warming. Air pollution is each kilogram of jet fuel's share of the roughly ${F.FLIGHT_AIR_DEATHS_PER_YEAR.toLocaleString()} early deaths a year that aviation causes worldwide. Water is the water used to refine the fuel.`,
  },
  {
    category: "Bus and train",
    method: `Miles a week at about ${F.TRANSIT_KG_PER_MILE} kg CO₂e a passenger-mile. Air pollution and water use are assumed to match a car's per kilogram of CO₂, a rough figure.`,
  },
  {
    category: "Food",
    method:
      `Yearly per-person figures for your type of diet, for carbon, water and land, split into meat and fish, dairy and eggs, and plant foods by typical shares. Air pollution is your share of the about ${F.FOOD_AIR_DEATHS_PER_YEAR.toLocaleString()} US deaths a year from farm pollution, mostly from meat, scaled by how your diet compares to the average.`,
  },
  {
    category: "Shopping",
    method:
      "A yearly per-person carbon figure for your level of spending, split into clothing, electronics, home goods and services by typical shares. Electronics also counts the water and land to mine and make them. Clothing, home goods and services get water, land and air pollution from the EPA's USEEIO supply-chain model, with clothing water raised for imported cotton (Levi's 2015 jeans study).",
  },
  {
    category: "AI",
    method: `About ${F.WH_PER_AI_PROMPT} Wh a chatbot prompt, plus its share of training the model, plus data center cooling water. Because AI is new demand on the grid, its carbon is counted at the plants that ramp up to meet new demand, mostly gas, at about ${F.AI_NEW_POWER_LB_PER_MWH.toLocaleString()} lb CO₂ a MWh (EPA AVERT, rough) instead of the ${F.US_GRID_LB_PER_MWH} average. If you add your ChatGPT, Claude or Gemini data export, we measure each prompt instead (longer conversations, reasoning models and images all use more), and your past use is your real history. The extension does the same from your ChatGPT and Claude chat list: each chat you've started since your first counts at the energy your recent chats use. With nothing linked, past use grows steadily from when you say you started (late 2022 at the earliest) to today's rate, which works out to half of today's rate over that time. Gemini's export lists prompts without their conversations, so long Gemini chats count as if each prompt started fresh.`,
  },
  {
    category: "Video streaming",
    method: `About ${F.KG_PER_STREAMING_HOUR * 1000} g CO₂ and ${F.STREAMING_KWH_PER_HOUR} kWh an hour. Your devices' own power is already in your electricity bill.`,
  },
];

// One worked example: a typical month of home electricity, start to finish.
const EX_STATE = DEFAULT_CONTEXT.state;
const EX_PRODUCT = PRODUCTS.find((p) => p.id === "electricity")!;
const EX_IMPACTS = EX_PRODUCT.impacts(0, "monthly", DEFAULT_CONTEXT);
const EX_DOLLARS = impactCost(EX_IMPACTS);
const EX_TOTAL = IMPACT_KEYS.reduce((s, k) => s + EX_DOLLARS[k], 0);

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t-4 border-rule pt-3">
      <p className="text-sm text-muted">Step {n}</p>
      <h3 className="mt-1 font-semibold">{title}</h3>
      <div className="mt-3 text-sm">{children}</div>
    </div>
  );
}

export default function MethodPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">How we calculate your footprint</h1>
      <p className="mt-4 text-lg text-muted">
        We estimate five kinds of harm for each part of your life, add a margin that depends on how good the data is,
        and turn the result into donations to charities that work on each kind.
      </p>

      <h2 className="mt-10 text-xl font-semibold">One example, start to finish</h2>
      <p className="mt-2 text-muted">A typical month of home electricity in {STATES[EX_STATE].name}.</p>
      <div className="mt-4 grid gap-6 sm:grid-cols-3">
        <Step n={1} title="What you use">
          <p className="figures text-2xl font-semibold">{STATES[EX_STATE].avgKwhPerMonth.toLocaleString("en-US")} kWh</p>
          <p className="mt-1 text-muted">From your bill, or your state&apos;s average when nothing is linked.</p>
        </Step>
        <Step n={2} title="The harm it does">
          <ul className="figures space-y-1">
            {IMPACT_KEYS.filter((k) => EX_IMPACTS[k] > 0).map((k) => (
              <li key={k}>{IMPACT_INFO[k].format(EX_IMPACTS[k])}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">Your state&apos;s grid rates, plus a safety margin.</p>
        </Step>
        <Step n={3} title="What covers it">
          <ul className="figures space-y-1">
            {IMPACT_KEYS.filter((k) => EX_DOLLARS[k] > 0).map((k) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="font-sans text-muted">{IMPACT_INFO[k].label}</span>
                <span>{usd(EX_DOLLARS[k])}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-rule pt-1 font-semibold">
              <span className="font-sans">To charities</span>
              <span>{usd(EX_TOTAL)} a month</span>
            </li>
          </ul>
        </Step>
      </div>

      <h2 className="mt-12 text-xl font-semibold">The five kinds of harm</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {IMPACTS.map((i) => (
          <div key={i.name} className="border-t-4 border-rule pt-3">
            <h3 className="font-semibold">{i.name}</h3>
            <p className="mt-1 text-sm">
              <span className="text-muted">Counted in</span> {i.unit}
            </p>
            <p className="text-sm">
              <span className="text-muted">Paid at</span> {i.priceShort}
            </p>
            <details className="mt-2 text-sm text-muted">
              <summary className="cursor-pointer underline">The detail</summary>
              <p className="mt-2">
                {i.measure} {i.price}
              </p>
            </details>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold">Each part of your life</h2>
      <ul className="mt-4 divide-y divide-border border-y border-rule">
        {ROWS.map((r) => (
          <li key={r.category}>
            <details className="py-3">
              <summary className="cursor-pointer font-medium">{r.category}</summary>
              <p className="mt-2 text-sm text-muted">{r.method}</p>
            </details>
          </li>
        ))}
      </ul>

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

      <h2 className="mt-10 text-xl font-semibold">Fees</h2>
      {PAYMENT_MODE === "every" ? (
        <p className="mt-2 text-muted">
          We make nothing on fees. Each charity is paid separately through Every.org, which charges card payments 2.2% + 30¢ and bank
          payments nothing. The card fee is worked out on the whole gift and added on top, so the donation arrives in full, and checkout
          shows it for each charity. Paying yearly means one 30¢ fee per charity a year instead of twelve. Each harm&apos;s
          share always goes to its own charity; a share under {usd(MIN_DONATION_USD)} is rounded up to {usd(MIN_DONATION_USD)} rather than
          moved to another charity.
        </p>
      ) : (
        <p className="mt-2 text-muted">
        We make nothing on fees. Each payment carries two, passed on at cost and worked out on the whole payment so the
        donation arrives in full: the card fee, {CARD_FEE_LABEL}, and our charity sponsor&apos;s {SPONSOR_FEE_LABEL}. The sponsor is the
        registered charity that holds the money, sends tax receipts and pays the charities. Paying yearly means one 30¢ charge a year instead of twelve. Donations
        under {usd(MIN_DONATION_USD)} are rounded up. Small donations are pooled and each charity gets one payment a month, so card
        fees don&apos;t eat them, and all of it goes to the charities.
      </p>
      )}

      <h2 className="mt-10 text-xl font-semibold">Lifetime internet, AI and devices</h2>
      <div className="mt-4" aria-hidden="true">
        <div className="flex h-8 overflow-hidden text-xs font-medium">
          <div className="flex w-[30%] items-center bg-card px-2">Past use</div>
          <div className="w-0.5 bg-foreground" />
          <div className="flex flex-1 items-center bg-accent/15 px-2">Every year ahead, on a grid getting cleaner</div>
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>Age {F.ONLINE_FROM_AGE} (AI: when you started)</span>
          <span>Today</span>
          <span>Age {F.LIFETIME_TO_AGE}</span>
        </div>
      </div>
      <p className="mt-4 text-muted">
        The one-time lifetime offsets count from age {F.ONLINE_FROM_AGE} (or {F.INTERNET_START_YEAR}, whichever is later), and from late 2022 for AI (or when you started),
        through age {F.LIFETIME_TO_AGE}. Past years count at today&apos;s rates, except AI, which most people took up gradually: unless your
        chat history is linked, its past use grows steadily to today&apos;s rate. Future years count at today&apos;s amount of use, since networks
        get more efficient about as fast as use grows, but the power for it gets cleaner. We assume the US grid&apos;s carbon and power plant water
        per kWh fall {Math.round(F.GRID_CLEANER_PER_YEAR * 100)}% a year until {F.GRID_CLEANER_UNTIL}, then hold steady. That&apos;s a cautious pace;
        the EIA&apos;s outlooks range from about 2% to 6% a year depending on clean-power policy. Power plant air pollution falls faster, since
        coal is its main source and retires first (in 2023 sulfur dioxide fell 24% and NOx 15%, against 7% for carbon), so we take{" "}
        {Math.round(F.GRID_AIR_CLEANER_PER_YEAR * 100)}% a year for air. Data center cooling water and making devices, mostly overseas, aren&apos;t
        discounted. Future AI use counts {LIFETIME_GROWTH_BUFFER} times over in case it keeps growing. Prices use
        expected-impact climate pricing, plus fees.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
        <li>
          <strong className="font-medium text-foreground">Internet</strong> is split into video, social media, cloud gaming, video calls, music and
          browsing, each with its own data center and network power per hour. Video uses the IEA figure ({F.INTERNET_KWH_PER_HOUR.video} kWh an
          hour); the others are scaled from typical data use and are rough, so they carry an extra {Math.round(F.INTERNET_ROUGH_MARGIN * 100)}% margin.
        </li>
        <li>
          <strong className="font-medium text-foreground">AI</strong> adds each prompt&apos;s share of training the models: about{" "}
          {Math.round(F.AI_TRAINING_SHARE * 100)}% of machine learning energy goes to training. On top of that, making the chips and servers
          and building the data centers adds about {Math.round(F.AI_HARDWARE_SHARE * 100)}% of AI&apos;s carbon. Some data centers run their own gas power, so
          their air pollution counts {F.AI_LOCAL_AIR_WEIGHT} times. AI built into other products, like search answers, counts as {F.AI_BUILT_IN_PROMPTS_PER_DAY} typical prompts a day for everyone. A short AI video counts about {F.WH_PER_AI_VIDEO} Wh, the one published measurement.
        </li>
        <li>
          <strong className="font-medium text-foreground">Devices</strong> counts the carbon to make each phone, laptop, tablet, computer, TV and
          console you&apos;ll go through (for example {F.DEVICES.phone.kgToMake} kg for a phone kept {F.DEVICES.phone.yearsKept} years), the water and land used to mine and make them, plus the
          power to run them. If you also cover home electricity month to month, the running power overlaps with it.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">What &ldquo;Fully Offset&rdquo; means</h2>
      <p className="mt-2 text-muted">
        A Fully Offset month is one where you approved donations covering the estimate plus its margin for every kind of
        harm we count. Covering an item or a whole area earns its badge; covering everything for all five kinds of harm earns the
        complete badge. Unless you choose verified-only climate, donations fund charity work rather than certified credits. If you lower an estimate by hand by
        more than its margin, the badge pauses until a linked account confirms the new number.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What we don&apos;t count yet</h2>
      <p className="mt-2 text-muted">
        Some harms are real but have no reliable price per prompt or per purchase yet, so we name them rather than guess: toxic waste and
        working conditions in mining the metals for chips and devices; &ldquo;forever chemicals&rdquo; (PFAS) used in chip factories; noise and
        diesel generators near data centers, and higher power bills for their neighbors; and toxic harm from e-waste beyond paying to recycle it.
        Making the hardware is counted for carbon, water, land and e-waste. Tell us what&apos;s missing.
      </p>

      <h2 id="sources" className="mt-10 text-xl font-semibold">Sources</h2>
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
        Shopping, heating, transit, food-group splits and car tailpipe figures are approximate and will be refined. The car pollution rates date from
        2008 and overstate today&apos;s cars.
      </p>
    </article>
  );
}
