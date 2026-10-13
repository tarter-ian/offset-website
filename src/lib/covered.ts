/** Where the store keeps the plan in this browser. v2: covers replaced spans, so older saved plans are ignored. */
export const STORAGE_KEY = "offset:plan:v2";

/**
 * An item already paid for: for life, or until a date for a month or year. Set once payments go through.
 */
export type Covered = ({ kind: "life" } | { kind: "period"; until: string }) & {
  /** When it was first covered, for the record page. Missing on covers saved before 2026-10-12. */
  since?: string;
  /** Who gave it, when it came as a gift. */
  giftFrom?: string;
  /** Whether past use was paid for too. Missing on covers saved before 2026-10-13 and on gifts. */
  past?: boolean;
  /**
   * Set when the gift that paid for a month or year repeats on Every.org's autopay, with how
   * often: it renews on its own, so it never comes due here or by email (Ian, 2026-10-13).
   */
  autopay?: "monthly" | "annual";
};
