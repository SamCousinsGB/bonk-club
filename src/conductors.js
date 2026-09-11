import { bodyBounds, bodyPoints } from "./props.js";
import { segmentBox } from "./collision.js";

export const conductive = b => b.material === "metal" || b.kind === "canister" || b.kind === "waterTank";
export const conductorBounds = b => b.mass ? bodyBounds(b) : b;
export const conductorPolygon = b => b.mass ? bodyPoints(b) : [
  {x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];
export function conductorNodes(state) {
  return [...(state.water || []).filter(q => !q.frozen && q.h >= .5),
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
    p.hp !== 0 && !p.waterId && segmentBox(a.x+a.w/2,a.y+a.h/2,b.x+b.w/2,b.y+b.h/2,p))) return false;
  return true;
}
