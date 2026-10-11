"use client";

import { useEffect, useState } from "react";
import { AI_LEVELS, type AiLevel } from "@/lib/ai/levels";
import { claudeLimitWhPerDay, signInUsage, summaryFromSignIn, type SignInUsage } from "@/lib/ai/signin";
import { CLAUDE_PLANS, usageFromQuickCount, type ClaudePlan, type QuickService } from "@/lib/ai/quickCount";
import type { UsageSummary } from "@/lib/ai/exportParser";
import { canInstallExtension, countWithExtension, detectExtension, EXTENSION_URL } from "@/lib/extension";
import { SIGN_IN_READS } from "@/lib/signinReads";

const AI_NAMES: Record<QuickService, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" };
const SERVICES = Object.keys(AI_NAMES) as QuickService[];

/**
 * Sizing AI use. One click: pick light, medium or heavy. Exact: the Offset
 * extension counts the last 30 days in a tab where you're already logged in.
 * Without the extension (phones, Safari): count the chats in your sidebar.
 * The data export stays available for a full history.
 */
export function AiQuickPick({
  level,
  onPick,
  onExact,
  onMeasured,
}: {
  level: AiLevel | null;
  onPick: (level: AiLevel, from: string) => void;
  onExact: () => void;
  /** A summary of real use. `note` is set when it's the person's own count rather than a measurement. */
  onMeasured: (s: UsageSummary, note?: string) => void;
}) {
  const [ext, setExt] = useState<string[] | null>(null);
  const [installable, setInstallable] = useState(false);
  const [open, setOpen] = useState<QuickService | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "waiting" | "done" | "error"; text?: string; service?: QuickService }>({ kind: "idle" });

  useEffect(() => {
    setInstallable(canInstallExtension());
    detectExtension().then(setExt);
  }, []);

  async function measure(service: QuickService) {
    const name = AI_NAMES[service];
    setOpen(null);
    setStatus({ kind: "waiting", text: `Counting your ${name} use. This takes a few seconds…` });
    try {
      const u = signInUsage(await countWithExtension(service, (text) => setStatus({ kind: "waiting", text })));
      if (!u) throw new Error(`We couldn't read your ${name} use. Are you logged in to ${name} in this browser?`);
      setStatus({ kind: "done", service, text: resultText(name, u) });
      onMeasured(summaryFromSignIn(service, u));
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : `We couldn't count your ${name} use.` });
    }
  }

  function connect(service: QuickService) {
    if (ext?.includes(service)) measure(service);
    else setOpen(open === service ? null : service);
  }

  return (
    <div>
      <p className="font-semibold">How much do you use AI?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="How much you use AI">
        {(Object.keys(AI_LEVELS) as AiLevel[]).map((k) => {
          const l = AI_LEVELS[k];
          const on = level === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(k, `you picked ${l.label.toLowerCase()}`)}
              className={`min-h-14 rounded-md border-2 px-3 py-2 text-left ${on ? "border-rule bg-foreground text-background" : "border-border hover:border-rule"}`}
            >
              <span className="block font-semibold">{l.label}</span>
              <span className={`block text-sm ${on ? "opacity-80" : "text-muted"}`}>
                {l.who}, about {l.promptsPerDay} prompts
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-5 font-semibold">Or get your real numbers</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SERVICES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => connect(s)}
            aria-expanded={ext?.includes(s) ? undefined : open === s}
            className={`min-h-11 rounded-md border-2 border-rule px-4 font-semibold ${open === s ? "bg-foreground text-background" : "hover:bg-foreground hover:text-background"}`}
          >
            Connect {AI_NAMES[s]}
          </button>
        ))}
      </div>
      {ext ? (
        <p className="mt-2 text-sm text-muted">
          The Offset extension opens {ext.length > 1 ? "the service" : AI_NAMES[ext[0] as QuickService]} in a tab where you&apos;re already
          logged in and counts your last 30 days. Only the counts reach us, never your chats.{" "}
          <a href="/data" className="underline hover:text-foreground">
            What it reads
          </a>
        </p>
      ) : (
        !open && (
          <p className="mt-2 text-sm text-muted">
            {installable ? "Exact numbers with our free browser extension, or count your chats yourself in under a minute." : "Count your chats yourself in under a minute, no login needed."}
          </p>
        )
      )}

      {open && (
        <div className="mt-3 border-2 border-rule p-4">
          {installable && !ext && <ExtensionOffer name={AI_NAMES[open]} service={open} />}
          <QuickCountForm
            key={open}
            service={open}
            withHeading={installable && !ext}
            onDone={(u, note) => {
              setOpen(null);
              setStatus({ kind: "done", service: open, text: `${note[0].toUpperCase()}${note.slice(1)}.` });
              onMeasured(summaryFromSignIn(open, u), note);
            }}
          />
          <p className="mt-3 text-sm text-muted">
            Want your full history?{" "}
            <button type="button" onClick={onExact} className="underline hover:text-foreground">
              Add your {AI_NAMES[open]} data export
            </button>
            .
          </p>
        </div>
      )}

      {status.kind === "waiting" && <p className="mt-2 text-sm text-muted">{status.text}</p>}
      {status.kind === "done" && (
        <div className="mt-2 border-l-2 border-rule pl-3 text-sm">
          <p>{status.text}</p>
          <button
            type="button"
            onClick={() => {
              const name = AI_NAMES[status.service ?? "chatgpt"];
              setStatus({ kind: "idle" });
              onPick("medium", `you removed your ${name} numbers, so we use medium`);
            }}
            className="mt-1 underline hover:text-muted"
          >
            Remove these numbers
          </button>
        </div>
      )}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-700">{status.text}</p>}
    </div>
  );
}

