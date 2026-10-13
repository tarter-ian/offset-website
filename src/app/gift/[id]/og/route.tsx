import { ImageResponse } from "next/og";
import { loadGift } from "@/lib/giftStore";
import { giftSentence, recipients } from "@/lib/gifts";

// The picture a texted gift link shows: a gift tag in the site's receipt style.
// Names come from the gift itself, which only someone with the link can load.

const INK = "#121613";
const MUTED = "#555e57";
const PAPER = "#ffffff";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await loadGift(id).catch(() => null);
  const from = found?.gift.from ?? "Someone";
  // One picture serves every card of a gift for several people, so it names none of them.
  const names = found ? recipients(found.gift) : [];
  const to = names.length === 1 ? names[0] : "you";
  const sentence = found ? giftSentence(found.gift.items) : "your footprint";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#e9ece9", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1000, display: "flex", flexDirection: "column", background: PAPER, padding: "44px 64px", borderTop: `10px solid ${INK}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 30, color: INK, letterSpacing: 1 }}>MY OFFSET</span>
            <span style={{ fontSize: 26, color: MUTED }}>A gift for {to}</span>
          </div>
          <div style={{ display: "flex", fontSize: 58, lineHeight: 1.15, color: INK, marginTop: 28, paddingBottom: 26, borderBottom: `4px solid ${INK}` }}>
            {`${from} covered ${sentence}.`.slice(0, 160)}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 22 }}>
            Paid to charities for the carbon, air, water, nature and e-waste behind it.
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "private, max-age=600" } },
  );
}
