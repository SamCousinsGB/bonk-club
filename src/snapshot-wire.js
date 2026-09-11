import { wreckTiles } from "./blackhole.js";
import { WreckReplayer } from "./wreck-motion.js";
// Moving black-hole terrain carries an initial shape/field plus a tick count.
// Guests run the shared deformation solver and derive collision strips locally.
// A final checkpoint guarantees identical settled geometry. Unrecorded pieces
// retain the compact outline fallback. Every reconstructed delta baseline is
// self-contained for packet loss, resets and hot joins.
export function compactSnapshot(state) {
  const counts = new Map();
  for (const p of state.platforms) if (p.wreckId) {
    const match = /r([0-4]):[0-2]$/.exec(p.id);
    if (match) {
      if (!counts.has(p.wreckId)) counts.set(p.wreckId,[0,0,0,0,0]);
      counts.get(p.wreckId)[Number(match[1])]++;
    }
  }
  return { ...state, platforms: state.platforms.filter(p => !p.wreckId), derivedWreck: true,
    wreckage: state.wreckage.map(w => {
      if (w.terrain) {
        const {x, y, w:width, h, angle, vx, vy, spin, spine, outline, ...out} = w;
        return out;
      }
      if (!w.spine || !w.outline) return w;
      const {spine, outline, ...out} = w;
      // A tenth of a world unit is below a screen pixel even at maximum zoom.
      // Opposite outline edges also define the spine, so do not send it twice.
      return {...out, tiles: counts.get(w.id) || [0,0,0,0,0], ribbon: outline.map(p => [Math.round(p.x * 10), Math.round(p.y * 10)])};
    }),
  };
}
export function expandSnapshot(state, validate, replayer = new WreckReplayer()) {
  if (!state || state.derivedWreck !== true || !Array.isArray(state.wreckage) || state.wreckage.length > 60) throw new Error("Invalid snapshot");
  const {derivedWreck, ...out} = state;
  replayer.retain(state.wreckage, `${state.round}:${state.arenaIndex}`);
  out.wreckage = state.wreckage.map(w => {
    if (!w || typeof w !== "object") throw new Error("Invalid wreck");
    if (w.terrain !== undefined) {
      if (!w.terrain || w.kind === "matter" || [w.ribbon,w.tiles,w.spine,w.outline].some(v => v !== undefined)) throw new Error("Invalid terrain encoding");
      return replayer.expand(w);
    }
    if (w.ribbon === undefined) {
      if (w.tiles !== undefined || w.spine !== undefined || w.outline !== undefined) throw new Error("Invalid ribbon encoding");
      return {...w};
    }
    if (!Array.isArray(w.tiles) || w.tiles.length !== 5 || !w.tiles.every(n=>Number.isInteger(n)&&n>=0&&n<=3) ||
        !Array.isArray(w.ribbon) || w.ribbon.length !== 12 ||
        !w.ribbon.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isInteger(n) && Math.abs(n) <= 10000000)))
      throw new Error("Invalid ribbon");
    const {ribbon, ...piece} = w, outline = ribbon.map(([x,y]) => ({x:x/10,y:y/10}));
    const spine = outline.slice(0,6).map((p,i) => ({x:(p.x+outline[11-i].x)/2,y:(p.y+outline[11-i].y)/2}));
    return {...piece,outline,spine};
  });
  if (!validate(out)) throw new Error("Invalid snapshot");
  out.platforms = [...state.platforms];
  for (const w of out.wreckage) { out.platforms.push(...wreckTiles(w,new Map(),w.tiles)); delete w.tiles; }
  if (!validate(out)) throw new Error("Invalid wreck collision");
  return out;
}
