import Link from "next/link";
import { Store } from "@/components/Store";
import {
  CARD_FEE_LABEL,
  ENDAOMENT_GRANT_LABEL,
  ENDAOMENT_IN_LABEL,
  PLEDGE_FREE_LABEL,
  SPONSOR_FEE_LABEL,
} from "@/lib/pricing";
import { forMode, PAYMENT_MODE } from "@/lib/payments";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <Store />

      <section aria-labelledby="money" className="mt-12 grid gap-8 border-t-2 border-rule py-16 md:grid-cols-[14rem_minmax(0,1fr)]">
        <h2 id="money" className="text-2xl font-bold">
          Where your money goes
        </h2>
        <div className="max-w-2xl space-y-4">
          <p>
            {forMode({
              every:
                "You give to each charity on your plan directly, through Every.org, a nonprofit donation platform that sends you the tax receipt. I never hold your money.",
              pledge:
                "You give to each charity on your plan directly, through Pledge, a nonprofit giving platform that emails you the tax receipt. I never hold your money.",
              pledgeapi:
                "You pay me once, through Stripe, and I give every dollar of your donation to the charities on your plan through Pledge, a nonprofit giving platform. Pledge records each gift in your name and emails you a receipt for it.",
              endaoment:
                "You make one gift to My Offset's fund at Endaoment, a nonprofit that grants it on to each charity on your plan and sends you the tax receipt. I never hold your money.",
              sponsor:
                "Your donation is held by my charity sponsor, a registered charity, which pays the charities listed on your plan and sends you the tax receipt. I never hold it myself.",
            })}{" "}
            Most of it funds groups that push for cleaner power and protect
            water in dry regions, because that does the most per dollar. I buy no carbon credits.
          </p>
          {PAYMENT_MODE === "every" ? (
            <p>
              I don&apos;t take a cut. Each charity is paid separately through Every.org, which charges card payments 2.2% + 30¢ and
              bank payments nothing. The card fee is shown for each charity and added on top, so the whole donation arrives. Nothing is
              charged until you approve it.
            </p>
          ) : PAYMENT_MODE === "pledge" ? (
            <p>
              I don&apos;t take a cut. Each charity is paid separately through Pledge, which pays the card fee on gifts up to{" "}
              {PLEDGE_FREE_LABEL}. Above that, the card fee is shown and added on top, so the whole donation arrives. Pledge may ask for
              an optional tip, which goes to Pledge. Nothing is charged until you approve it.
            </p>
          ) : PAYMENT_MODE === "pledgeapi" ? (
            <p>
              I don&apos;t take a cut. Stripe&apos;s and Pledge&apos;s fees are each a line on your bill, added on top, so the whole
              donation arrives.
            </p>
          ) : PAYMENT_MODE === "endaoment" ? (
            <p>
              I don&apos;t take a cut. The only fees are the card payment and Endaoment&apos;s {ENDAOMENT_IN_LABEL} in and{" "}
              {ENDAOMENT_GRANT_LABEL} out, each shown separately and added on top, so the whole donation arrives. Nothing is charged
              until you approve it.
            </p>
          ) : (
            <p>
              I don&apos;t take a cut. The only fees are the card payment ({CARD_FEE_LABEL}) and my charity sponsor&apos;s{" "}
              {SPONSOR_FEE_LABEL}, each shown separately, so the whole donation arrives. Nothing is charged until you
              approve it.
            </p>
          )}
          <p>
            <Link href="/promises" className="font-semibold text-accent underline underline-offset-4">
              Read my promises
            </Link>{" "}
            or{" "}
            <Link href="/method" className="font-semibold text-accent underline underline-offset-4">
              check every number I use
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
