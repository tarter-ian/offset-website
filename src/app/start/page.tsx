import type { Metadata } from "next";
import { ConnectAccounts } from "@/components/ConnectAccounts";

export const metadata: Metadata = { title: "Link your accounts | Offset" };

export default function StartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <ConnectAccounts />
    </div>
  );
}
