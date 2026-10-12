import Link from "next/link";
import { Store } from "@/components/Store";
import { CARD_RATE } from "@/lib/pricing";

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
            We don&apos;t take a cut. The only fee is what each card payment costs: 30¢ plus{" "}
            {Math.round(CARD_RATE * 1000) / 10}%, shown separately, so the whole donation arrives. Nothing is charged until you
            approve it.
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
    </div>
  );
}
