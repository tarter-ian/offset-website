import Link from "next/link";
import { Store } from "@/components/Store";
import { CARD_FEE_LABEL, ENDAOMENT_GRANT_LABEL, ENDAOMENT_IN_LABEL, SPONSOR_FEE_LABEL } from "@/lib/pricing";
import { forMode, PAYMENT_MODE } from "@/lib/payments";

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
            {forMode({
              every:
                "You give to each charity on your plan directly, through Every.org, a nonprofit donation platform that sends you the tax receipt. We never hold your money.",
              endaoment:
                "You make one gift to My Offset's fund at Endaoment, a nonprofit that grants it on to each charity on your plan and sends you the tax receipt. We never hold your money.",
              sponsor:
                "Your donation is held by our charity sponsor, a registered charity, which pays the charities listed on your plan and sends you the tax receipt. We never hold it ourselves.",
            })}{" "}
            Most of it funds groups that push for cleaner power and protect
            water in dry regions, because that does the most per dollar. Paying only for carbon removal that someone
            measured is an option on your footprint summary, at about twelve times the price per tonne.
          </p>
          {PAYMENT_MODE === "every" ? (
            <p>
              We don&apos;t take a cut. Each charity is paid separately through Every.org, which charges card payments 2.2% + 30¢ and
              bank payments nothing. The card fee is shown for each charity and added on top, so the whole donation arrives. Nothing is
              charged until you approve it.
            </p>
          ) : PAYMENT_MODE === "endaoment" ? (
            <p>
              We don&apos;t take a cut. The only fees are the card payment and Endaoment&apos;s {ENDAOMENT_IN_LABEL} in and{" "}
              {ENDAOMENT_GRANT_LABEL} out, each shown separately and added on top, so the whole donation arrives. Nothing is charged
              until you approve it.
            </p>
          ) : (
            <p>
              We don&apos;t take a cut. The only fees are the card payment ({CARD_FEE_LABEL}) and our charity sponsor&apos;s{" "}
              {SPONSOR_FEE_LABEL}, each shown separately, so the whole donation arrives. Nothing is charged until you
              approve it.
            </p>
          )}
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
