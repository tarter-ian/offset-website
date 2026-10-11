import type { Metadata } from "next";
import { EstimateWizard } from "@/components/EstimateWizard";

export const metadata: Metadata = { title: "Your footprint estimate | Offset" };

export default function EstimatePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <EstimateWizard />
    </div>
  );
}
