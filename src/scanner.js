import { playerBox, segmentBox } from "./collision.js";

export const isScanner = h => h.type === "xray" || h.type === "magnet";

// A brief double exposure, followed by a clear view of the normal fighter.
// Use the shared simulation time so host and guest show the same pulse.
export function scannerFlicker(time, id) {
  const phase = ((time * 3.5 + id * .17) % 1 + 1) % 1;
  return phase < .22 || (phase > .38 && phase < .5);
}

export function scanFighters(world, h, zone, solids) {
  for (const p of world.players) {
    if (!p.alive) continue;
    const b = playerBox(p);
    if (b.x + b.w <= zone.x || b.x >= zone.x + zone.w ||
        b.y + b.h <= zone.y || b.y >= zone.y + zone.h ||
        solids.some(s => segmentBox(h.x, h.y - 3, p.x, p.y, s))) continue;
    // Do not replace a stronger weapon's ongoing electrical exposure.
    if (!p.xray || p.xrayType === "scanner") {
      p.xray = .12;
      p.xrayType = "scanner";
    }
    if (h.hitIds.includes(p.id)) continue;
    h.hitIds.push(p.id);
    // Scanning barely hurts and must not interrupt walking, parrying or jumping.
    p.hp = Math.max(0, p.hp - 1);
    if (!p.hp) world.kill(p, {cause: "xray", effect: "tesla", ash: true});
  }
}
