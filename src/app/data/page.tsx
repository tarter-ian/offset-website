import type { Metadata } from "next";
import Link from "next/link";
import { DataControls } from "@/components/DataControls";
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

const KEPT = [
  { where: "In your browser", what: "The plan you build and the amounts you enter, so they're still there when you come back. It never leaves your device." },
  { where: "On our server", what: "Nothing. There are no accounts yet, so we keep no email or name. When accounts arrive, this line will say exactly what they store." },
  {
    where: "In the extension",
    what: "If you use it: the last result for each service and a day-by-day record of those totals (up to about two years), so this page fills in straight away and monthly measuring builds a fuller history. Also how many prompts and images each ChatGPT chat had per day, so next time it only reads chats that changed. Only counts, dates and Amazon order totals. Never titles, text, products or addresses, and never sent to us except to this page when you open it. Clearing below deletes all of it, and so does removing the extension.",
  },
  { where: "Nowhere else", what: "The counts the extension hands this page, and any file you add. We turn them into amounts on the page and keep none of it. API keys are used once and never saved or logged. Your state starts as a guess from your connection's location, which our host reads on each visit; we don't save it, and picking a state replaces the guess." },
];

export default function DataPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Your data</h1>
      <p className="mt-4 text-lg text-muted">What we read, what we keep, and how to delete it. We will never sell any of it.</p>

      <h2 className="mt-10 text-xl font-semibold">What we keep</h2>
      <dl className="mt-3 border-t-2 border-rule">
        {KEPT.map((k) => (
          <div key={k.where} className="grid gap-1 border-b border-border py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
            <dt className="font-display font-bold">{k.where}</dt>
            <dd>{k.what}</dd>
          </div>
        ))}
      </dl>

      <h2 id="extension" className="mt-10 scroll-mt-24 text-xl font-semibold">What the extension reads</h2>
      <p className="mt-2 text-muted">
        On a computer, the free My Offset extension for Chrome and Edge gets your real numbers. When you press Measure, it opens each service
        in a small window behind yours, where you&apos;re already logged in, counts in your browser, closes the window and hands this page
        only the counts below. It never sees your password and never reads or sends your chats or what you watched. It only runs when you
        press Measure. It has no analytics, and the only places it contacts are the services it&apos;s counting.{" "}
        <Link href="/extension" className="text-accent hover:underline">
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
        from your own browser, so they size your offset honestly but aren&apos;t a proof to anyone else, and we don&apos;t claim they are.
        After connecting, you see the numbers that came back and can remove them.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Delete it</h2>
      <div className="mt-3">
        <DataControls />
      </div>
      <p className="mt-6 text-muted">
        See <Link href="/promises" className="text-accent hover:underline">our promises</Link> and{" "}
        <Link href="/ledger" className="text-accent hover:underline">where the money goes</Link>.
      </p>
    </article>
  );
}
