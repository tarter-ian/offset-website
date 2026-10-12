import type { Metadata } from "next";
import { ReturnFromEvery } from "@/components/ReturnFromEvery";

export const metadata: Metadata = { title: "Your gifts | My Offset", robots: { index: false } };

export default function CheckoutReturnPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <ReturnFromEvery />
    </article>
  );
}
