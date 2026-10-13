import type { Metadata } from "next";
import Link from "next/link";
import { AccountDelete } from "@/components/Account";
import { ComputerOnly } from "@/components/ComputerOnly";
import { DataControls } from "@/components/DataControls";
import { accountsOn } from "@/lib/account";
import { SIGN_IN_READS, type SignInService } from "@/lib/signinReads";

export const metadata: Metadata = { title: "Your data | My Offset" };

const NAMES: Record<SignInService, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  youtube: "YouTube",
  netflix: "Netflix",
  doordash: "DoorDash",
  ubereats: "Uber Eats",
  amazon: "Amazon",
  uber: "Uber",
};

// `computer` rows mention the extension, so phones never see them (Ian, 2026-10-13).
const KEPT: { where: string; what: string; computer?: boolean }[] = [
  {
    where: "In your browser",
    what: "The plan you build, the amounts you enter and what you've offset, so they're still there when you come back. Only what you've offset leaves your device, and only if you sign in.",
  },
  accountsOn()
    ? {
        where: "On my server",
        what: "If you sign in: your email, and what you've offset with its start and end dates. If you give through this site's links: each gift's charity, amount and date from Every.org, and your email if you share it there, linked to your account if you have one. Never how much you use anything or what you spend: those counts and totals stay in your browser. Deleting your account below removes your email and what you've offset; gifts stay on the ledger without your name.",
      }
    : {
        where: "On my server",
        what: "There are no accounts yet, so no sign-in email. If you give through this site's links, Every.org tells me each gift's charity, amount and date, and your email if you share it there, so I can show which gifts arrived. Never how much you use anything.",
      },
  {
    where: "In the extension",
    computer: true,
    what: "If you use it: the last result for each service and a day-by-day record of those totals (up to about two years), so this page fills in straight away and monthly measuring builds a fuller history. Also how many prompts and images each ChatGPT chat had per day, so next time it only reads chats that changed. Only counts, dates, order totals from Amazon, DoorDash and Uber Eats, and Uber ride fares. Never titles, text, products, item prices, restaurants, addresses or routes, and never sent to me except to this page when you open it. Clearing below deletes all of it, and so does removing the extension.",
  },
  {
    where: "Nowhere",
    what: "Any file you add: I turn it into amounts on the page and keep none of it. Your state starts as a guess from your connection's location, which my host reads on each visit; I don't save it, and picking a state replaces the guess.",
  },
  {
    where: "Passes through, not kept",
    what: "If you paste an API key, it goes through my server once, to ask OpenAI or Anthropic for your usage totals, which come straight back to this page. I don't save or log the key or the totals. If you join Who's offsetting, your browser sends the amounts on your plan with your birth year and state, so my server can work out the gifts and check that Every.org confirmed them. It keeps only the name you pick, the items and dates, and those gifts, never the amounts you entered. It also gets the names of the items you use none of, which count as offset on the list, but no amounts or counts.",
  },
];

export default function DataPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Your data</h1>
      <p className="mt-4 text-lg text-muted">What I read, what I keep, and how to delete it. I will never sell any of it.</p>

      <h2 className="mt-10 text-xl font-semibold">What I keep</h2>
      <dl className="mt-3 border-t-2 border-rule">
        {KEPT.map((k) => {
          const row = (
            <div key={k.where} className="grid gap-1 border-b border-border py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
              <dt className="font-display font-bold">{k.where}</dt>
              <dd>{k.what}</dd>
            </div>
          );
          return k.computer ? <ComputerOnly key={k.where}>{row}</ComputerOnly> : row;
        })}
      </dl>

      <ComputerOnly>
        <h2 id="extension" className="mt-10 scroll-mt-24 text-xl font-semibold">What the extension reads</h2>
        <p className="mt-2 text-muted">
          On a computer, the free My Offset extension for Chrome and Edge gets your real numbers. When you press Measure, it opens each service
          in a small window behind yours, where you&apos;re already logged in, counts in your browser, closes the window and hands this page
          only the counts below. It never sees your password and never reads or sends your chats or what you watched. It only runs when you
          press Measure. It has no analytics, and the only places it contacts are the services it&apos;s counting.{" "}
          <Link href="/extension" className="text-accent underline underline-offset-4">
            How the extension works
          </Link>
        </p>
        <dl className="mt-3 border-t-2 border-rule">
          {(Object.keys(SIGN_IN_READS) as SignInService[]).map((s) => (
            <div key={s} className="grid gap-1 border-b border-border py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
              <dt className="font-display font-bold">{NAMES[s]}</dt>
              <dd>{SIGN_IN_READS[s]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">
          You don&apos;t need it. You can pick a level, count the chats in your sidebar yourself, or add your data export. The counts come
          from your own browser, so they size your offset honestly but aren&apos;t a proof to anyone else, and I don&apos;t claim they are.
          After connecting, you see the numbers that came back and can remove them.
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
