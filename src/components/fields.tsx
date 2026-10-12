"use client";

import type { ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="block">
      <legend className="block font-medium">{label}</legend>
      {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-accent";

export function NumberInput({
  value,
  onChange,
  min = 0,
  step = 1,
  prefix,
  suffix,
  label,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  min?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {prefix && <span className="text-muted">{prefix}</span>}
      <input
        type="number"
        aria-label={label}
        inputMode="decimal"
        min={min}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className={`${inputClass} max-w-40`}
      />
      {suffix && <span className="text-muted">{suffix}</span>}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** A row of buttons for picking one of a few options. */
export function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-4 py-3 text-left ${
              selected ? "border-accent bg-accent-soft" : "border-border bg-card hover:border-accent"
            }`}
          >
            <span className="block font-medium">{o.label}</span>
            {o.hint && <span className="block text-sm text-muted">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
