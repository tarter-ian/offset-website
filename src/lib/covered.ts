/** Where the store keeps the plan in this browser. v2: covers replaced spans, so older saved plans are ignored. */
export const STORAGE_KEY = "offset:plan:v2";

/**
 * An item already paid for: for life, or until a date for a month or year. Set once payments go through.
 */
export type Covered = ({ kind: "life" } | { kind: "period"; until: string }) & {
  /** Who gave it, when it came as a gift. */
  giftFrom?: string;
};
