import type { ImpactKey } from "./footprint";

// Example charities for each kind of impact, so the results page has something
// to show. The real list is chosen and vetted before launch (plan step 4).

export interface Charity {
  name: string;
  url: string;
  focus: string;
}

export const CHARITIES: Record<ImpactKey, Charity> = {
  carbon: {
    name: "Clean Air Task Force",
    url: "https://www.catf.us/",
    focus: "Policy and technology to cut emissions at scale",
  },
  air: {
    name: "American Lung Association",
    url: "https://www.lung.org/",
    focus: "Campaigns for cleaner air and healthier lungs",
  },
  water: {
    name: "Bonneville Environmental Foundation",
    url: "https://www.b-e-f.org/",
    focus: "Restores water to rivers and streams",
  },
  land: {
    name: "Rainforest Trust",
    url: "https://www.rainforesttrust.org/",
    focus: "Buys and protects threatened tropical forest",
  },
  ewaste: {
    name: "Human-I-T",
    url: "https://www.human-i-t.org/",
    focus: "Refurbishes donated devices for low-income families and recycles the rest responsibly",
  },
};

/** Where the measured-removal part of a climate donation goes. */
export const CARBON_REMOVAL: Charity = {
  name: "Certified biochar removal (Puro.earth)",
  url: "https://puro.earth/",
  focus: "Carbon locked away in biochar, measured and registered per tonne",
};
