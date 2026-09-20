import { dangerous, hazardZone } from "./hazards.js";

// Warning areas are already unsafe destinations: do not start a jump that ends
// inside a machine about to turn on. Scanners/loaders/belts are not kill zones.
const lethal = new Set(["geyser", "crusher", "pendulum", "saw", "tesla", "steam",
  "furnace", "slag", "powerline", "turbine", "airflow"]);
export function botDanger(hazards, x, y, padding = 18) {
  return hazards.some(h => {
    if (!lethal.has(h.type) || !dangerous(h)) return false;
    let z = hazardZone(h);
    // A raised press head's current contact box misses its imminent downstroke.
    if (h.type === "crusher" && !h.assemblyStation)
      z = {x:h.x-h.w/2, y:h.y-h.h, w:h.w, h:h.h};
    return x + padding > z.x && x - padding < z.x + z.w &&
      y + 30 > z.y && y - 28 < z.y + z.h;
  });
}
