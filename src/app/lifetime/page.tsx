import type { Metadata } from "next";
import Link from "next/link";
import { LifetimeOffset } from "@/components/LifetimeOffset";

export const metadata: Metadata = { title: "Offset your lifetime internet and AI use | Offset" };

export default function LifetimePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Offset your lifetime of internet and AI use, once.
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Every video, search and chatbot prompt runs on data centers that use power and water. Cover everything you&apos;ve
        done online and everything you will, with one payment and a badge for life.
      </p>
      <div className="mt-10">
        <LifetimeOffset />
      </div>
      <p className="mt-10 text-sm text-muted">
        Your devices&apos; own power is part of your home electricity. See{" "}
        <Link href="/method" className="text-accent hover:underline">
          how we calculate
        </Link>
        .
      </p>
    </div>
  );
}
