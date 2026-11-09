import type { Metadata } from "next";
import Link from "next/link";
import { AccountDelete } from "@/components/Account";
import { ComputerOnly } from "@/components/ComputerOnly";
import { DataControls } from "@/components/DataControls";
import { accountsOn } from "@/lib/account";
import { PAYMENT_MODE } from "@/lib/payments";

export const metadata: Metadata = { title: "Your data | My Offset" };

// Each place data can be: what's there, what never is, and how it goes away. `computer` places mention the
// extension, so phones never see them (Ian, 2026-10-13). Shown as cards so all of it is visible at once (Ian, 2026-10-25).
type Place = { where: string; items: string[]; never?: string; note?: string; computer?: boolean };
const KEPT: Place[] = [
  {
    where: "In your browser",
    items: ["The plan you build and the amounts you enter", "What you've offset"],
    note: "Only what you've offset leaves your device, and only if you sign in.",
  },
  PAYMENT_MODE === "pledgeapi"
    ? {
        where: "On my server",
        items: [
          ...(accountsOn() ? ["Your email, and what you've offset with its dates"] : []),
          "Your name and email from Stripe, passed to Pledge so each gift is made in your name",
          "Each gift's charity, amount and date, and Pledge's record of it",
        ],
        never: "Your card number, or how much you use anything. Those counts stay in your browser.",
        ...(accountsOn() ? { note: "Deleting your account below removes your email and what you've offset. Gift records stay." } : {}),
      }
    : accountsOn()
    ? {
        where: "On my server",
        items: [
          "Your email, and what you've offset with its dates",
          "Each gift's charity, amount and date from Every.org, and your email if you share it there",
        ],
        never: "How much you use anything or what you spend. Those totals stay in your browser.",
        note: "Deleting your account below removes your email and what you've offset. Gifts stay on the ledger without your name.",
      }
    : {
        where: "On my server",
        items: ["Each gift's charity, amount and date from Every.org, and your email if you share it there"],
        never: "How much you use anything.",
        note: "There are no accounts yet, so there's no sign-in email.",
      },
  {
    where: "In the extension",
    computer: true,
    items: [
      "The last result for each service, and a day-by-day record of those totals for about two years",
      "How many prompts and images each ChatGPT chat had per day, so it only rereads chats that changed",
      "Order totals from Amazon, DoorDash and Uber Eats, and Uber ride fares",
    ],
    never: "Titles, text, products, item prices, restaurants, addresses or routes. It's sent only to this page, when you open it.",
    note: "Clearing below deletes all of it, and so does removing the extension.",
  },
  {
    where: "Nowhere",
    items: [
      "Any file you add. I turn it into amounts on the page and keep none of it.",
      "Your state, guessed from your connection's location on each visit",
    ],
    note: "Picking a state replaces the guess.",
  },
  {
    where: "Passes through, not kept",
    items: [
      "An API key you paste, sent once to OpenAI or Anthropic to get your usage totals back",
      "If you join Who's offsetting: your plan's amounts, birth year and state, so my server can work out and check your gifts",
    ],
    note: "From Who's offsetting I keep only the name you pick, the items, the dates and the gifts, never the amounts you entered.",
  },
];

export default function DataPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Your data</h1>
      <p className="mt-4 text-lg text-muted">What I read, what I keep, and how to delete it. I will never sell any of it.</p>

      <h2 className="mt-10 text-xl font-semibold">What I keep</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {KEPT.map((k) => {
          const card = (
            <section key={k.where} className="h-full border-t-[6px] border-rule bg-card px-4 py-3">
              <h3 className="font-display font-bold">{k.where}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {k.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              {k.never && (
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Never: </span>
                  {k.never}
                </p>
              )}
              {k.note && <p className="mt-2 text-sm text-muted">{k.note}</p>}
            </section>
          );
          return k.computer ? <ComputerOnly key={k.where}>{card}</ComputerOnly> : card;
        })}
      </div>

      <ComputerOnly>
        <h2 id="extension" className="mt-10 scroll-mt-24 text-xl font-semibold">What the extension reads</h2>
        <p className="mt-2">
          On a computer, the free My Offset extension for Chrome and Edge can count your real use. It runs only when you press Measure,
          counts in your own browser and hands this page only the counts. It never sees your password, your chats or what you watched.{" "}
          <Link href="/extension#reads" className="text-accent underline underline-offset-4">
            See exactly what it reads
          </Link>
        </p>
        <p className="mt-2 text-sm text-muted">
          You don&apos;t need it. You can pick a level, count the chats in your sidebar yourself, or add your data export. After
          connecting, you see the numbers that came back and can remove them.
        </p>
      </ComputerOnly>

      <h2 className="mt-10 text-xl font-semibold">Delete it</h2>
      <div className="mt-3">
        <div className="grid gap-6 sm:max-w-md">
          <DataControls />
          <AccountDelete />
        </div>
      </div>
      <p className="mt-6 text-muted">
        See <Link href="/promises" className="text-accent underline underline-offset-4">my promises</Link> and{" "}
        <Link href="/ledger" className="text-accent underline underline-offset-4">where the money goes</Link>.
      </p>
    </article>
  );
}