function resultText(name: string, u: SignInUsage): string {
  return (
    `From your ${name} account: ${u.prompts.toLocaleString("en-US")} prompts${u.images ? ` and ${u.images} images` : ""} in the last ${u.days} days.` +
    (claudeLimitWhPerDay(u) > 0
      ? ` You've also used ${Math.round(u.weeklyLimitUsedPercent!)}% of your plan's weekly limit, which counts Claude Code, so we estimate from that: about ${(claudeLimitWhPerDay(u) / 1000).toFixed(1)} kWh a day.`
      : "")
  );
}

function ExtensionOffer({ name, service }: { name: string; service: QuickService }) {
  return (
    <div className="mb-4 border-b border-border pb-4">
      <p className="font-display text-lg font-bold">Exact numbers in one click</p>
      <p className="mt-1 text-sm">
        Add the free Offset extension to Chrome or Edge. Then Connect {name} counts your last 30 days in a few seconds, in a tab where
        you&apos;re already logged in. It reads: {SIGN_IN_READS[service]}
      </p>
      {EXTENSION_URL ? (
        <a
          href={EXTENSION_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-11 items-center rounded-md bg-foreground px-4 font-semibold text-background hover:opacity-90"
        >
          Add to Chrome, free
        </a>
      ) : (
        <p className="mt-2 text-sm text-muted">The extension is on its way to the Chrome Web Store.</p>
      )}
    </div>
  );
}

function QuickCountForm({
  service,
  withHeading,
  onDone,
}: {
  service: QuickService;
  withHeading: boolean;
  onDone: (u: SignInUsage, note: string) => void;
}) {
  const name = AI_NAMES[service];
  const [chats, setChats] = useState("");
  const [plan, setPlan] = useState<ClaudePlan>("pro");
  const [pct, setPct] = useState("");
  const n = Number(chats);
  const ok = chats !== "" && Number.isFinite(n) && n >= 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const u = usageFromQuickCount({
      chatsPerWeek: n,
      ...(service === "claude" ? { plan, weeklyLimitUsedPercent: Number(pct) || 0 } : {}),
    });
    const limit = claudeLimitWhPerDay(u);
    onDone(
      u,
      `from your count: ${n} ${name} chats a week, about ${u.prompts} prompts` +
        (limit > 0 ? `, and ${Math.round(u.weeklyLimitUsedPercent!)}% of your weekly limit (about ${(limit / 1000).toFixed(1)} kWh a day)` : ""),
    );
  }

  return (
    <form onSubmit={submit}>
      {withHeading && <p className="font-display text-lg font-bold">Or count it yourself</p>}
      <label className="mt-1 block text-sm">
        <span className="block">
          Open {name} and count the chats in your sidebar from the last 7 days (under Today, Yesterday and Previous 7 days).
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={chats}
          onChange={(e) => setChats(e.target.value)}
          placeholder="Chats"
          className="mt-2 min-h-11 w-32 rounded-md border-2 border-border bg-background px-3 focus:border-rule"
        />
      </label>
      {service === "claude" && (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <label className="block">
            <span className="block">Your Claude plan</span>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as ClaudePlan)}
              className="mt-2 min-h-11 w-full rounded-md border-2 border-border bg-background px-3 focus:border-rule"
            >
              {(Object.keys(CLAUDE_PLANS) as ClaudePlan[]).map((p) => (
                <option key={p} value={p}>
                  {CLAUDE_PLANS[p]}
                </option>
              ))}
            </select>
          </label>
          {plan !== "free" && (
            <label className="block">
              <span className="block">Weekly limit used, in Settings &gt; Usage (counts Claude Code)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="%"
                className="mt-2 min-h-11 w-24 rounded-md border-2 border-border bg-background px-3 focus:border-rule"
              />
            </label>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={!ok}
        className="mt-3 min-h-11 rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background disabled:opacity-50"
      >
        Use my count
      </button>
    </form>
  );
}
