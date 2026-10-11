"use client";

import { useEffect, useState } from "react";
import { AiExportUpload } from "./AiExportUpload";
import { Choice, Field, NumberInput, Select } from "./fields";
import { Results } from "./Results";
import { STATE_OPTIONS, type StateCode } from "@/lib/data/states";
import { computeFootprint, DEFAULT_ANSWERS, type Answers } from "@/lib/footprint";

const STORAGE_KEY = "offset:answers";
const STEPS = ["About you", "Home", "Travel", "Food and shopping", "Digital"] as const;

function loadSaved(): Answers | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_ANSWERS, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function EstimateWizard() {
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [step, setStep] = useState(0);
  const done = step >= STEPS.length;

  useEffect(() => {
    const saved = loadSaved();
    if (saved) setAnswers(saved);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // Storage can be unavailable (private mode); the form still works.
    }
  }, [answers]);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setAnswers((a) => ({ ...a, [key]: value }));
  const scopeWord = answers.scope === "household" ? "your household" : "you";

  if (done) {
    return <Results footprint={computeFootprint(answers)} answers={answers} onEdit={() => setStep(0)} />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-8 flex flex-wrap gap-2 text-sm" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full px-3 py-1 ${
                i === step ? "bg-accent text-white" : i < step ? "bg-accent-soft text-accent" : "bg-card text-muted"
              }`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <h2 className="mb-6 text-2xl font-semibold tracking-tight">{STEPS[step]}</h2>

      <div className="space-y-8">
        {step === 0 && (
          <>
            <Field label="Who is this estimate for?">
              <Choice
                value={answers.scope}
                onChange={(v) => set("scope", v)}
                options={[
                  { value: "individual", label: "Just me", hint: "Your share of home energy" },
                  { value: "household", label: "My household", hint: "Everyone you live with" },
                ]}
              />
            </Field>
            <Field label="How many people live in your home?">
              <NumberInput
                label="People in your home"
                min={1}
                value={answers.householdSize}
                onChange={(n) => set("householdSize", Math.max(1, Math.round(n ?? 1)))}
              />
            </Field>
            <Field label="Which state do you live in?" hint="Your state's power grid sets how clean your electricity is.">
              <Select
                label="State"
                value={answers.state}
                onChange={(v) => set("state", v as StateCode)}
                options={STATE_OPTIONS.map((s) => ({ value: s.code, label: s.name }))}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Your electricity use" hint="A recent bill gives a better number. Otherwise we use your state's average.">
              <Choice
                value={answers.electricity.mode}
                onChange={(mode) => set("electricity", { ...answers.electricity, mode })}
                options={[
                  { value: "average", label: "Use my state's average" },
                  { value: "bill", label: "I know my monthly bill" },
                  { value: "kwh", label: "I know my monthly kWh" },
                ]}
              />
              {answers.electricity.mode !== "average" && (
                <div className="mt-3">
                  <NumberInput
                    label={answers.electricity.mode === "bill" ? "Monthly electricity bill" : "Monthly electricity use"}
                    prefix={answers.electricity.mode === "bill" ? "$" : undefined}
                    suffix={answers.electricity.mode === "kwh" ? "kWh a month" : "a month"}
                    value={answers.electricity.amount}
                    onChange={(amount) => set("electricity", { ...answers.electricity, amount })}
                  />
                </div>
              )}
            </Field>
            <Field label="How is your home heated?">
              <Choice
                value={answers.heating.fuel}
                onChange={(fuel) => set("heating", { ...answers.heating, fuel })}
                options={[
                  { value: "gas", label: "Natural gas" },
                  { value: "electric", label: "Electric or heat pump" },
                  { value: "oil", label: "Heating oil" },
                  { value: "propane", label: "Propane" },
                  { value: "none", label: "No heating" },
                ]}
              />
            </Field>
            {["gas", "oil", "propane"].includes(answers.heating.fuel) && (
              <Field label="Your heating fuel bill" hint="Average it over the year if you can, since winter bills run high.">
                <Choice
                  value={answers.heating.mode}
                  onChange={(mode) => set("heating", { ...answers.heating, mode })}
                  options={[
                    { value: "average", label: "Use a typical home" },
                    { value: "bill", label: "I know my monthly bill" },
                  ]}
                />
                {answers.heating.mode === "bill" && (
                  <div className="mt-3">
                    <NumberInput
                      label="Monthly heating bill"
                      prefix="$"
                      suffix="a month"
                      value={answers.heating.billAmount}
                      onChange={(billAmount) => set("heating", { ...answers.heating, billAmount })}
                    />
                  </div>
                )}
              </Field>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Field label={`What kind of car does ${scopeWord} drive most?`}>
              <Choice
                value={answers.car.type}
                onChange={(type) => set("car", { ...answers.car, type })}
                options={[
                  { value: "gas", label: "Gas" },
                  { value: "hybrid", label: "Hybrid" },
                  { value: "electric", label: "Electric" },
                  { value: "none", label: "No car" },
                ]}
              />
            </Field>
            {answers.car.type !== "none" && (
              <>
                <Field label="Miles driven in a typical week">
                  <NumberInput
                    label="Miles a week"
                    suffix="miles a week"
                    value={answers.car.milesPerWeek}
                    onChange={(n) => set("car", { ...answers.car, milesPerWeek: n ?? 0 })}
                  />
                </Field>
                {answers.car.type !== "electric" ? (
                  <Field label="Fuel economy" hint="Leave blank if you're not sure.">
                    <NumberInput
                      label="Miles per gallon"
                      suffix="mpg"
                      value={answers.car.mpg}
                      onChange={(mpg) => set("car", { ...answers.car, mpg })}
                    />
                  </Field>
                ) : (
                  <Field label="Where do you charge it?">
                    <Choice
                      value={answers.car.chargedAtHome ? "home" : "away"}
                      onChange={(v) => set("car", { ...answers.car, chargedAtHome: v === "home" })}
                      options={[
                        { value: "home", label: "Mostly at home" },
                        { value: "away", label: "Mostly elsewhere" },
                      ]}
                    />
                  </Field>
                )}
              </>
            )}
            <Field
              label="Round-trip flights in a typical year"
              hint={answers.scope === "household" ? "Count each traveler's trip separately." : undefined}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberInput
                  label="Short round trips a year"
                  suffix="short (under 3 hours)"
                  value={answers.flights.shortPerYear}
                  onChange={(n) => set("flights", { ...answers.flights, shortPerYear: n ?? 0 })}
                />
                <NumberInput
                  label="Long round trips a year"
                  suffix="long"
                  value={answers.flights.longPerYear}
                  onChange={(n) => set("flights", { ...answers.flights, longPerYear: n ?? 0 })}
                />
              </div>
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Which best describes your diet?">
              <Choice
                value={answers.diet}
                onChange={(v) => set("diet", v)}
                options={[
                  { value: "meat-heavy", label: "Meat at most meals" },
                  { value: "average", label: "Some meat" },
                  { value: "vegetarian", label: "Vegetarian" },
                  { value: "vegan", label: "Vegan" },
                ]}
              />
            </Field>
            <Field label="How much do you buy?" hint="Clothes, electronics, furniture, eating out and other services.">
              <Choice
                value={answers.shopping}
                onChange={(v) => set("shopping", v)}
                options={[
                  { value: "low", label: "Less than most people" },
                  { value: "average", label: "About average" },
                  { value: "high", label: "More than most people" },
                ]}
              />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <AiExportUpload
              onResult={(s) =>
                set("digital", {
                  ...answers.digital,
                  aiPromptsPerDay: Math.round(s.promptsPerDay * 10) / 10,
                  aiFromExport: true,
                })
              }
            />
            <Field label="AI chatbot prompts a day" hint="ChatGPT, Claude, Gemini and similar.">
              <NumberInput
                label="AI prompts a day"
                suffix="prompts a day"
                value={answers.digital.aiPromptsPerDay}
                onChange={(n) => set("digital", { ...answers.digital, aiPromptsPerDay: n ?? 0, aiFromExport: false })}
              />
            </Field>
            <Field label="AI images or videos made a week">
              <NumberInput
                label="AI images or videos a week"
                suffix="a week"
                value={answers.digital.aiMediaPerWeek}
                onChange={(n) => set("digital", { ...answers.digital, aiMediaPerWeek: n ?? 0 })}
              />
            </Field>
            <Field label="Hours of video streaming a day">
              <NumberInput
                label="Streaming hours a day"
                step={0.5}
                suffix="hours a day"
                value={answers.digital.streamingHoursPerDay}
                onChange={(n) => set("digital", { ...answers.digital, streamingHoursPerDay: n ?? 0 })}
              />
            </Field>
          </>
        )}
      </div>

      <div className="mt-10 flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="rounded-lg px-4 py-2 font-medium text-muted hover:text-foreground disabled:invisible"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep((s) => s + 1)}
          className="rounded-lg bg-accent px-5 py-2 font-medium text-white hover:bg-accent-strong"
        >
          {step === STEPS.length - 1 ? "See my footprint" : "Next"}
        </button>
      </div>
    </div>
  );
}
