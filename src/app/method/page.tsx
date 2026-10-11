import type { Metadata } from "next";
import * as F from "@/lib/factors";
import { CONFIDENCE_LABELS, MARGINS, type Confidence } from "@/lib/footprint";
import {
  AIR_DAMAGE_SHARE,
  CARBON_MODES,
  type CarbonMode,
  WATER_MODES,
  type WaterMode,
  ANNUAL_FEE_MONTHS,
  ANNUAL_MIN_DONATION_USD,
  LIFETIME_FEE_USD,
  LIFETIME_GROWTH_BUFFER,
  MONTHLY_FEE_USD,
  MIN_DONATION_USD,
  usd,
} from "@/lib/pricing";

export const metadata: Metadata = { title: "How we calculate | Offset" };

const SOURCES = [
  { name: "EPA USEEIO v2.0 supply-chain model (clothing, home goods, services)", url: "https://www.epa.gov/land-research/us-environmentally-extended-input-output-useeio-models" },
  { name: "USGS consumptive water use (Circular 1200)", url: "https://pubs.usgs.gov/circ/1998/1200/report.pdf" },
  { name: "Levi Strauss 501 jeans life cycle assessment (2015)", url: "https://www.levistrauss.com/wp-content/uploads/2015/03/Full-LCA-Results-Deck-FINAL.pdf" },
  { name: "EPA eGRID2023 state emission rates (CO₂e, NOx, SO₂)", url: "https://www.epa.gov/egrid/summary-data" },
  { name: "EIA 2024 residential electricity use and prices", url: "https://www.eia.gov/electricity/sales_revenue_price/" },
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
    measure: "Greenhouse gases in kg of CO₂e, which counts methane and nitrous oxide as well as CO₂.",
    price: `You choose how: ${(Object.keys(CARBON_MODES) as CarbonMode[])
      .map((m) => `${CARBON_MODES[m].label.toLowerCase()} at ${usd(CARBON_MODES[m].perTonne)} a tonne`)
      .join(", ")}. Policy charities are estimated to avert a tonne for under $10 but can't be measured; certified removal is measured per tonne but costs far more. The default is expected impact; you can opt into the blend (90% policy, 10% removal) or verified-only.`,
  },
  {
    name: "Air pollution",
    measure:
      `The harm to health from the NOx, SO₂ and fine particles released by power plants, cars, home furnaces, jet engines and farms (mostly ammonia from manure and fertilizer), using EPA's per-ton estimates and published death counts for flights and farms. Almost all of it is early deaths, so we show it as healthy life lost, shared across everyone who breathes the pollution: EPA values a statistical life at about $${(F.VSL_USD / 1e6).toFixed(0)} million, and each early death from fine particles costs about ${F.LIFE_YEARS_PER_AIR_DEATH} years of life, so $1 of damage is about ${F.MINUTES_OF_LIFE_PER_DAMAGE_USD.toFixed(2)} minutes.`,
    price: `We donate ${Math.round(AIR_DAMAGE_SHARE * 100)}% of that damage to clean-air work.`,
  },
  {
    name: "Water",
    measure: `Fresh water consumed, in liters, to generate your electricity, cool data centers, grow your food, refine your fuel and make your electronics, weighted by scarcity: a liter from a water-stressed area counts in full and a liter from a well-watered one counts ${F.UNSTRESSED_WATER_WEIGHT * 100}%. We assume ${Math.round(F.STRESSED_WATER_SHARE.food * 100)}% of food water, ${Math.round(F.STRESSED_WATER_SHARE.datacenter * 100)}% of data center water and ${Math.round(F.STRESSED_WATER_SHARE.grid * 100)}% of power plant water come from stressed areas.`,
    price: `You choose how: ${(Object.keys(WATER_MODES) as WaterMode[])
      .map((m) => `${WATER_MODES[m].label.toLowerCase()} at ${usd(WATER_MODES[m].per1000Gal)} per 1,000 gallons`)
      .join(", or ")}. Expected impact, the default, funds paid water-saving work in dry regions, like farm irrigation upgrades, which has cost roughly $70 to $500 an acre-foot. Restoration certificates return every gallon to a stressed river.`,
  },
  {
    name: "Nature",
    measure: "Land used to grow your food and to mine and make your electronics, in square meters.",
    price: "We fund permanently protecting the same area of threatened forest, at about $10 an acre.",
  },
];

