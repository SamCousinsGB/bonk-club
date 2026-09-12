import { CABLE_LAYOUTS, CABLE_SEGMENTS, cableLayout } from "./cable-layout.js";

const STEP = 1 / 120;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const fixed = (c, i) => i === 0 && c.attached[0] || i === CABLE_SEGMENTS && c.attached[1];
const survives = (world, x, y) => world.platforms.some(p => p.hp !== 0 && !p.wreckId &&
  Math.abs(p.y - y) < 2 && p.x <= x && p.x + p.w >= x);
export const cableIntact = c => !!c && c.attached.every(Boolean) && c.links.every(Boolean);

function makeCable(layout) {
  const { a, b, sag } = layout;
  const points = Array.from({ length: CABLE_SEGMENTS + 1 }, (_, i) => {
    const u = i / CABLE_SEGMENTS, x = a.x + (b.x - a.x) * u,
      y = a.y + (b.y - a.y) * u + Math.sin(Math.PI * u) * sag;
    return { x, y, px: x, py: y };
  });
  return { id: layout.id, attached: [true, true], links: Array(CABLE_SEGMENTS).fill(true), points,
    lengths: points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y)) };
}

export function createCables(arena) {
  const kind = arena.furnace ? "furnace" : arena.transmission ? "tower" : null;
  const cables = CABLE_LAYOUTS.filter(c => c.kind === kind).map(makeCable);
  // Settle once on round creation. Guests receive these points from the host;
  // joining a damaged arena never recreates a pristine span or replays history.
  for (let i = 0; i < 360; i++) for (const c of cables) stepCable(c, i * STEP, 0, []);
  for (const c of cables) for (const p of c.points) { p.px = p.x; p.py = p.y; }
  return cables;
}

export function releaseCableMounts(world) {
  if (world.prediction) return;
  for (const c of world.cables || []) {
    const wasIntact = cableIntact(c);
    const spec = cableLayout(c.id);
    if (spec.kind === "tower") {
      for (const [i, end] of [spec.a, spec.b].entries())
        if (!survives(world, end.x, end.supportY)) c.attached[i] = false;
    } else {
      const machine = world.hazards.find(h => h.type === "furnace");
      if (!machine || machine.done || !survives(world, 1280, 1000)) c.attached[1] = false;
    }
    if (wasIntact && !cableIntact(c)) releaseCableSupport(world, c);
  }
}

function contact(p, platforms) {
  for (const s of platforms) {
    if (s.hp === 0 || p.x < s.x - 4 || p.x > s.x + s.w + 4 ||
        p.y < s.y - 4 || p.y > s.y + s.h + 4) continue;
    // Heavy background cables rest on surviving steel. Actor displacement does
    // not feed this solver; only intact tower spans provide walking support.
    const faces = [p.x - s.x + 4, s.x + s.w + 4 - p.x, p.y - s.y + 4, s.y + s.h + 4 - p.y];
    const face = faces.indexOf(Math.min(...faces));
    if (face < 2) { p.x = face === 0 ? s.x - 4 : s.x + s.w + 4; p.px = p.x; }
    else { p.y = face === 2 ? s.y - 4 : s.y + s.h + 4; p.py = p.y; p.px += (p.x - p.px) * .2; }
  }
}

