import type { Metadata } from "next";
import Link from "next/link";
import { EXTENSION_URL } from "@/lib/extension";
import { SIGN_IN_READS, type SignInService } from "@/lib/signinReads";

export const metadata: Metadata = {
  title: "The extension | Offset",
  description: "What the free Offset extension for Chrome and Edge does, what it reads, and how to remove it.",
};

const NAMES: Record<SignInService, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  youtube: "YouTube",
};

const STEPS = [
  { title: "You press Measure", body: "Nothing happens until you do. It never runs on its own or in the background." },
  {
    title: "The first time, it asks",
    body: "A small Offset window lists the sites it needs and what it reads there. You can allow all of them, pick some, or say not now.",
  },
  {
    title: "It counts, out of your way",
    body: "It opens each service in a minimized window where you're already logged in, counts the last 30 days, and closes the window.",
  },
  { title: "You see what it found", body: "The counts appear on the page, with a link that shows exactly what the extension handed over." },
];

const QUESTIONS = [
  {
    q: "Can it read my chats?",
    a: "It can open the page your chats are on, which is why Chrome words its prompt the way it does. The counting code only tallies prompts, images and videos by day. No chat text, titles or video names are passed on. After each run you can open “See exactly what the extension sent” and check.",
  },
  {
    q: "Why does Chrome say it can “read and change your data”?",
    a: "That's the wording Chrome uses for any extension that opens a site for you, whatever it does there. Offset only counts. It never posts, deletes or changes anything on your accounts.",
  },
  {
    q: "Does it send my data to you?",
    a: "No. The counts go from the extension to this page in your own browser. They only leave your device if you save a plan, and then only as amounts. The extension itself has no analytics and only contacts the services it's counting.",
  },
  {
    q: "Do I need it?",
    a: "No. You can pick light, medium or heavy, count the chats in your sidebar yourself, or add a data export. The extension just gives the most accurate numbers with the least effort.",
  },
  {
    q: "Does it work on my phone?",
    a: "No. It's for Chrome and Edge on computers. On a phone, the quick count on the AI card takes about a minute.",
  },
  {
    q: "How do I take it back or remove it?",
    a: "To take back a site's access, open chrome://extensions, click Details on Offset, and turn the site off. To remove it, click Remove on the same page. Nothing is left behind.",
  },
];

export default function ExtensionPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">The Offset extension</h1>
      <p className="mt-4 text-lg text-muted">
        A free add-on for Chrome and Edge that counts how much you use ChatGPT, Claude, Gemini and YouTube, so your offset is sized from
        your real use instead of a guess.
      </p>
      <div className="mt-6">
        {EXTENSION_URL ? (
          <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-md bg-foreground px-5 font-semibold text-background hover:opacity-90"
          >
            Add to Chrome, free
          </a>
        ) : (
          <p className="text-muted">It&apos;s on its way to the Chrome Web Store.</p>
        )}
      </div>

      <h2 className="mt-12 text-xl font-semibold">What happens when you press Measure</h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-t-2 border-rule pt-3">
            <p className="font-mono text-sm text-muted">{i + 1}</p>
            <p className="font-display text-lg font-bold">{s.title}</p>
            <p className="mt-1">{s.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 text-xl font-semibold">What it reads</h2>
      <dl className="mt-3 border-t-2 border-rule">
        {(Object.keys(SIGN_IN_READS) as SignInService[]).map((s) => (
          <div key={s} className="grid gap-1 border-b border-border py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
            <dt className="font-display font-bold">{NAMES[s]}</dt>
            <dd>{SIGN_IN_READS[s]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted">
        You need to be logged in to each service in the same browser. YouTube and Gemini are read from Google My Activity, so their history
        needs to be turned on in your Google account.
      </p>

      <h2 className="mt-12 text-xl font-semibold">Questions people ask</h2>
      <dl className="mt-3 border-t-2 border-rule">
        {QUESTIONS.map((x) => (
          <div key={x.q} className="grid gap-1 border-b border-border py-4 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-8">
            <dt className="font-display font-bold">{x.q}</dt>
            <dd>{x.a}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 text-muted">
        The extension&apos;s code is public, so anyone can check what it does:{" "}
        <a href="https://github.com/tarter-ian/offset-extension" target="_blank" rel="noreferrer" className="text-accent hover:underline">
          github.com/tarter-ian/offset-extension
        </a>
        . More on what we keep and how to delete it on{" "}
        <Link href="/data" className="text-accent hover:underline">
          Your data
        </Link>
        . Made by{" "}
        <Link href="/promises#who" className="text-accent hover:underline">
          Ian Tarter
        </Link>
        .
      </p>
    </article>
  );
}
