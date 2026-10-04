// Shared identities for physical containers, their contents and their artwork.
export const SPILLS = {
  molten: { color: "#ff842b", rim: "#fff1b0", flow: .8, life: 3600, burn: 0 },
  oil: { color: "#423f32", rim: "#b5a568", flow: 1.4, life: 35, burn: 7 },
  petrol: { color: "#bc8735", rim: "#ffe1a0", flow: 1.9, life: 30, burn: 9 },
  glue: { color: "#d3dba0", rim: "#fbffd0", flow: .35, life: 24, burn: 0 },
  tar: { color: "#27222e", rim: "#826782", flow: .6, life: 40, burn: 11 },
  acid: { color: "#769c26", rim: "#deee70", flow: 1.05, life: 28, burn: 0 },
  coolant: { color: "#398ab0", rim: "#b7f5ff", flow: 1.2, life: 16, burn: 0 },
};
export const BARRELS = {
  barrel: { label: "TNT", color: "#b74732", rim: "#ffc28b" },
  canister: { label: "GAS", color: "#c27430", rim: "#ffce83" },
  oilBarrel: { label: "OIL", color: "#5a6370", rim: "#bac5d2", contents: "oil" },
  glueBarrel: { label: "GLUE", color: "#709749", rim: "#d1ef9c", contents: "glue" },
  tarBarrel: { label: "TAR", color: "#6e497e", rim: "#d4a6df", contents: "tar" },
  acidBarrel: { label: "ACID", color: "#6b813b", rim: "#d5e99b", contents: "acid" },
  coolantBarrel: { label: "CRYO", color: "#376e92", rim: "#b7eafa", contents: "coolant" },
};
// Size comes from the same physical casing transported to guests.
export const gasScale = b => Math.max(1,Math.min(3,Math.sqrt(b.w*b.h/(44*72))));
export const gasBlastRadius = b => Math.min(320,185*Math.sqrt(gasScale(b)));
export const explosiveBarrel = b => !b.chunk && (b.kind === "barrel" || b.kind === "canister");
export const SPILL_LIMIT = 384;

// The whole casing pulses, with an accelerating 3-2-1 countdown painted on it.
// Frozen containers retain the countdown but do not continue pulsing.
export function barrelWarning(p) {
  if (!explosiveBarrel(p) || !p.leak || p.spent) return { pulse: 0, swell: 1, count: 0 };
  const fuse = Math.max(0, p.fuse || 0), urgency = 1 - Math.min(1, fuse / 4.2);
  const phase = (4.2 - fuse) * 8 + urgency * urgency * 25;
  const pulse = p.cold > 0 ? 0 : Math.pow((1 + Math.sin(phase)) / 2, 3);
  return { pulse, swell: 1 + pulse * (.025 + urgency * .055), count: Math.max(1, Math.ceil(fuse)) };
}
