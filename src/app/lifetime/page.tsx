import type { Metadata } from "next";
import Link from "next/link";
import { LifetimeOffset } from "@/components/LifetimeOffset";
import { parseItems } from "@/lib/lifetime";

export const metadata: Metadata = { title: "Offset your lifetime online | Offset" };

export default async function LifetimePage({ searchParams }: { searchParams: Promise<{ cover?: string }> }) {
  const { cover } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Offset your lifetime online, once.
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Every video, chatbot prompt and phone you&apos;ve owned has a cost in power, water and pollution. Cover your
        internet use, your AI use, the devices you use them on, or all three, with one payment and a badge for life.
      </p>
      <div className="mt-10">
        <LifetimeOffset initialItems={parseItems(cover)} />
      </div>
      <p className="mt-10 text-sm text-muted">
        Not counted yet: water and land used to mine and make devices, e-waste, and building data centers. See{" "}
        <Link href="/method" className="text-accent hover:underline">
          how we calculate
        </Link>
        .
      </p>
    </div>
  );
}
