import { wreckTiles } from "./blackhole.js";
// Collision strips are derived from the visible wreck outlines. Sending both
// geometries multiplies black-hole bandwidth. Guests reconstruct the strips
// from validated outlines; only the host runs collision/physics. Every frame
// remains self-contained for packet loss, resets and hot joins.
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
      if (!w.spine || !w.outline) return w;
      const {spine, outline, ...out} = w;
      // A tenth of a world unit is below a screen pixel even at maximum zoom.
      // Opposite outline edges also define the spine, so do not send it twice.
      return {...out, tiles: counts.get(w.id) || [0,0,0,0,0], ribbon: outline.map(p => [Math.round(p.x * 10), Math.round(p.y * 10)])};
    }),
  };
}
export function expandSnapshot(state, validate) {
  if (!state || state.derivedWreck !== true || !Array.isArray(state.wreckage) || state.wreckage.length > 60) throw new Error("Invalid snapshot");
  const {derivedWreck, ...out} = state;
  out.wreckage = state.wreckage.map(w => {
    if (!w || typeof w !== "object") throw new Error("Invalid wreck");
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