export function stepCable(c, time, power, platforms) {
  c.motionRevision = (c.motionRevision || 0) + 1;
  const spec = cableLayout(c.id), points = c.points;
  for (let i = 0; i <= CABLE_SEGMENTS; i++) {
    const p = points[i];
    if (fixed(c, i) || !(c.links[i - 1] || c.links[i])) continue;
    // Thick conductors: high drag rapidly dissipates local motion. Electrical
    // forces are small accelerations, not positional waves or large impulses.
    const vx = clamp((p.x - p.px) * .965, -6, 6), vy = clamp((p.y - p.py) * .985, -6, 6);
    p.px = p.x; p.py = p.y;
    const u = i / CABLE_SEGMENTS, force = power * Math.sin(Math.PI * u) *
      (Math.sin(time * 19 + i * .8 + spec.index * 2.1) * 260 + Math.sin(time * 31 - i * .6) * 140);
    p.x += vx + force * .3 * STEP * STEP;
    p.y += vy + (650 + force) * STEP * STEP;
  }
  for (let pass = 0; pass < 18; pass++) {
    for (let k = 0; k < CABLE_SEGMENTS; k++) {
      const i = pass % 2 ? CABLE_SEGMENTS - 1 - k : k;
      if (!c.links[i]) continue;
      const p = points[i], q = points[i + 1], dx = q.x - p.x, dy = q.y - p.y,
        d = Math.hypot(dx, dy) || 1, error = (d - c.lengths[i]) / d;
      const a = fixed(c, i) ? 0 : 1, b = fixed(c, i + 1) ? 0 : 1, total = a + b || 1;
      p.x += dx * error * a / total; p.y += dy * error * a / total;
      q.x -= dx * error * b / total; q.y -= dy * error * b / total;
    }
    // Contact and distance constraints alternate, so a falling strand cannot
    // tunnel through a gallery or stretch indefinitely across its edge.
    if (pass % 3 === 2) for (let i = 0; i <= CABLE_SEGMENTS; i++)
      if (!fixed(c, i) && (c.links[i - 1] || c.links[i])) contact(points[i], platforms);
  }
  for (const [i, end] of [[0, spec.a], [CABLE_SEGMENTS, spec.b]]) if (fixed(c, i))
    Object.assign(points[i], { x: end.x, y: end.y, px: end.x, py: end.y });
  for (const p of points) {
    // Detached off-arena matter stays bounded without any lifetime or respawn.
    p.x = clamp(p.x, -3000, 5500); p.y = Math.min(p.y, 3000);
  }
}

export function updateCables(world, dt) {
  if (world.prediction || !world.cables?.length) return;
  releaseCableMounts(world);
  world.cableAccumulator = (world.cableAccumulator || 0) + clamp(dt, 0, .05);
  while (world.cableAccumulator + 1e-9 >= STEP) {
    for (const c of world.cables) {
      const spec = cableLayout(c.id), h = world.hazards.find(h =>
        spec.kind === "furnace" ? h.type === "furnace" : h.type === "powerline" && h.circuit === spec.index);
      const power = h && !h.done && h.active && (spec.kind === "tower" || cableIntact(c)) ? 1 : 0;
      stepCable(c, world.time - world.cableAccumulator, power, world.platforms);
    }
    world.cableAccumulator -= STEP;
  }
}

const distanceToSegment = (x, y, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const u = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - a.x - dx * u, y - a.y - dy * u);
};
export function blastCables(world, blast) {
  if (world.prediction || !blast) return;
  for (const c of world.cables || []) {
    const wasIntact = cableIntact(c);
    for (let i = 0; i < CABLE_SEGMENTS; i++) if (c.links[i] &&
        distanceToSegment(blast.x, blast.y, c.points[i], c.points[i + 1]) < blast.radius)
      c.links[i] = false;
    for (const [i, p] of c.points.entries()) {
      const dx = p.x - blast.x, dy = p.y - blast.y, d = Math.hypot(dx, dy);
      if (d < blast.radius && (i === 0 || i === CABLE_SEGMENTS)) c.attached[i === 0 ? 0 : 1] = false;
      if (d > 0 && d < blast.radius * 2 && !fixed(c, i)) {
        const impulse = 65 * (1 - d / (blast.radius * 2)) * STEP;
        p.px -= dx / d * impulse; p.py -= dy / d * impulse;
      }
    }
    if (wasIntact && !cableIntact(c)) releaseCableSupport(world, c);
  }
}

