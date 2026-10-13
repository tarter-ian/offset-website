import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { parseShare, shareLines, shareQuery } from "@/lib/share";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "My AI use this month | My Offset";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const totals = parseShare(await searchParams);
  const lines = shareLines(totals);
  // Link previews need a full address for the image.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${proto}://${host}/share/og?${shareQuery(totals)}`;
  const description = `${lines.carbon} and ${lines.life} of healthy life lost to air pollution. See what your own AI use costs the planet, and cover it.`;
  return {
    title: TITLE,
    description,
    robots: { index: false },
    openGraph: { title: "My AI use this month", description, type: "website", images: [{ url: image, width: 1200, height: 630, alt: `My AI use this month: ${lines.carbon}, ${lines.life} of healthy life lost.` }] },
    twitter: { card: "summary_large_image", title: "My AI use this month", description, images: [image] },
  };
}

export default async function SharePage({ searchParams }: Props) {
  const lines = shareLines(parseShare(await searchParams));
  return (
    <article className="mx-auto max-w-xl px-4 py-12">
      <div className="border-t-4 border-rule pt-4">
        <p className="text-sm text-muted">Shared from My Offset</p>
        <h1 className="mt-1 text-3xl font-extrabold [font-stretch:85%]">My AI use this month</h1>
        <dl className="figures mt-4 divide-y divide-border border-y-2 border-rule text-lg">
          <div className="flex justify-between gap-4 py-2">
            <dt className="font-sans text-muted">Carbon</dt>
            <dd>{lines.carbon}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="font-sans text-muted">Healthy life lost</dt>
            <dd>{lines.life}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted">
          Includes a share of training the models and building the data centers, and the AI built into search and other apps. Air
          pollution&apos;s harm is shared across everyone who breathes it.{" "}
          <Link href="/method" className="underline hover:text-foreground">
            How it&apos;s calculated
          </Link>
        </p>
      </div>
      <p className="mt-8 text-lg">
        <Link href="/" className="font-semibold underline underline-offset-4">
          See what your own AI use costs
        </Link>
      </p>
    </article>
  );
}
