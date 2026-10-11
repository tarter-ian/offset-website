import Link from "next/link";
import { Store } from "@/components/Store";
import { WaitlistForm } from "@/components/WaitlistForm";
import { ANNUAL_FEE_MONTHS, LIFETIME_FEE_USD, MONTHLY_FEE_USD, usd } from "@/lib/pricing";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <Store />

      <section aria-labelledby="money" className="grid gap-8 border-t-2 border-rule py-10 md:grid-cols-[14rem_minmax(0,1fr)]">
        <h2 id="money" className="text-2xl font-bold">
          Where your money goes
        </h2>
        <div className="max-w-2xl space-y-4">
          <p>
            Your donation goes through our donation partner straight to the charities listed on your plan, and the
            receipt comes from them. We never hold it. Most of it funds groups that push for cleaner power and protect
            water in dry regions, because that does the most per dollar. Paying only for carbon removal that someone
            measured is an option on your footprint summary, at about twelve times the price per tonne.
          </p>
          <p>
            Our cut is a separate fee: {usd(MONTHLY_FEE_USD)} a month for a monthly plan, however much it covers, or{" "}
            {usd(LIFETIME_FEE_USD)} on your first one-time payment. Later one-time payments, and any while you have a monthly
            plan, have no fee. Paying yearly takes {12 - ANNUAL_FEE_MONTHS} months off the fee. Nothing is charged until you approve it.
          </p>
          <p>
            <Link href="/promises" className="font-semibold text-accent underline underline-offset-4">
              Read our promises
            </Link>{" "}
            or{" "}
            <Link href="/method" className="font-semibold text-accent underline underline-offset-4">
              check every number we use
            </Link>
            .
          </p>
        </div>
      </section>

      <section aria-labelledby="launch" className="grid gap-8 border-t border-border py-10 pb-20 md:grid-cols-[14rem_minmax(0,1fr)]">
        <h2 id="launch" className="text-2xl font-bold">
          Not open yet
        </h2>
        <div className="max-w-xl">
          <p className="mb-4">
            AI accounts link today. Utilities, banks, cars and payments open at launch. Leave your email and we&apos;ll
            write once, when they do.
          </p>
          <WaitlistForm />
        </div>
      </section>
    </div>
  );
}
