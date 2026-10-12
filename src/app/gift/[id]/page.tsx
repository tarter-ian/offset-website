import type { Metadata } from "next";
import { GiftView } from "@/components/Gift";

export const metadata: Metadata = { title: "A gift | My Offset", robots: { index: false } };

export default async function GiftLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <GiftView id={id} />
    </article>
  );
}
