import { shipWaterRegions } from './ship.js';
import { liquidBounds, isLiquid } from './liquid-geometry.js';
import { bodyBounds, bodyPoints } from "./props.js";
import { segmentBox } from "./collision.js";

export const conductive = b => b.material === "metal" || b.kind === "canister" || b.kind === "waterTank";
export const conductorBounds = b => b.mass ? bodyBounds(b) : isLiquid(b)?liquidBounds(b):b;
export const conductorPolygon = b => {
  if(b.mass)return bodyPoints(b);
  if(b.polygon)return b.polygon;
  b=conductorBounds(b);
  return [{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];
};
export function conductorNodes(state) {
  return [...shipWaterRegions(state),...(state.water || []).filter(q => !q.frozen && q.h > 1e-8),
    ...(state.spills || []).filter(q => q.kind==='molten' && q.h>1e-8),
    ...(state.cover || []).filter(b => b.hp > 0 && conductive(b)),
    ...(state.chunks || []).filter(b => b.hp > 0 && conductive(b)),
    ...state.platforms.filter(p => p.hp !== 0 && p.material === "metal" && !p.wreckId)];
}

// One contact test for authoritative conduction and the visible circuit.
// Rotated props must touch at their actual polygon, not an empty bounds corner.
export function conductorsTouch(a, b, platforms, aa = conductorBounds(a), bb = conductorBounds(b)) {
  if (aa.x >= bb.x + bb.w + 1.2 || aa.x + aa.w <= bb.x - 1.2 ||
      aa.y >= bb.y + bb.h + 1.2 || aa.y + aa.h <= bb.y - 1.2) return false;
  const ap = conductorPolygon(a), bp = conductorPolygon(b);
  for (const ps of [ap, bp]) for (let i = 0; i < ps.length; i++) {
    const p = ps[i], q = ps[(i + 1) % ps.length], len = Math.hypot(q.x-p.x,q.y-p.y) || 1;
    const nx = -(q.y-p.y)/len, ny = (q.x-p.x)/len;
    const av = ap.map(p => p.x*nx+p.y*ny), bv = bp.map(p => p.x*nx+p.y*ny);
    if (Math.max(...av) < Math.min(...bv)-1.2 || Math.max(...bv) < Math.min(...av)-1.2) return false;
  }
  if (a.grounded !== undefined && b.grounded !== undefined && platforms.some(p =>
    p.hp !== 0 && !p.waterId && segmentBox(aa.x+aa.w/2,aa.y+aa.h/2,bb.x+bb.w/2,bb.y+bb.h/2,p))) return false;
  return true;
}
