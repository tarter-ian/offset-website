import type { CategoryKey } from "./footprint";

// Accounts people can link. Utility, bank and car linking go through the
// services named in `via`, which need developer keys set as environment
// variables (never committed). Until each is wired up, its button explains
// that linking opens at launch and the estimate uses averages instead.

export type ProviderId = "utility" | "bank" | "car" | "chatgpt" | "claude";

export interface Provider {
  id: ProviderId;
  name: string;
  /** What linking replaces in the estimate. */
  covers: CategoryKey[];
  blurb: string;
  /** The service that does the linking, and the env var that switches it on. */
  via?: { service: string; envKey: string };
  /** AI accounts link by uploading a data export instead. */
  export?: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: "utility",
    name: "Electric and gas utility",
    covers: ["electricity", "heating"],
    blurb: "Your real monthly usage, read-only.",
    via: { service: "UtilityAPI", envKey: "UTILITYAPI_TOKEN" },
  },
  {
    id: "bank",
    name: "Bank or card",
    covers: ["flights", "clothing", "electronics", "household", "services"],
    blurb: "Spending by category, read-only. We never see your login.",
    via: { service: "Plaid", envKey: "PLAID_SECRET" },
  },
  {
    id: "car",
    name: "Car",
    covers: ["car"],
    blurb: "Miles driven, from most cars made since 2015.",
    via: { service: "Smartcar", envKey: "SMARTCAR_CLIENT_SECRET" },
  },
  { id: "chatgpt", name: "ChatGPT", covers: ["ai"], blurb: "Count your prompts from your data export.", export: true },
  { id: "claude", name: "Claude", covers: ["ai"], blurb: "Count your prompts from your data export.", export: true },
];
