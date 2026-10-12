import type { Metadata } from "next";
import { GiftMaker } from "@/components/Gift";

export const metadata: Metadata = { title: "Give an offset | My Offset" };

export default function GiftPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="border-t-4 border-rule pt-4 text-3xl font-extrabold [font-stretch:85%]">Give an offset</h1>
      <p className="mt-3 text-muted">
        Cover one thing for someone else, like their AI use for life or a year of driving, at typical use. You get a link to send them.
      </p>
      <GiftMaker />
    </article>
  );
}
