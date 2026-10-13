"use client";

import Link from "next/link";
import { useState } from "react";

export function StopReminders() {
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  async function stop() {
    setState("busy");
    const token = new URLSearchParams(window.location.search).get("t") ?? "";
    try {
      const r = await fetch("/api/reminders/stop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const d = (await r.json()) as { stopped?: boolean; error?: string };
      setState(d.stopped ? "done" : (d.error ?? "Something went wrong."));
    } catch {
      setState("Couldn't reach My Offset. Try again in a minute.");
    }
  }
  if (state === "done")
    return (
      <p className="mt-6" role="status">
        Done. No more monthly emails. You can turn them back on from <Link href="/record" className="underline underline-offset-4">your record</Link>.
      </p>
    );
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={stop}
        disabled={state === "busy"}
        className="min-h-11 cursor-pointer rounded-md border-2 border-rule px-5 font-semibold hover:bg-foreground hover:text-background disabled:opacity-60"
      >
        Stop these emails
      </button>
      {state !== "idle" && state !== "busy" && (
        <p role="alert" className="mt-3 text-danger">
          {state}
        </p>
      )}
    </div>
  );
}
