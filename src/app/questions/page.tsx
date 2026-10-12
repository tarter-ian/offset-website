import type { Metadata } from "next";
import Link from "next/link";
import * as F from "@/lib/factors";
import { aiAnswer, codingHour, QUESTIONS, streamingHour } from "@/lib/questions";
import { energy, link, mass, volume } from "@/components/QuestionPage";

export const metadata: Metadata = {
  title: "Questions about the footprint of AI and streaming | My Offset",
  description: "Short answers on the energy, water and carbon behind ChatGPT, Claude Code and streaming video, worked out from published figures.",
  alternates: { canonical: "/questions" },
};

export default function QuestionsPage() {
  const prompt = aiAnswer(F.WH_PER_AI_PROMPT);
  const stream = streamingHour();
  const code = codingHour();
  // One line each, from the same numbers the pages use.
  const short: Record<string, string> = {
    "how-much-energy-does-a-chatgpt-prompt-use": `About ${energy(F.WH_PER_AI_PROMPT)} to answer, ${energy(prompt.totalWh)} with its share of training.`,
    "how-much-water-does-chatgpt-use": `About ${volume(prompt.water.total)} a prompt, for cooling and at the power plants.`,
    "netflix-streaming-carbon-footprint": `About ${mass(stream.impacts.carbon)} of CO₂e an hour, for the data centers and networks.`,
    "claude-code-energy-use": `About ${energy(F.WH_PER_CLAUDE_CODE_HOUR)} an hour, or ${mass(code.impacts.carbon)} of CO₂e.`,
  };
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Questions</h1>
      <p className="mt-4 text-lg text-muted">
        Short answers, worked out from the same figures our calculator uses. Each one shows how we got there.
      </p>
      <ul className="mt-8 divide-y divide-border border-y-2 border-rule">
        {QUESTIONS.map((q) => (
          <li key={q.slug} className="py-4">
            <Link href={`/questions/${q.slug}`} className="text-lg font-semibold underline underline-offset-4">
              {q.question}
            </Link>
            <p className="mt-1 text-sm text-muted">{short[q.slug]}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-muted">
        Every factor and source is on{" "}
        <Link href="/method" className={link}>
          How we calculate
        </Link>
        .{" "}
        <Link href="/" className={link}>
          Measure your own use
        </Link>
        .
      </p>
    </article>
  );
}
