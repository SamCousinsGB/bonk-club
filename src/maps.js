// Distinct layouts use the same world scale and movement rules.
export const COVER_KINDS = [
  "car",
  "table",
  "crate",
  "log",
  "stone",
  "sofa",
  "bed",
  "cabinet",
  "barrel",
  "canister",
  "waterTank",
  "oilBarrel", "glueBarrel", "tarBarrel",

  "trolley",
  "generator",
  "planter",
  "pallet",
];
export const breakable = (p) =>
  p && (p.destructible === true || COVER_KINDS.includes(p.kind));
