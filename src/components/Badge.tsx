/** A round "Fully Offset" badge, for the whole footprint or one area or item. */
export function Badge({ area, detail, size = "md" }: { area?: string; detail?: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-24 w-24 text-[10px]" : "h-28 w-28 text-xs";
  return (
    <div
      className={`flex ${dims} shrink-0 flex-col items-center justify-center rounded-full border-4 bg-card px-2 text-center font-semibold uppercase leading-tight ${
        area ? "border-accent/60 text-accent" : "border-accent text-accent"
      }`}
      title={detail ? `Covers ${detail}` : undefined}
    >
      <span>{detail ? "Offset" : "Fully Offset"}</span>
      {area && <span className="mt-0.5 normal-case">{area}</span>}
      {detail && <span className="mt-0.5 font-normal normal-case text-muted">{detail}</span>}
    </div>
  );
}
