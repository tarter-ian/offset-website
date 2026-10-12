import type { Metadata } from "next";
import { ListEdit } from "@/components/ListEdit";

export const metadata: Metadata = { title: "Your listing | My Offset", robots: { index: false } };

export default function ListEditPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Your listing</h1>
      <ListEdit />
    </main>
  );
}
