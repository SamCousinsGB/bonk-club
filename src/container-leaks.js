import { BARRELS, barrelWarning } from "./barrels.js";

export const LEAK_LIMIT = 4;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const container = b => !b.chunk && (Object.hasOwn(BARRELS,b.kind) || b.kind === "waterTank");

// Keep punctures in the casing's local coordinates, independent of translation,
// rotation and the small pressure-warning swell. Nearby hits reuse one opening.
export function punctureContainer(b, point) {
  if (!container(b) || b.spent) return;
  if (!point && b.leaks?.length) return;
  const c = Math.cos(b.angle || 0), s = Math.sin(b.angle || 0);
  const dx = point ? point.x - b.x - b.w / 2 : b.w / 2;
  const dy = point ? point.y - b.y - b.h / 2 : b.h * .22;
  const x = point ? dx * c + dy * s : dx, y = point ? dy * c - dx * s : dy;
  if (!Number.isFinite(x + y)) return;
  const left = -b.w / 2 + 2, right = b.w / 2 - 2, top = -b.h / 2 + 8, bottom = b.h / 2 - 1;
  const faces = [
    { x:left, y:clamp(y, top, bottom), nx:-1, ny:0 },
    { x:right, y:clamp(y, top, bottom), nx:1, ny:0 },
    { x:clamp(x, left, right), y:top, nx:0, ny:-1 },
    { x:clamp(x, left, right), y:bottom, nx:0, ny:1 },
  ];
  faces.sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
  const p = faces[0], leaks = (b.leaks ||= []);
  if (leaks.some(q => Math.hypot(q.x*b.w-p.x,q.y*b.h-p.y) < 7) || leaks.length >= LEAK_LIMIT) return;
  leaks.push({ x:p.x/b.w, y:p.y/b.h, nx:p.nx, ny:p.ny });
}

export function leakOutlets(b) {
  const c = Math.cos(b.angle || 0), s = Math.sin(b.angle || 0), swell = barrelWarning(b).swell;
  return (b.leaks || []).map(p => {
    const x = p.x * b.w * swell, y = p.y * b.h * swell;
    return { x:b.x+b.w/2+x*c-y*s, y:b.y+b.h/2+x*s+y*c,
      nx:p.nx*c-p.ny*s, ny:p.nx*s+p.ny*c };
  });
}

export function validContainerLeaks(b) {
  return b.leaks === undefined || (container(b) && Array.isArray(b.leaks) &&
    b.leaks.length > 0 && b.leaks.length <= LEAK_LIMIT && b.leaks.every(p =>
      p && [p.x,p.y].every(n => Number.isFinite(n) && Math.abs(n) <= .5) &&
      [-1,0,1].includes(p.nx) && [-1,0,1].includes(p.ny) && Math.abs(p.nx)+Math.abs(p.ny) === 1 &&
      (p.nx ? Math.abs(p.x-p.nx*(.5-2/b.w)) <= .011 :
        Math.abs(p.y-(p.ny < 0 ? -.5+8/b.h : .5-1/b.h)) <= .011)));
}