const ROWS = [
  {
    category: "Home electricity",
    method:
      "Your bill or your state's average use, times your state's grid rates for greenhouse gases, NOx, SO₂ and water.",
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
    method: `About ${F.WH_PER_AI_PROMPT} Wh a chatbot prompt, plus its share of training the model, on the US grid, plus data center cooling water. If you add your ChatGPT, Claude or Gemini data export, we measure each prompt instead (longer conversations, reasoning models and images all use more), and your past use is your real history rather than today's rate since late 2022. Gemini's export lists prompts without their conversations, so long Gemini chats count as if each prompt started fresh.`,
  },
  {
    category: "Video streaming",
    method: `About ${F.KG_PER_STREAMING_HOUR * 1000} g CO₂ and ${F.STREAMING_KWH_PER_HOUR} kWh an hour. Your devices' own power is already in your electricity bill.`,
  },
];

export default function MethodPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">How we calculate your footprint</h1>
      <p className="mt-4 text-lg text-muted">
        We estimate four kinds of harm for each part of your life, add a margin that depends on how good the data is,
        and turn the result into donations to charities that work on each kind.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What we measure and how we price it</h2>
      <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {IMPACTS.map((i) => (
          <div key={i.name} className="grid gap-1 p-4 sm:grid-cols-3">
            <dt className="font-medium">{i.name}</dt>
            <dd className="text-muted sm:col-span-2">
              {i.measure} {i.price}
            </dd>
          </div>
        ))}
      </dl>

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

      <h2 className="mt-10 text-xl font-semibold">Fees</h2>
      <p className="mt-2 text-muted">
        Our fee is a flat {usd(MONTHLY_FEE_USD)} a month for a monthly plan, however many things it covers. One-time payments carry a {usd(LIFETIME_FEE_USD)} fee the first time only; there&apos;s no fee on later ones, or on any while you have a monthly plan. Ongoing offsets are billed monthly unless you choose yearly; paying yearly gets {12 - ANNUAL_FEE_MONTHS} months of our fee free. Donations
        under {usd(MIN_DONATION_USD)} a month, or {usd(ANNUAL_MIN_DONATION_USD)} a year, are rounded up, and all of it goes to the charities.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Lifetime internet, AI and devices</h2>
      <p className="mt-2 text-muted">
        The one-time lifetime offsets count from age {F.ONLINE_FROM_AGE} (or {F.INTERNET_START_YEAR}, whichever is later), and from late 2022 for AI,
        through age {F.LIFETIME_TO_AGE}. Past years count at today&apos;s rates. Future years count at today&apos;s amount of use, since networks
        get more efficient about as fast as use grows, but the power for it gets cleaner: we assume the US grid&apos;s carbon, air pollution and
        water per kWh fall {Math.round(F.GRID_CLEANER_PER_YEAR * 100)}% a year until {F.GRID_CLEANER_UNTIL}, then hold steady. That&apos;s a cautious
        pace; the EIA&apos;s outlooks range from about 2% to 6% a year depending on clean-power policy. Making devices happens mostly overseas, so
        it isn&apos;t discounted. Future AI use counts {LIFETIME_GROWTH_BUFFER} times over in case it keeps growing. Prices use
        expected-impact climate pricing, plus the one-time fee.
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
          their air pollution counts {F.AI_LOCAL_AIR_WEIGHT} times. AI built into other products, like search answers, and AI video aren&apos;t measured yet.
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
        harm we count. Covering an item or a whole area earns its badge; covering everything for all four kinds of harm earns the
        complete badge. Unless you choose verified-only climate, donations fund charity work rather than certified credits. If you lower an estimate by hand by
        more than its margin, the badge pauses until a linked account confirms the new number.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What we don&apos;t count yet</h2>
      <p className="mt-2 text-muted">
        Air pollution from oil and propane heating;
        air pollution from making devices; e-waste; building data centers for anything but AI; AI built into other products; and AI video. Your summary marks each gap.
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
        Shopping, heating, transit, food-group splits and car tailpipe figures are approximate and will be refined. The car pollution rates date from
        2008 and overstate today&apos;s cars.
      </p>
    </article>
  );
}
