// Placeholder prices, to set before launch.

/** Donation per tonne of CO2e offset, passed through to charities. */
export const DONATION_PER_TONNE_USD = 15;

/** Monthly service fee, kept by the site. */
export const SERVICE_FEE_USD = 4;

export interface MonthlyCost {
  donation: number;
  fee: number;
  total: number;
}

export function monthlyCost(offsetKg: number): MonthlyCost {
  const donation = Math.round((offsetKg / 1000) * DONATION_PER_TONNE_USD * 100) / 100;
  return { donation, fee: SERVICE_FEE_USD, total: donation + SERVICE_FEE_USD };
}

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
