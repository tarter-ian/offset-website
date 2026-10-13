import type { Metadata } from "next";
import { Suspense } from "react";
import { StopReminders } from "@/components/StopReminders";

export const metadata: Metadata = { title: "Stop monthly emails | My Offset" };

export default function StopRemindersPage() {
  return (
    <article className="mx-auto max-w-xl px-4 py-12">
      <h1 className="border-t-4 border-rule pt-4 text-3xl font-extrabold [font-stretch:85%]">Stop the monthly emails</h1>
      <p className="mt-3 text-muted">You won&apos;t hear from me when a month is ready. Your account and what you&apos;ve covered stay as they are.</p>
      <Suspense>
        <StopReminders />
      </Suspense>
    </article>
  );
}
