// The problem, one screen at a time, then the bill (Ian, 2026-10-24: stretch the opening out
// without putting more on any one screen). Every claim here is one the method page sources.
const STEPS: { head: string; body: string }[] = [
  {
    head: "Every answer from ChatGPT, Claude or Gemini is worked out in a data center.",
    body: "Rooms of chips run day and night so the reply feels instant.",
  },
  {
    head: "Those chips run on the grid.",
    body: "Most US power still comes from burning gas and coal. That puts carbon in the air, and smog where people breathe.",
  },
  {
    head: "They're cooled with water.",
    body: "Much of it evaporates, often in places that are already short of it.",
  },
  {
    head: "The power behind them takes up land.",
    body: "Power plants, and the mines and wells that feed them, sit on ground that was once forest or prairie.",
  },
  {
    head: "One question is tiny. Every day for years isn't.",
    body: "And nobody sends you a bill for it.",
  },
];

export function Story() {
  return (
    <div aria-label="Why offset your AI use">
      {STEPS.map((s, i) => (
        <section key={s.head} className="flex min-h-[80svh] flex-col justify-center border-b border-border py-16">
          <h2 className="max-w-3xl font-display text-4xl leading-[1.1] font-semibold sm:text-6xl">{s.head}</h2>
          <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">{s.body}</p>
          {i === 0 && (
            <p aria-hidden="true" className="mt-16 text-sm text-muted">
              Scroll ↓
            </p>
          )}
        </section>
      ))}
      <section className="flex min-h-[70svh] flex-col justify-center py-16">
        <h2 className="max-w-3xl font-display text-4xl leading-[1.1] font-semibold sm:text-6xl">So here&apos;s yours.</h2>
        <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
          I count your real use, itemize what it costs the planet, and pay a charity that repairs each harm. I don&apos;t take a cut.
        </p>
        <p className="mt-10">
          <a
            href="#your-bill"
            className="inline-flex min-h-11 items-center rounded-md border-2 border-rule px-5 font-semibold hover:bg-foreground hover:text-background"
          >
            See your bill ↓
          </a>
        </p>
      </section>
    </div>
  );
}
