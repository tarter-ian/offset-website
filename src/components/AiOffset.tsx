"use client";

import { useState } from "react";
import { AiExportUpload } from "./AiExportUpload";
import { Field, NumberInput } from "./fields";
import { Results } from "./Results";
import { computeFootprint, DEFAULT_ANSWERS, type Answers } from "@/lib/footprint";

/** A short path for people who only want to cover their AI use. */
export function AiOffset() {
  const [digital, setDigital] = useState<Answers["digital"]>({ ...DEFAULT_ANSWERS.digital, aiFromExport: false });
  const [done, setDone] = useState(false);
  const answers: Answers = { ...DEFAULT_ANSWERS, digital };

  if (done) {
    return (
      <Results
        footprint={computeFootprint(answers)}
        answers={answers}
        onEdit={() => setDone(false)}
        show={["ai"]}
        initialCovered={["ai"]}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <AiExportUpload
        onResult={(s) => setDigital((d) => ({ ...d, aiPromptsPerDay: Math.round(s.promptsPerDay * 10) / 10, aiFromExport: true }))}
      />
      <Field label="AI chatbot prompts a day" hint="Filled in from your export, or enter your own estimate.">
        <NumberInput
          label="AI prompts a day"
          suffix="prompts a day"
          value={digital.aiPromptsPerDay}
          onChange={(n) => setDigital((d) => ({ ...d, aiPromptsPerDay: n ?? 0, aiFromExport: false }))}
        />
      </Field>
      <Field label="AI images or videos made a week">
        <NumberInput
          label="AI images or videos a week"
          suffix="a week"
          value={digital.aiMediaPerWeek}
          onChange={(n) => setDigital((d) => ({ ...d, aiMediaPerWeek: n ?? 0 }))}
        />
      </Field>
      <button
        type="button"
        onClick={() => setDone(true)}
        className="rounded-lg bg-accent px-5 py-2 font-medium text-white hover:bg-accent-strong"
      >
        See my AI footprint
      </button>
    </div>
  );
}
