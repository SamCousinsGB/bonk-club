import { playerBox } from "./collision.js";
import { WEAPONS } from "./arsenal.js";

// Clip convex polygons to a half-plane. The same beam footprint drives player
// hits and terrain removal, including diagonal shots and the flat muzzle end.
function clip(points, a, b, limit) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const dp = a * p.x + b * p.y - limit, dq = a * q.x + b * q.y - limit;
    if (dp <= 0) out.push(p);
    if ((dp <= 0) !== (dq <= 0)) {
      const t = dp / (dp - dq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}
export function beamIntersection(s, f) {
  const length = Math.hypot(f.ex - f.x, f.ey - f.y);
  if (!length) return [];
  const ax = (f.ex - f.x) / length, ay = (f.ey - f.y) / length;
  let points = [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y },
    { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }];
  for (const [a, b, limit] of [
    [-ax, -ay, -ax * f.x - ay * f.y],
    [ax, ay, ax * f.ex + ay * f.ey],
    [-ay, ax, -ay * f.x + ax * f.y + f.radius],
    [ay, -ax, ay * f.x - ax * f.y + f.radius],
  ]) points = clip(points, a, b, limit);
  return points;
}
export const beamTouches = (s, f) => beamIntersection(s, f).length > 0;

export function carveBeam(s, f, nextId) {
  let cut = beamIntersection(s, f);
  if (!cut.length) return [s];
  // Slice along the shorter dimension, with at most twelve cut bands per
  // surface. The surviving drawing uses these exact collision rectangles.
  const transpose = s.w < s.h;
  const box = transpose ? { x: s.y, y: s.x, w: s.h, h: s.w } : s;
  if (transpose) cut = cut.map(p => ({ x: p.y, y: p.x }));
  const low = Math.min(...cut.map(p => p.y)), high = Math.max(...cut.map(p => p.y));
  if (high - low < .001) return [s];
  const pieces = [], columns = new Map();
  const add = (x, y, w, h) => {
    if (w < .5 || h < .5) return;
    const key = `${x}:${w}`, previous = columns.get(key);
    if (previous && Math.abs(previous.y + previous.h - y) < .001) previous.h += h;
    else { const piece = { x, y, w, h }; pieces.push(piece); columns.set(key, piece); }
  };
  add(box.x, box.y, box.w, low - box.y);
  const step = Math.max(8, (high - low) / 12);
  for (let y = low; y < high - .001; y += step) {
    const h = Math.min(step, high - y);
    const band = clip(clip(cut, 0, -1, -y), 0, 1, y + h);
    const left = Math.min(...band.map(p => p.x)), right = Math.max(...band.map(p => p.x));
    add(box.x, y, left - box.x, h);
    add(right, y, box.x + box.w - right, h);
  }
  add(box.x, high, box.w, box.y + box.h - high);
  return pieces.map(piece => {
    const p = transpose ? { x: piece.y, y: piece.x, w: piece.h, h: piece.w } : piece;
    return { ...s, ...p, id: nextId(s), sourceId: s.sourceId || s.id,
      baseX: p.x, baseY: p.y, dx: 0, dy: 0, move: undefined, travel: undefined, elevator: false };
  });
}

export function firePhaser(world, player, ax, ay) {
  const weapon = WEAPONS.phaser;
  const x = player.x + ax * 52, y = player.y - 10 + ay * 52;
  const beam = { kind: "phaser", x, y, ex: x + ax * weapon.range,
    ey: y + ay * weapon.range, radius: weapon.radius, life: weapon.life, age: 0, owner: player.id };
  const id = s => `${s.sourceId || s.id || "spike"}:cph${++world.terrainSerial}`;
  const removedWreck = new Set(world.platforms.filter(s => s.wreckId && beamTouches(s, beam)).map(s => s.wreckId));
  world.wreckage = world.wreckage.filter(w => !removedWreck.has(w.id));
  world.wreckDirty ||= removedWreck.size > 0;
  world.platforms = world.platforms.filter(s => s.hp !== 0 && !removedWreck.has(s.wreckId))
    .flatMap(s => carveBeam(s, beam, id));
  world.spikeTerrain = (world.spikeTerrain || world.arena.spikes).flatMap(s => {
    const cut = beamIntersection({ ...s, y: s.y - 20, h: 22 }, beam);
    if (!cut.length) return [s];
    const left = Math.min(...cut.map(p => p.x)), right = Math.max(...cut.map(p => p.x));
    return [{ ...s, w: left - s.x }, { ...s, x: right, w: s.x + s.w - right }].filter(p => p.w >= .5);
  });
  world.cover = world.cover.filter(s => !beamTouches(s, beam));
  world.hazards = world.hazards.filter(h =>
    !beamTouches({ x: h.bodyX - h.w / 2, y: h.bodyY - 20, w: h.w, h: 40 }, beam) &&
    !beamTouches({ x: h.x, y: h.y, w: h.w, h: h.h }, beam));
  for (const key of ["drops", "projectiles", "debris", "blood"])
    world[key] = world[key].filter(p => {
      const r = p.r || (key === "drops" ? 20 : 5);
      return !beamTouches({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 }, beam);
    });
  world.ragdolls = world.ragdolls.filter(r => !r.points.some(p =>
    beamTouches({ x: p.x - 5, y: p.y - 5, w: 10, h: 10 }, beam)));
  world.terrainVersion++;
  const supports = new Set(world.solids().map(s => s.id));
  for (const p of world.players) {
    if (p.support && !supports.has(p.support)) { p.support = null; p.ground = false; }
    if (!p.alive || p.id === player.id || !beamTouches(playerBox(p), beam)) continue;
    // One hit per discharge. Short stun and a small impulse leave the air jump
    // available; the fading visual never damages a fighter a second time.
    world.hit(p, { x, y, vx: 0, vy: 0 }, weapon.damage, weapon.force, ax,
      Math.min(-.15, ay * .6), { blast: true, effect: "phaser", stun: .045, hitstop: .018 });
    if (p.alive) p.xray = .4;
  }
  world.fields.push(beam);
  world.fields = world.fields.slice(-12);
  return beam;
}
