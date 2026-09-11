// Shared identities for physical containers, their contents and their artwork.
export const SPILLS = {
  oil: { color: "#423f32", rim: "#b5a568", flow: 1.4, life: 35, burn: 7 },
  glue: { color: "#d3dba0", rim: "#fbffd0", flow: .35, life: 24, burn: 0 },
  tar: { color: "#27222e", rim: "#826782", flow: .6, life: 40, burn: 11 },
};
export const BARRELS = {
  barrel: { label: "TNT", color: "#b74732", rim: "#ffc28b" },
  canister: { label: "GAS", color: "#c27430", rim: "#ffce83" },
  oilBarrel: { label: "OIL", color: "#5a6370", rim: "#bac5d2", contents: "oil" },
  glueBarrel: { label: "GLUE", color: "#709749", rim: "#d1ef9c", contents: "glue" },
  tarBarrel: { label: "TAR", color: "#6e497e", rim: "#d4a6df", contents: "tar" },
};
export const explosiveBarrel = b => !b.chunk && (b.kind === "barrel" || b.kind === "canister");
export const SPILL_LIMIT = 96;

// The whole casing pulses, with an accelerating 3-2-1 countdown painted on it.
// Frozen containers retain the countdown but do not continue pulsing.
export function barrelWarning(p) {
  if (!explosiveBarrel(p) || !p.leak || p.spent) return { pulse: 0, swell: 1, count: 0 };
  const fuse = Math.max(0, p.fuse || 0), urgency = 1 - Math.min(1, fuse / 4.2);
  const phase = (4.2 - fuse) * 8 + urgency * urgency * 25;
  const pulse = p.cold > 0 ? 0 : Math.pow((1 + Math.sin(phase)) / 2, 3);
  return { pulse, swell: 1 + pulse * (.025 + urgency * .055), count: Math.max(1, Math.ceil(fuse)) };
}
