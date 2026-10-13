import { describe, expect, it } from "vitest";
import { arrivedAndFees, type MonthTotal } from "./ledgerLive";

const rows: MonthTotal[] = [
  { month: "2026-10", slug: "catf", gifts: 2, usd: 10.6, net: 10 },
  { month: "2026-09", slug: "catf", gifts: 1, usd: 5.42, net: 5 },
  { month: "2026-10", slug: "water", gifts: 1, usd: 1.32, net: 1 },
];

describe("arrivedAndFees", () => {
  it("splits what arrived from card fees for one charity", () => expect(arrivedAndFees(rows, "catf")).toEqual({ arrived: 15, fees: 1.02 }));
  it("adds up every charity", () => expect(arrivedAndFees(rows)).toEqual({ arrived: 16, fees: 1.34 }));
  it("is zero with nothing confirmed", () => expect(arrivedAndFees([])).toEqual({ arrived: 0, fees: 0 }));
});
