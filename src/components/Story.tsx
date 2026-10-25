"use client";
// The problem, one screen at a time, then the bill (Ian, 2026-10-24), redone from the research in
// /mnt/project-files/notes/home-story-research.md: the visitor's own numbers with everyday comparisons,
// one claim per screen, each screen short enough that the next one peeks in, and motion
// only on the dot chart, off when the device asks for reduced motion.
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as F from "@/lib/factors";
import { aiImpacts } from "@/lib/footprint";

// A typical microwave draws about 1,100 W; a drop of water is about 0.05 mL.
const MICROWAVE_W = 1100;
const ML_PER_DROP = 0.05;

/** Line drawings in ink, so they follow dark mode. */
function Drawing({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 240 180"
      role="img"
      aria-label={label}
      className="w-44 text-foreground sm:w-56 md:w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ground = <path d="M10 160H230" />;

const chat = (
  <Drawing label="A question and an answer in a chat">
    <path d="M30 30H150A10 10 0 0 1 160 40V78A10 10 0 0 1 150 88H66L44 106V88H30A10 10 0 0 1 20 78V40A10 10 0 0 1 30 30Z" />
    <path d="M90 100H210A10 10 0 0 1 220 110V140A10 10 0 0 1 210 150H196V166L176 150H90A10 10 0 0 1 80 140V110A10 10 0 0 1 90 100Z" />
    {[128, 150, 172].map((x) => (
      <circle key={x} cx={x} cy={125} r={4} fill="currentColor" stroke="none" />
    ))}
  </Drawing>
);

const racks = (
  <Drawing label="Rows of servers in a data center">
    {[40, 97, 154].map((x) => (
      <g key={x}>
        <rect x={x} y={30} width={46} height={130} rx={3} />
        {[50, 72, 94, 116, 138].map((y) => (
          <g key={y}>
            <path d={`M${x + 8} ${y}H${x + 28}`} />
            <circle cx={x + 37} cy={y} r={2.5} fill="currentColor" stroke="none" />
          </g>
        ))}
      </g>
    ))}
    {ground}
  </Drawing>
);

const plant = (
  <Drawing label="A power plant with a smoking chimney beside a power line">
    <rect x={30} y={112} width={88} height={48} />
    <path d="M44 112V96L64 104V112M64 104V96L84 104V112" />
    <path d="M128 160L133 52H147L152 160" />
    <g opacity={0.55}>
      <circle cx={150} cy={38} r={9} />
      <circle cx={168} cy={25} r={12} />
      <circle cx={190} cy={15} r={14} />
    </g>
    <path d="M190 160L203 78L216 160M195 128H211M193 98H213M186 88H220M220 88C228 92 234 92 240 90" />
    {ground}
  </Drawing>
);

const cooling = (
  <Drawing label="A cooling tower giving off water vapor">
    <path d="M62 160C80 120 82 88 74 56H150C142 88 144 120 162 160" />
    <path d="M78 74H146" opacity={0.5} />
    <g opacity={0.55}>
      <path d="M92 46C82 36 102 26 92 14" />
      <path d="M112 46C102 36 122 26 112 14" />
      <path d="M132 46C122 36 142 26 132 14" />
    </g>
    <path d="M205 96C205 96 192 114 192 123A13 13 0 0 0 218 123C218 114 205 96 205 96Z" />
    {ground}
  </Drawing>
);

/** One dot per AI answer in a year, drawn in as it scrolls into view. */
function YearDots({ count }: { count: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let frame = 0;
    let shown = 0;
    let started = false;
    const draw = () => {
      const width = canvas.clientWidth;
      const pitch = width < 500 ? 4 : 6;
      const cols = Math.max(1, Math.floor(width / pitch));
      const rows = Math.ceil(count / cols);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.height = `${rows * pitch}px`;
      canvas.width = width * dpr;
      canvas.height = rows * pitch * dpr;
      const c = canvas.getContext("2d");
      if (!c) return { cols, pitch, c: null };
      c.scale(dpr, dpr);
      c.fillStyle = getComputedStyle(canvas).color;
      return { cols, pitch, c };
    };
    let g = draw();
    const paint = (to: number) => {
      if (!g.c) return;
      const r = g.pitch * 0.3;
      for (let i = shown; i < to; i++) {
        g.c.beginPath();
        g.c.arc((i % g.cols) * g.pitch + g.pitch / 2, Math.floor(i / g.cols) * g.pitch + g.pitch / 2, r, 0, 2 * Math.PI);
        g.c.fill();
      }
      shown = to;
    };
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = () => {
      if (started) return;
      started = true;
      if (still) return paint(count);
      const t0 = performance.now();
      const step = (t: number) => {
        paint(Math.min(count, Math.round(count * Math.min(1, (t - t0) / 1600))));
        if (shown < count) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    const seen = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && start(), { threshold: 0.3 });
    seen.observe(canvas);
    const resize = () => {
      const had = shown;
      shown = 0;
      g = draw();
      paint(had);
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [count]);
  return <canvas ref={ref} role="img" aria-label={`${count.toLocaleString()} dots, one for each AI answer in a year`} className="block w-full text-foreground" />;
}

const round = (n: number) => (n >= 10 ? Math.round(n).toLocaleString() : n >= 1 ? n.toFixed(1).replace(/\.0$/, "") : n.toPrecision(1));

export function Story({ promptsPerDay, whPerPrompt }: { promptsPerDay: number; whPerPrompt?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wh = whPerPrompt ?? F.WH_PER_AI_PROMPT;
  // Each answer with its share of training, as the bill counts it.
  const answerWh = wh / (1 - F.AI_TRAINING_SHARE);
  const seconds = (answerWh / MICROWAVE_W) * 3600;
  const grams = aiImpacts(wh / 1000).carbon * 1000;
  const drops = ((answerWh / 1000) * F.DATACENTER_L_PER_KWH * 1000) / ML_PER_DROP;
  const perDay = Math.max(0, promptsPerDay) + F.AI_BUILT_IN_PROMPTS_PER_DAY;
  const perYear = Math.round(perDay * 365);
  const yearKg = (aiImpacts((Math.max(0, promptsPerDay) * wh + F.AI_BUILT_IN_PROMPTS_PER_DAY * F.WH_PER_AI_PROMPT) * 0.365).carbon);
  const miles = yearKg / (F.KG_CO2_PER_GAL_GASOLINE / F.DEFAULT_MPG);

  const screen = "grid min-h-[72svh] content-center gap-8 border-b border-border py-14 md:grid-cols-[minmax(0,1fr)_17rem] md:items-center md:gap-14";
  const head = "max-w-2xl font-display text-4xl leading-[1.1] font-semibold sm:text-6xl";
  const fact = "mt-5 max-w-xl text-lg text-muted sm:text-xl";

  return (
    <div aria-label="Why offset your AI use">
      {/* Shorter than the rest, so the next screen shows below it and the page doesn't look finished (NN/g). */}
      <section className={screen.replace("min-h-[72svh]", "min-h-[60svh]")}>
        <div className="md:order-2">{chat}</div>
        <div>
          <h2 className={head}>What does your AI use cost the planet?</h2>
          <p aria-hidden="true" className="mt-10 text-2xl text-muted">
            ↓
          </p>
        </div>
      </section>
      <section className={screen}>
        <div className="md:order-2">{racks}</div>
        <div>
          <h2 className={head}>Every answer runs in a data center.</h2>
          <p className={fact}>Each one draws about as much power as a microwave running {round(seconds)} seconds.</p>
        </div>
      </section>
      <section className={screen}>
        <div className="md:order-2">{plant}</div>
        <div>
          <h2 className={head}>Much of that power still comes from gas and coal.</h2>
          <p className={fact}>About {round(grams)} grams of CO₂ an answer, plus smog where people breathe.</p>
        </div>
      </section>
      <section className={screen}>
        <div className="md:order-2">{cooling}</div>
        <div>
          <h2 className={head}>The servers are cooled with water.</h2>
          <p className={fact}>About {round(drops)} drops for each answer.</p>
        </div>
      </section>
      <section className="border-b border-border py-14">
        <h2 className={head}>One answer is a speck. Here&apos;s your year.</h2>
        <p className={fact}>
          At {round(perDay)} AI answers a day, that&apos;s {perYear.toLocaleString()}: about {round(yearKg)} kg of CO₂, like driving {round(miles)} miles.
        </p>
        <div className="mt-8">{mounted && <YearDots count={perYear} />}</div>
      </section>
      <section className="flex min-h-[50svh] flex-col justify-center py-14">
        <h2 className={head}>Small, real, and easy to fix.</h2>
        <p className={fact}>I pay charities that repair each harm, to the cent.</p>
        <p className="mt-8">
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
