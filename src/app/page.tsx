import { Store } from "@/components/Store";
import { WaitlistForm } from "@/components/WaitlistForm";

const POINTS = [
  {
    title: "Your real month, not a guess",
    body: "Link your utility and we use your actual usage, so a cold January and a mild May each get the offset they need.",
  },
  {
    title: "Donations to vetted charities",
    body: "Your offset goes straight to climate charities we vet, through a donation partner. We never hold the money.",
  },
  {
    title: "You approve every payment",
    body: "You approve every payment yourself, once a year or each month. Nothing is charged automatically.",
  },
  {
    title: "More than carbon",
    body: "We also count the air pollution, water and land behind your footprint, and fund charities that work on each.",
  },
  {
    title: "Cover what you care about",
    body: "Offset everything, or just one part, like your AI use or your flights. Each part you cover earns its own badge.",
  },
  {
    title: "Show it off",
    body: "Every approved month earns badges and adds to your streak, with an optional spot on our public list.",
  },
];

const STEPS = [
  "Pick the parts of your life you want to offset, starting with AI.",
  "Link your accounts for exact numbers, or go with typical amounts.",
  "Pay once for life, or approve each year or month. Nothing is charged automatically.",
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <Store />

      <h2 className="mb-5 text-2xl font-semibold tracking-tight">Why Offset</h2>
      <section className="grid gap-4 pb-16 sm:grid-cols-2">
        {POINTS.map((p) => (
          <div key={p.title} className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-2 text-muted">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="pb-16">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="rounded-xl bg-accent-soft p-5">
              <span className="text-sm font-semibold text-accent">Step {i + 1}</span>
              <p className="mt-1">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-20 rounded-2xl border border-border bg-card p-8">
        <h2 className="text-2xl font-semibold tracking-tight">Accounts open soon</h2>
        <p className="mt-2 mb-5 text-muted">
          Join the waitlist and we&apos;ll email you when you can link accounts and start offsetting.
        </p>
        <WaitlistForm />
      </section>
    </div>
  );
}
