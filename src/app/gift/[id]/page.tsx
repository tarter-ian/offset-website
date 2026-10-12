import type { Metadata } from "next";
import { GiftView } from "@/components/Gift";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const image = `/gift/${encodeURIComponent(id)}/og`;
  return {
    title: "A gift | My Offset",
    robots: { index: false },
    openGraph: { title: "A gift from My Offset", description: "Someone covered part of your footprint.", type: "website", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function GiftLinkPage({ params }: Props) {
  const { id } = await params;
  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <GiftView id={id} />
    </article>
  );
}
