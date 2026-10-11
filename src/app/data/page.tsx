import type { Metadata } from "next";
import Link from "next/link";
import { DataControls } from "@/components/DataControls";
import { RECLAIM_URL, SIGN_IN_READS, type SignInService } from "@/lib/signinReads";

export const metadata: Metadata = { title: "Your data | Offset" };

const NAMES: Record<SignInService, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  youtube: "YouTube",
  netflix: "Netflix",
  spotify: "Spotify",
  uber: "Uber",
};

const KEPT = [
  { where: "In your browser", what: "The plan you build and the amounts you enter, so they're still there when you come back. It never leaves your device." },
  { where: "On our server", what: "Your email, only if you join the waitlist. Nothing else." },
  { where: "Nowhere", what: "Anything from a sign-in or a file you add. We turn it into amounts on the page and keep none of it. API keys are used once and never saved or logged." },
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

      <h2 className="mt-10 text-xl font-semibold">What each sign-in reads</h2>
      <p className="mt-2 text-muted">
        When you press Connect, you log in on the real site inside a window run by{" "}
        <a href={RECLAIM_URL} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
          Reclaim Protocol
        </a>
        . Your password goes to that site, never to us. Every sign-in has a no-login choice
        beside it: pick a level, type an amount, or add a download.
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
        What&apos;s proven and what isn&apos;t: Reclaim proves that the login and the page read came from the real service. For ChatGPT,
        Claude, Gemini and YouTube, the counts themselves are tallied in your browser during the sign-in and aren&apos;t part of that proof.
        That&apos;s fine for sizing your own offset, but we don&apos;t claim more than that. After connecting, you see the numbers that came
        back and can remove them.
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
