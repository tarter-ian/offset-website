// Example charities so the results page has something to show.
// The real list is chosen and vetted before launch (plan step 4).

export interface Charity {
  name: string;
  url: string;
  focus: string;
  /** Share of each donation, 0 to 1. Shares add up to 1. */
  share: number;
}

export const CHARITIES: Charity[] = [
  {
    name: "Clean Air Task Force",
    url: "https://www.catf.us/",
    focus: "Policy and technology to cut emissions at scale",
    share: 0.4,
  },
  {
    name: "Rainforest Trust",
    url: "https://www.rainforesttrust.org/",
    focus: "Protecting tropical forests that store carbon",
    share: 0.35,
  },
  {
    name: "Good Food Institute",
    url: "https://gfi.org/",
    focus: "Lower-emission alternatives to animal protein",
    share: 0.25,
  },
];
