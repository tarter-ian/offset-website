import type { ImpactKey } from "./footprint";

// The public record of every donation made through the site, one entry per
// charity per month, with the donation partner's receipt. Empty until launch.

export interface LedgerEntry {
  /** Month the donations were made, as "2027-01". */
  month: string;
  /** The kind of harm the charity works on, or "removal" for certified carbon removal. */
  cause: ImpactKey | "removal";
  charity: string;
  usd: number;
  /** Link to the partner's receipt or grant record. */
  receipt: string;
}

export const LEDGER: LedgerEntry[] = [];
