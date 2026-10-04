import { blastFurnace } from './furnace-parts.js';
import { carveRectangle } from "./nuclear.js";
import { blastCables, releaseCableMounts } from "./heavy-cables.js";

// Marked wood and glass panels can be shot out. Every surface also supports
// circular explosion cuts, including structural supports and lifts.
export function preparePlatforms(arena) {
  return arena.platforms.map(p => ({ ...p }));
}

// Acid cuts only the surface supporting each parcel. The next layer cannot be
// reached until gravity carries the surviving liquid down to it. Cooldowns are
// local host bookkeeping; the resulting geometry uses the normal terrain wire.
const acidCuts = new WeakMap();
export function corrodeTerrain(world, acids) {
  let changed = false, cuts = 0;
  for (const q of acids) {
    if (!q.grounded || q.h < .25 || cuts >= 24) continue;
    const next = acidCuts.get(q) || 0;
    if (world.time < next) continue;
    const bottom = q.y + q.h, x = q.x + q.w / 2;
    const contact = world.platforms.filter(p => p.hp !== 0 && !p.waterId &&
      Math.abs(p.y - bottom) < .9 && x > p.x && x < p.x + p.w);
    if (!contact.length) continue;
    acidCuts.set(q, world.time + .35); cuts++;
    // A shallow circular bite makes progressive pits, including in thick rock.
    // Trace droplets make smaller cuts; corrosion consumes their finite volume.
    const radius = Math.min(22, Math.sqrt(q.w * q.h * 6));
    const cut = { x, y: bottom - radius * .55, radius };
    let removed = 0, pieces = world.platforms.length;
    const wrecks = new Set();
    world.platforms = world.platforms.flatMap(p => {
      if (!contact.includes(p)) return [p];
      // Wreck collision is regenerated from its physical body; damage that body
      // instead of leaving a hole that updateWreckage would silently refill.
      if (p.wreckId) { wrecks.add(p.wreckId); return [p]; }
      const remains = carveRectangle(p, cut, () => `acid${++world.terrainSerial}`);
      // Leave room below the 1,536-piece transport limit for other machinery.
      // At capacity, cuts that shrink the mesh may still consume existing pits.
      const growth = remains.length - 1;
      if (growth > 0 && pieces + growth > 1400) return [p];
      pieces += growth;
      removed += p.w * p.h - remains.reduce((sum, r) => sum + r.w * r.h, 0);
      return remains;
    });
    for (const id of wrecks) {
      const p = contact.find(p => p.wreckId === id), before = p.hp;
      world.damageCover(p, 8);
      removed += Math.max(0, before - p.hp) * q.w * 4;
    }
    if (removed <= 0) continue;
    const used = Math.min(q.h, removed / (q.w * 24));
    q.h -= used; q.y += used; q.grounded = false;
    changed = true;
  }
  if (changed) {
    releaseCableMounts(world);
    world.terrainVersion++;
    releaseMissingSupports(world);
  }
}

function releaseMissingSupports(world) {
  const ids = new Set(world.solids().map(s => s.id));
  for (const p of world.players) if (p.support && !ids.has(p.support)) {
    p.support = null; p.ground = false; p.coyote = 0;
  }
}

export function carveExplosion(world, blast, { fixtures = true, preservePlatform = () => false } = {}) {
  blastCables(world, blast);
  if(fixtures)blastFurnace(world,blast);
  const cut = { ...blast, id: `blast${++world.terrainSerial}` };
  let changed = false;
  const removedWreck = new Set();
  const pieces = [];
  for (const p of world.platforms) {
    if (p.hp === 0) continue;
    if (preservePlatform(p)) { pieces.push(p); continue; }
    const remains = carveRectangle(p, cut, () => `cut${++world.terrainSerial}`);
    if (remains[0] === p) { pieces.push(p); continue; }
    changed = true;
    // Warped fragments are individual physical objects. Consume any hit piece,
    // otherwise updateWreckage would recreate its collision on the next tick.
    if (p.wreckId) removedWreck.add(p.wreckId);
    else pieces.push(...remains);
  }
  world.platforms = pieces.filter(p => !removedWreck.has(p.wreckId));
  if (removedWreck.size) {
    world.wreckage = world.wreckage.filter(w => !removedWreck.has(w.id));
    world.wreckDirty = true;
  }
  const spikes = world.spikeTerrain || world.arena.spikes;
  world.spikeTerrain = spikes.flatMap(s => {
    const remains = carveRectangle({ ...s, h: .5 }, cut);
    if (remains.length !== 1 || remains[0].w !== s.w) changed = true;
    return remains.map(({ x, y, w }) => ({ x, y, w }));
  });
  for (const h of fixtures ? world.hazards : []) {
    if (h.type === "rocket" || h.type === "colossus" || h.type === "powerline" || h.type === "furnace" || h.type === "train" || h.type === "airflow") continue; // Remote controllers and independent powered structures survive local terrain cuts.
    if (h.done) continue;
    const box = {
    x: h.bodyX - h.w / 4, y: h.bodyY - 16, w: h.w / 2, h: 32,
    };
    if (carveRectangle(box, cut)[0] !== box) {
      // Keep the existing disabled identity for guest break animation and hot
      // join. It has no collision, damage or artwork after its brief breakup.
      h.done = true; h.active = false; h.warning = 0; changed = true;
    }
  }
  releaseCableMounts(world);
  if (!changed) return;
  world.terrainVersion++;
  releaseMissingSupports(world);
  // Only impacted terrain emits chips. The finite burst is shared with guests.
  for (let n = 0; n < 16; n++) {
    const angle = n * 2.39996, speed = 90 + world.random() * 240;
    world.debris.push({ x: cut.x, y: cut.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 130,
      angle, spin: (world.random() - .5) * 12,
      w: 4 + world.random() * 10, h: 3 + world.random() * 5, life: 1.4 + world.random() });
  }
  world.debris = world.debris.slice(-90);
}
