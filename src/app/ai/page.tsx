import type { Metadata } from "next";
import { AiOffset } from "@/components/AiOffset";

export const metadata: Metadata = { title: "Offset your AI use | Offset" };

export default function AiPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mx-auto mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Offset your AI use</h1>
        <p className="mt-3 text-lg text-muted">
          Find out the carbon, water and air pollution behind your chatbot use, and cover just that each month.
        </p>
      </div>
      <AiOffset />
    </div>
  );
}