export function cutCables(world, touches) {
  if (world.prediction) return;
  for (const c of world.cables || []) {
    const wasIntact = cableIntact(c);
    for (let i = 0; i < CABLE_SEGMENTS; i++) if (c.links[i]) {
      const a = c.points[i], b = c.points[i + 1], d = Math.hypot(b.x - a.x, b.y - a.y) || 1,
        nx = (b.y - a.y) / d * 4, ny = (a.x - b.x) / d * 4;
      if (touches([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
        { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }])) c.links[i] = false;
    }
    for (const [i, p] of [c.points[0], c.points.at(-1)].entries())
      if (touches([{x:p.x-4,y:p.y-4},{x:p.x+4,y:p.y-4},{x:p.x+4,y:p.y+4},{x:p.x-4,y:p.y+4}]))
        c.attached[i] = false;
    if (wasIntact && !cableIntact(c)) releaseCableSupport(world, c);
  }
}

function releaseCableSupport(world, c) {
  if (cableLayout(c.id).kind !== "tower") return;
  world.terrainVersion++;
  for (const p of world.players || []) if (p.support?.startsWith(`${c.id}:wire`)) {
    p.support = null; p.ground = false; p.coyote = 0;
  }
}

const collisionCache = new WeakMap();
const COLLISION_SEGMENTS = 48;
export function cableSolids(world) {
  const all = [];
  for (const c of world.cables || []) {
    if (cableLayout(c.id)?.kind !== "tower" || !cableIntact(c)) continue;
    let cached = collisionCache.get(c);
    if (!cached || cached.revision !== c.motionRevision) {
      const previous = cached?.tiles;
      const sample = u => {
        const f = u * CABLE_SEGMENTS, n = Math.min(CABLE_SEGMENTS - 1, Math.floor(f)), t = f - n;
        const a = c.points[n], b = c.points[n + 1];
        return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      };
      const tiles = [];
      // Small rises stay inside the shared walking solver's landing tolerance.
      // These are derived from the live rope, never separate visible platforms.
      for (let i = 0; i < COLLISION_SEGMENTS; i++) {
        const a = sample(i / COLLISION_SEGMENTS), b = sample((i + 1) / COLLISION_SEGMENTS), x = Math.min(a.x,b.x), y = (a.y+b.y)/2-3;
        tiles.push({id:`${c.id}:wire${i}`,x,y,w:Math.max(.1,Math.abs(b.x-a.x)),h:6,material:"cable",
          dx:previous ? x-previous[i].x : 0,dy:previous ? y-previous[i].y : 0});
      }
      cached = {revision:c.motionRevision,tiles}; collisionCache.set(c,cached);
    }
    all.push(...cached.tiles);
  }
  return all;
}

export function cableSnapshot(cables = []) {
  return cables.map(c => ({ id: c.id, attached: [...c.attached], links: [...c.links],
    points: c.points.map(p => ({ x: p.x, y: p.y })) }));
}
export function validCables(cables, arena) {
  const specs = CABLE_LAYOUTS.filter(c => arena?.furnace ? c.kind === "furnace" : arena?.transmission ? c.kind === "tower" : false);
  return Array.isArray(cables) && cables.length === specs.length &&
    new Set(cables.map(c => c?.id)).size === cables.length && cables.every(c => {
      const spec = specs.find(s => s.id === c?.id);
      return spec && Array.isArray(c.attached) && c.attached.length === 2 && c.attached.every(v => typeof v === "boolean") &&
        Array.isArray(c.links) && c.links.length === CABLE_SEGMENTS && c.links.every(v => typeof v === "boolean") &&
        Array.isArray(c.points) && c.points.length === CABLE_SEGMENTS + 1 && c.points.every(p => p &&
          Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= -3000 && p.x <= 5500 && p.y >= -1000 && p.y <= 3000) &&
        [spec.a, spec.b].every((end, i) => !c.attached[i] ||
          Math.hypot(c.points[i * CABLE_SEGMENTS].x - end.x, c.points[i * CABLE_SEGMENTS].y - end.y) < .1);
    });
}
