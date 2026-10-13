import type { Metadata } from "next";
import Link from "next/link";
import { ComputerOnly } from "@/components/ComputerOnly";
import { ContactLink } from "@/components/ContactLink";
import { accountsOn } from "@/lib/account";
import { forMode, PAYMENT_MODE } from "@/lib/payments";

export const metadata: Metadata = { title: "Privacy policy | My Offset" };

const UPDATED = "October 13, 2026";

// The plain-language version is /data. This is the same thing, in the order a privacy policy is expected to have.
// `computer` sections mention the extension, so phones never see them (Ian, 2026-10-13).
const SECTIONS: { title: string; body: React.ReactNode; computer?: boolean }[] = [
  {
    title: "Who we are",
    body: (
      <>
        My Offset is run by Ian Tarter, one person, not a company. Questions about your data go to <ContactLink />.
      </>
    ),
  },
  {
    title: "What we collect",
    body: (
      <>
        {accountsOn()
          ? "If you sign in, your email and what you've offset, with start and end dates, so it follows you to another device. "
          : "There are no accounts yet, so we have no name, email or password. "}
        We never keep how much you use anything: the plan you build and every count are saved only in your own browser. If you give, see below for what Every.org tells us. To guess your state, our host
        (Cloudflare) reads the location of your internet connection on each visit; we use it for that page and don&apos;t save it.
        Cloudflare keeps standard request logs for security, which we don&apos;t use for anything else. We use no analytics, ads or
        tracking cookies.
      </>
    ),
  },
  {
    title: "The browser extension",
    computer: true,
    body: (
      <>
        The optional extension reads usage counts (prompts, videos, orders, rides and similar) from services you are already logged in to,
        only when you press Measure, and hands them to this page in your browser. It never reads or sends the text of chats, titles, what
        you watched, products, item prices, restaurants, addresses or routes. The only money figures it reads are order totals from Amazon
        (also split by kind of item), DoorDash and Uber Eats, and ride fares from Uber. It
        keeps the last results and a day-by-day record of those counts inside the extension so pages fill in quickly; removing the
        extension or pressing Clear deletes them. The list of exactly what it reads for each service is on{" "}
        <Link href="/data#extension" className="text-accent underline underline-offset-4">
          Your data
        </Link>
        . The use of information received from the extension adheres to the Chrome Web Store User Data Policy, including the Limited Use
        requirements: we use it only to size your offset, never sell or transfer it, never use it for ads or credit decisions, and no
        person reads it.
      </>
    ),
  },
  {
    title: "Files and keys you add",
    body: "A data export you add is read in your browser and never sent to us. An API key you paste goes through our server once, to ask OpenAI or Anthropic for your usage totals, which come straight back to your browser; we never save or log the key or the totals.",
  },
  {
    title: "When you give",
    body: PAYMENT_MODE === "endaoment"
      ? "You give on Endaoment's page for My Offset's fund. Endaoment, a nonprofit, takes your card or bank details under its own privacy policy; we never see them. It keeps your name and email to send the tax receipt. This browser keeps a note of what you gave and when, so checkout can show it; we don't receive it. Gifts made for someone else go through Every.org, which tells us the charity, the amount and your email if you share it, so we can show which gifts arrived."
      : PAYMENT_MODE === "every"
      ? "You give to each charity on Every.org, a nonprofit donation platform, which takes your card or bank details under its own privacy policy; we never see them. For each gift made through our links, Every.org tells us the charity, the amount, how often it repeats, and your email if you share it. We keep that so we can show which gifts arrived. Every.org keeps your name and email to send the tax receipt."
      : "Payments aren't switched on yet. When they are, a card processor will take your card details, and we will never see or store your card number. We will keep your email, what you gave and when, so we can send receipts and the heads-up before any autopay charge. Your donation goes through a donation partner, which keeps your name and email to issue the tax receipt under its own privacy policy. This section will name both companies before the first payment.",
  },
  {
    title: "Gifts",
    body: "If you give someone an offset, we keep the item, the two names and the note you type, so the gift's link can show them. Only someone with that link can see it. We don't email or contact the person you give it to.",
  },
  {
    title: "Who's offsetting",
    body: "Only if you tick \"List me publicly\" (a gift's recipient decides for themselves). To check your gifts, your browser sends the amounts on your plan with your birth year and state; we work out the gifts from them and keep none of it. We keep the name you pick, which items your checkout or gift offset and when, and the gifts it asked of each charity, so the list can check Every.org confirmed them. Items you use none of count as offset, so your browser also sends their names, like \"AI video\", and updates them when that changes; never how much you use of anything. The list shows the name and the badges, never amounts or email. A secret kept in your browser lets you rename or leave; leaving deletes all of it.",
  },
  {
    title: "Who we share it with",
    body: PAYMENT_MODE === "endaoment"
      ? "No one, except the companies that make the service run: our host, and Endaoment and Every.org for payments, each only for its own job. We will never sell your data or share it for advertising."
      : PAYMENT_MODE === "every"
      ? "No one, except the companies that make the service run: our host, and Every.org for payments, each only for its own job. We will never sell your data or share it for advertising."
      : "No one, except the companies that make the service run: our host now, and the card processor and donation partner once payments start, each only for its own job. We will never sell your data or share it for advertising.",
  },
  {
    title: "Deleting your data",
    body: (
      <>
        <Link href="/data" className="text-accent underline underline-offset-4">
          Your data
        </Link>{" "}
        has a button that clears this browser
        {accountsOn() ? " and one that deletes your account, which removes your email and what you've offset from our server" : ""}. You can
        ask us to delete your gift records too, except what the law or{" "}
        {forMode({ every: "Every.org requires", endaoment: "Endaoment or Every.org requires", sponsor: "the donation partner requires us to keep" })} for
        tax receipts.
      </>
    ),
  },
  {
    title: "Children",
    body: "The site isn't meant for children under 13, and only adults can give.",
  },
  {
    title: "Changes",
    body: "If this policy changes, the date at the top changes, and anything that collects more than before will be announced on the home page first.",
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Privacy policy</h1>
      <p className="mt-4 text-lg text-muted">
        Updated {UPDATED}. The short version is on{" "}
        <Link href="/data" className="text-accent underline underline-offset-4">
          Your data
        </Link>
        : we keep little and never sell it.
      </p>
      <dl className="mt-8 border-t-2 border-rule">
        {SECTIONS.map((s) => {
          const row = (
            <div key={s.title} className="grid gap-1 border-b border-border py-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-8">
              <dt className="font-display text-lg font-bold">{s.title}</dt>
              <dd>{s.body}</dd>
            </div>
          );
          return s.computer ? <ComputerOnly key={s.title}>{row}</ComputerOnly> : row;
        })}
      </dl>
    </article>
  );
}
