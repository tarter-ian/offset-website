/** A round "Fully Offset" badge, for the whole footprint or one category. */
export function Badge({ area, size = "md" }: { area?: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-20 w-20 text-[10px]" : "h-24 w-24 text-xs";
  return (
    <div
      className={`flex ${dims} shrink-0 flex-col items-center justify-center rounded-full border-4 bg-card px-2 text-center font-semibold uppercase leading-tight ${
        area ? "border-accent/60 text-accent" : "border-accent text-accent"
      }`}
    >
      <span>Fully</span>
      <span>Offset</span>
      {area && <span className="mt-0.5 normal-case">{area}</span>}
    </div>
  );
}
