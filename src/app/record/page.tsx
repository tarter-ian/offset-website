import type { Metadata } from "next";
import { Record } from "@/components/Record";

export const metadata: Metadata = { title: "Your record | My Offset" };

export default function RecordPage() {
  return (
    <div className="mx-auto max-w-4xl px-4">
      <Record />
    </div>
  );
}
