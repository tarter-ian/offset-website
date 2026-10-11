// Per-state inputs for the electricity estimate.
//
// gridLbPerMwh: total output CO2e emission rate, EPA eGRID2023 summary tables
//   https://www.epa.gov/egrid/summary-data
// avgKwhPerMonth, priceCentsPerKwh: residential averages, EIA 2024 Table 5.A
//   https://www.eia.gov/electricity/sales_revenue_price/
//
// Re-check these against the source tables before launch.

export type StateCode = keyof typeof STATES;

export interface StateData {
  name: string;
  gridLbPerMwh: number;
  avgKwhPerMonth: number;
  priceCentsPerKwh: number;
}

export const STATES = {
  AL: { name: "Alabama", gridLbPerMwh: 714.0, avgKwhPerMonth: 1143, priceCentsPerKwh: 15.18 },
  AK: { name: "Alaska", gridLbPerMwh: 814.5, avgKwhPerMonth: 578, priceCentsPerKwh: 24.82 },
  AZ: { name: "Arizona", gridLbPerMwh: 689.1, avgKwhPerMonth: 1075, priceCentsPerKwh: 14.91 },
  AR: { name: "Arkansas", gridLbPerMwh: 998.4, avgKwhPerMonth: 1048, priceCentsPerKwh: 12.32 },
  CA: { name: "California", gridLbPerMwh: 394.8, avgKwhPerMonth: 503, priceCentsPerKwh: 31.97 },
  CO: { name: "Colorado", gridLbPerMwh: 1091.1, avgKwhPerMonth: 674, priceCentsPerKwh: 14.92 },
  CT: { name: "Connecticut", gridLbPerMwh: 540.7, avgKwhPerMonth: 695, priceCentsPerKwh: 28.75 },
  DE: { name: "Delaware", gridLbPerMwh: 704.2, avgKwhPerMonth: 911, priceCentsPerKwh: 16.57 },
  DC: { name: "District of Columbia", gridLbPerMwh: 395.0, avgKwhPerMonth: 639, priceCentsPerKwh: 17.71 },
  FL: { name: "Florida", gridLbPerMwh: 789.1, avgKwhPerMonth: 1104, priceCentsPerKwh: 14.14 },
  GA: { name: "Georgia", gridLbPerMwh: 717.4, avgKwhPerMonth: 1074, priceCentsPerKwh: 14.08 },
  HI: { name: "Hawaii", gridLbPerMwh: 1394.7, avgKwhPerMonth: 495, priceCentsPerKwh: 42.86 },
  ID: { name: "Idaho", gridLbPerMwh: 313.9, avgKwhPerMonth: 944, priceCentsPerKwh: 11.52 },
  IL: { name: "Illinois", gridLbPerMwh: 474.4, avgKwhPerMonth: 693, priceCentsPerKwh: 15.87 },
  IN: { name: "Indiana", gridLbPerMwh: 1465.5, avgKwhPerMonth: 901, priceCentsPerKwh: 14.77 },
  IA: { name: "Iowa", gridLbPerMwh: 634.2, avgKwhPerMonth: 832, priceCentsPerKwh: 13.4 },
  KS: { name: "Kansas", gridLbPerMwh: 733.3, avgKwhPerMonth: 876, priceCentsPerKwh: 14.15 },
  KY: { name: "Kentucky", gridLbPerMwh: 1747.0, avgKwhPerMonth: 1047, priceCentsPerKwh: 12.79 },
  LA: { name: "Louisiana", gridLbPerMwh: 763.1, avgKwhPerMonth: 1202, priceCentsPerKwh: 11.73 },
  ME: { name: "Maine", gridLbPerMwh: 316.8, avgKwhPerMonth: 550, priceCentsPerKwh: 24.29 },
  MD: { name: "Maryland", gridLbPerMwh: 522.2, avgKwhPerMonth: 929, priceCentsPerKwh: 17.86 },
  MA: { name: "Massachusetts", gridLbPerMwh: 830.1, avgKwhPerMonth: 570, priceCentsPerKwh: 29.35 },
  MI: { name: "Michigan", gridLbPerMwh: 797.4, avgKwhPerMonth: 618, priceCentsPerKwh: 19.3 },
  MN: { name: "Minnesota", gridLbPerMwh: 752.3, avgKwhPerMonth: 712, priceCentsPerKwh: 15.45 },
  MS: { name: "Mississippi", gridLbPerMwh: 828.3, avgKwhPerMonth: 1156, priceCentsPerKwh: 13.39 },
  MO: { name: "Missouri", gridLbPerMwh: 1454.6, avgKwhPerMonth: 1001, priceCentsPerKwh: 12.91 },
  MT: { name: "Montana", gridLbPerMwh: 1063.9, avgKwhPerMonth: 852, priceCentsPerKwh: 12.66 },
  NE: { name: "Nebraska", gridLbPerMwh: 1025.8, avgKwhPerMonth: 956, priceCentsPerKwh: 11.53 },
  NV: { name: "Nevada", gridLbPerMwh: 643.9, avgKwhPerMonth: 930, priceCentsPerKwh: 15.0 },
  NH: { name: "New Hampshire", gridLbPerMwh: 276.2, avgKwhPerMonth: 619, priceCentsPerKwh: 23.4 },
  NJ: { name: "New Jersey", gridLbPerMwh: 470.2, avgKwhPerMonth: 662, priceCentsPerKwh: 19.34 },
  NM: { name: "New Mexico", gridLbPerMwh: 773.6, avgKwhPerMonth: 654, priceCentsPerKwh: 14.2 },
  NY: { name: "New York", gridLbPerMwh: 466.6, avgKwhPerMonth: 571, priceCentsPerKwh: 24.43 },
  NC: { name: "North Carolina", gridLbPerMwh: 626.4, avgKwhPerMonth: 1015, priceCentsPerKwh: 14.13 },
  ND: { name: "North Dakota", gridLbPerMwh: 1297.9, avgKwhPerMonth: 1029, priceCentsPerKwh: 11.51 },
  OH: { name: "Ohio", gridLbPerMwh: 1068.3, avgKwhPerMonth: 846, priceCentsPerKwh: 15.99 },
  OK: { name: "Oklahoma", gridLbPerMwh: 648.8, avgKwhPerMonth: 1079, priceCentsPerKwh: 12.24 },
  OR: { name: "Oregon", gridLbPerMwh: 365.0, avgKwhPerMonth: 882, priceCentsPerKwh: 14.7 },
  PA: { name: "Pennsylvania", gridLbPerMwh: 647.9, avgKwhPerMonth: 817, priceCentsPerKwh: 17.77 },
  RI: { name: "Rhode Island", gridLbPerMwh: 840.0, avgKwhPerMonth: 567, priceCentsPerKwh: 28.65 },
  SC: { name: "South Carolina", gridLbPerMwh: 560.4, avgKwhPerMonth: 1050, priceCentsPerKwh: 14.23 },
  SD: { name: "South Dakota", gridLbPerMwh: 335.6, avgKwhPerMonth: 994, priceCentsPerKwh: 12.86 },
  TN: { name: "Tennessee", gridLbPerMwh: 661.2, avgKwhPerMonth: 1154, priceCentsPerKwh: 12.42 },
  TX: { name: "Texas", gridLbPerMwh: 771.2, avgKwhPerMonth: 1096, priceCentsPerKwh: 14.94 },
  UT: { name: "Utah", gridLbPerMwh: 1421.2, avgKwhPerMonth: 774, priceCentsPerKwh: 12.22 },
  VT: { name: "Vermont", gridLbPerMwh: 52.2, avgKwhPerMonth: 574, priceCentsPerKwh: 21.9 },
  VA: { name: "Virginia", gridLbPerMwh: 539.6, avgKwhPerMonth: 1032, priceCentsPerKwh: 14.41 },
  WA: { name: "Washington", gridLbPerMwh: 266.6, avgKwhPerMonth: 955, priceCentsPerKwh: 11.9 },
  WV: { name: "West Virginia", gridLbPerMwh: 1968.9, avgKwhPerMonth: 1027, priceCentsPerKwh: 15.07 },
  WI: { name: "Wisconsin", gridLbPerMwh: 1163.6, avgKwhPerMonth: 645, priceCentsPerKwh: 17.18 },
  WY: { name: "Wyoming", gridLbPerMwh: 1833.3, avgKwhPerMonth: 863, priceCentsPerKwh: 12.47 },
} satisfies Record<string, StateData>;

export const STATE_OPTIONS = (Object.keys(STATES) as StateCode[])
  .map((code) => ({ code, name: STATES[code].name }))
  .sort((a, b) => a.name.localeCompare(b.name));
