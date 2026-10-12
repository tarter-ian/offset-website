import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink } from "@/components/ContactLink";

export const metadata: Metadata = { title: "Privacy policy | Offset" };

const UPDATED = "October 12, 2026";

// The plain-language version is /data. This is the same thing, in the order a privacy policy is expected to have.
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Who we are",
    body: (
      <>
        Offset is run by Ian Tarter, one person, not a company. Questions about your data go to <ContactLink />.
      </>
    ),
  },
  {
    title: "What we collect",
    body: (
      <>
        Today, nothing that identifies you. There are no accounts, so we have no name, email or password. The plan you build is saved in
        your own browser and never sent to us. To guess your state, our host (Cloudflare) reads the location of your internet connection
        on each visit; we use it for that page and don&apos;t save it. Cloudflare keeps standard request logs for security, which we
        don&apos;t use for anything else. We use no analytics, ads or tracking cookies.
      </>
    ),
  },
  {
    title: "The browser extension",
    body: (
      <>
        The optional extension reads usage counts (prompts, videos, orders, rides and similar) from services you are already logged in to,
        only when you press Measure, and hands them to this page in your browser. It never reads or sends the text of chats, titles, what
        you watched, products, restaurants or addresses. Amazon order totals and spend by category are the only money figures it reads. It
        keeps the last results and a day-by-day record of those counts inside the extension so pages fill in quickly; removing the
        extension or pressing Clear deletes them. The list of exactly what it reads for each service is on{" "}
        <Link href="/data#extension" className="text-accent hover:underline">
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
    body: "If you add a data export or an API key, it is read once to produce the counts on the page. We keep none of it, and keys are never saved or logged.",
  },
  {
    title: "When you pay",
    body: "Payments aren't switched on yet. When they are, a card processor will take your card details, and we will never see or store your card number. We will keep your email, what you gave and when, so we can send receipts and the heads-up before any autopay charge. Your donation goes through a donation partner, which keeps your name and email to issue the tax receipt under its own privacy policy. This section will name both companies before the first payment.",
  },
  {
    title: "Who we share it with",
    body: "No one, except the companies that make the service run: our host now, and the card processor and donation partner once payments start, each only for its own job. We will never sell your data or share it for advertising.",
  },
  {
    title: "The public list",
    body: "If you choose to appear on the public list of people who are fully offset, the name you give and your badge are shown. It's off unless you switch it on, and you can leave it at any time.",
  },
  {
    title: "Deleting your data",
    body: (
      <>
        Everything this site keeps is in your browser or the extension, and{" "}
        <Link href="/data" className="text-accent hover:underline">
          Your data
        </Link>{" "}
        has buttons that clear both. Once payments start, you can ask us to delete your payment records too, except what the law or the
        donation partner requires us to keep for tax receipts.
      </>
    ),
  },
  {
    title: "Children",
    body: "The site isn't meant for children under 13, and only adults can pay.",
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
        <Link href="/data" className="text-accent hover:underline">
          Your data
        </Link>
        : we keep almost nothing and never sell it.
      </p>
      <dl className="mt-8 border-t-2 border-rule">
        {SECTIONS.map((s) => (
          <div key={s.title} className="grid gap-1 border-b border-border py-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-8">
            <dt className="font-display text-lg font-bold">{s.title}</dt>
            <dd>{s.body}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
