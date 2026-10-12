import { ImageResponse } from "next/og";
import { parseShare, shareLines } from "@/lib/share";

// The share card, drawn as a receipt: black ink on white, thin rules, one total.
// Numbers come only from the query, checked and clamped in parseShare.

const INK = "#121613";
const MUTED = "#555e57";
const PAPER = "#ffffff";

export function GET(request: Request) {
  const totals = parseShare(new URL(request.url).searchParams);
  const lines = shareLines(totals);
  // The bundled font has no subscript two.
  const carbon = lines.carbon.replace("CO₂e", "CO2e");

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "18px 0", borderBottom: `2px solid ${INK}` }}>
      <span style={{ fontSize: 38, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 56, color: INK }}>{value}</span>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#e9ece9", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1000, display: "flex", flexDirection: "column", background: PAPER, padding: "40px 64px", borderTop: `10px solid ${INK}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 30, color: INK, letterSpacing: 1 }}>MY OFFSET</span>
            <span style={{ fontSize: 26, color: MUTED }}>Receipt</span>
          </div>
          <div style={{ display: "flex", fontSize: 64, color: INK, marginTop: 24, paddingBottom: 18, borderBottom: `4px solid ${INK}` }}>
            My AI use this month
          </div>
          {row("Carbon", carbon)}
          {row("Healthy life lost", lines.life)}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 26 }}>
            <span style={{ fontSize: 34, color: INK }}>Covering it with My Offset</span>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 10 }}>Air pollution is shared across everyone who breathes it.</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
