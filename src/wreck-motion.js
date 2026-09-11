import { seedOrbit, orbitPoint, limitRope, springRope, ribbonOutline } from "./orbit.js";

// Terrain has no contacts in this solver. Its initial momentum, the field and
// fixed simulation ticks completely determine the curved artwork/collision.
// Keep this function shared by the authoritative host and the guest worker.
export function stepWreck(w, f, dt) {
  if (!w.spine) {
    w.spine = Array.from({ length: 6 }, (_, i) => ({
      x: w.x + (i / 5 - .5) * w.w * Math.cos(w.angle),
      y: w.y + (i / 5 - .5) * w.w * Math.sin(w.angle),
    }));
    for (const p of w.spine) {
      p.vx = w.vx - (p.y - w.y) * w.spin;
      p.vy = w.vy + (p.x - w.x) * w.spin;
      seedOrbit(p, f);
    }
  }
  springRope(w.spine, w.w / 5, dt, 110);
  for (const p of w.spine) orbitPoint(p, f, dt);
  limitRope(w.spine, w.w / 5, 4);
  w.x = w.spine.reduce((sum, p) => sum + p.x, 0) / w.spine.length;
  w.y = w.spine.reduce((sum, p) => sum + p.y, 0) / w.spine.length;
  w.angle = Math.atan2(w.spine.at(-1).y - w.spine[0].y, w.spine.at(-1).x - w.spine[0].x);
  w.outline = ribbonOutline(w.spine, w.h, f);
}

const records = new WeakMap();
const point = p => ({ x: p.x, y: p.y });
const shape = w => ({ x: w.x, y: w.y, w: w.w, h: w.h, angle: w.angle,
  spine: w.spine.map(point), outline: w.outline.map(point) });

export function recordWreckStep(w, f, dt) {
  let r = records.get(w);
  if (!r || r.seed.field !== f.riftId || r.seed.dt !== dt || r.nextAge !== f.age ||
      r.seed.x !== f.x || r.seed.y !== f.y || r.seed.radius !== f.radius || r.steps >= 1000) {
    // Transfers between fields start from the existing moving spine. Newly torn
    // terrain needs only a rectangle and its incoming momentum, sent once.
    const body = { x:w.x, y:w.y, w:w.w, h:w.h, angle:w.angle,
      vx:w.vx, vy:w.vy, spin:w.spin };
    if (w.spine) body.spine = w.spine.map(p => ({...point(p), px:p.px, py:p.py}));
    r = { seed: { revision:(r?.seed.revision || 0) + 1, field:f.riftId,
      x:f.x, y:f.y, radius:f.radius, age:f.age, dt, body }, steps:0 };
    records.set(w, r);
  }
  stepWreck(w, f, dt);
  r.steps++; r.nextAge = f.age + dt;
  r.final = null;
}

export function wreckRecipe(w, fields) {
  const r = records.get(w);
  if (!r || !w.spine || !w.outline) return undefined;
  if (fields.some(f => f.riftId === r.seed.field && f.kind === "blackhole" && f.torn && f.life > 0))
    return { seed:r.seed, steps:r.steps };
  // One authoritative full-precision checkpoint replaces the recipe at rest.
  // This also makes final geometry independent of cross-browser math rounding.
  return { final: r.final ||= shape(w) };
}

const finite = n => Number.isFinite(n) && Math.abs(n) <= 1000000;
const xy = p => p && finite(p.x) && finite(p.y);
const integer = n => Number.isSafeInteger(n) && n > 0 && n <= 1000000;
const dimensions = b => b && xy(b) && finite(b.angle) && b.w > 0 && b.w <= 150 && b.h > 0 && b.h <= 90;
function validSeed(s) {
  const b = s?.body;
  return s && integer(s.revision) && integer(s.field) && xy(s) && s.radius > 0 && s.radius <= 1000 &&
    Number.isFinite(s.age) && s.age >= 0 && s.age <= 60 && Number.isFinite(s.dt) && s.dt >= .001 && s.dt <= .1 &&
    dimensions(b) && [b.vx,b.vy,b.spin].every(finite) &&
    (b.spine === undefined || Array.isArray(b.spine) && b.spine.length === 6 &&
      b.spine.every(p => xy(p) && finite(p.px) && finite(p.py)));
}
function validShape(b) {
  return dimensions(b) && Array.isArray(b.spine) && b.spine.length === 6 && b.spine.every(xy) &&
    Array.isArray(b.outline) && b.outline.length === 12 && b.outline.every(xy);
}

export class WreckReplayer {
  constructor() { this.pieces = new Map(); }
  retain(wreckage, epoch) {
    if (this.epoch !== epoch) { this.pieces.clear(); this.epoch = epoch; }
    const ids = new Set(wreckage.map(w => w?.id));
    for (const id of this.pieces.keys()) if (!ids.has(id)) this.pieces.delete(id);
  }
  expand(w) {
    const { terrain, ...piece } = w;
    if (terrain.final !== undefined) {
      if (terrain.seed !== undefined || terrain.steps !== undefined || !validShape(terrain.final)) throw new Error("Invalid terrain checkpoint");
      this.pieces.delete(w.id);
      return { ...piece, ...terrain.final };
    }
    const { seed, steps } = terrain;
    if (!integer(w.id) || !validSeed(seed) || !Number.isInteger(steps) || steps < 1 || steps > 1000)
      throw new Error("Invalid terrain recipe");
    // A content key prevents an altered seed reusing an old cached trajectory.
    const key = JSON.stringify(seed);
    let r = this.pieces.get(w.id);
    if (!r || r.key !== key || r.steps > steps) {
      r = { key, body:structuredClone(seed.body), field:{...seed}, steps:0 };
      this.pieces.set(w.id, r);
    }
    while (r.steps < steps) {
      stepWreck(r.body, r.field, seed.dt);
      r.field.age += seed.dt; r.steps++;
    }
    // Never expose the mutable replay cache to interpolation or delta history.
    return { ...piece, ...shape(r.body) };
  }
}
