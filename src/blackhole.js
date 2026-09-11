import { seedOrbit, orbitPoint, limitRope, springRope, ribbonOutline } from "./orbit.js";
import { carveRectangle, inBlast } from "./nuclear.js";
import { captureFighter } from "./singularity-body.js";
import { collectMatter, packMatter, matterTiles } from "./accretion.js";
import { bodyInBlast } from "./props.js";
export const SINGULARITY = { radius: 465, duration: 5.5, arm: 0.4, core: 101.25 };

export function blackholeField(world, b) {
  return {
    kind: "blackhole",
    x: b.x,
    y: b.y,
    ex: b.x,
    ey: b.y,
    radius: SINGULARITY.radius,
    life: SINGULARITY.duration,
    age: 0,
    owner: b.owner,
    tick: 0,
    riftId: ++world.riftSerial,
    torn: false,
  };
}
export function wreckCorners(w) {
  if (w.outline) return w.outline;
  const c = Math.cos(w.angle),
    s = Math.sin(w.angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => ({
    x: w.x + ((x * w.w) / 2) * c - ((y * w.h) / 2) * s,
    y: w.y + ((x * w.w) / 2) * s + ((y * w.h) / 2) * c,
  }));
}
// Collision follows each curved ribbon: five links with at most three strips
// each. The global 60-fragment cap keeps even overlapping fields bounded.
export function wreckTiles(w, old = new Map(), counts = null) {
  if (w.hp <= 0) return [];
  if (w.kind === "matter") return matterTiles(w, old);
  if (w.spine) {
    const tiles = [];
    for (let n = 0; n < w.spine.length - 1; n++) {
      const quad = [
        w.outline[n],
        w.outline[n + 1],
        w.outline[w.outline.length - 2 - n],
        w.outline[w.outline.length - 1 - n],
      ];
      for (const tile of polygonTiles(w, quad, 3, `${w.id}r${n}`, new Map(), counts?.[n])) {
        const before = old.get(tile.id);
        tile.dx = before ? tile.x - before.x : 0;
        tile.dy = before ? tile.y - before.y : 0;
        tiles.push(tile);
      }
    }
    return tiles;
  }
  return polygonTiles(w, wreckCorners(w), 12, w.id, old);
}
function polygonTiles(w, polygon, cap, prefix, old = new Map(), countHint = null) {
  const points = polygon,
    left = Math.min(...points.map((p) => p.x)),
    right = Math.max(...points.map((p) => p.x));
  if (countHint === 0 || (countHint === null && right - left < 0.5)) return [];
  const count = countHint ?? Math.max(1, Math.min(cap, Math.ceil((right - left) / 16))),
    width = (right - left) / count,
    tiles = [];
  for (let i = 0; i < count; i++) {
    const x = left + i * width,
      end = x + width,
      ys = [];
    for (let n = 0; n < 4; n++) {
      const a = points[n],
        b = points[(n + 1) % 4];
      if (a.x >= x && a.x <= end) ys.push(a.y);
      for (const edge of [x, end])
        if (Math.abs(b.x - a.x) > 1e-8) {
          const t = (edge - a.x) / (b.x - a.x);
          if (t >= 0 && t <= 1) ys.push(a.y + (b.y - a.y) * t);
        }
    }
    if (!ys.length) continue;
    const y = Math.min(...ys),
      h = Math.max(0.5, Math.max(...ys) - y),
      id = `wreck${prefix}:${i}`,
      before = old.get(id);
    tiles.push({
      id,
      wreckId: w.id,
      x,
      y,
      w: width,
      h,
      baseX: x,
      baseY: y,
      dx: before ? x - before.x : 0,
      dy: before ? y - before.y : 0,
      destructible: true,
      panel: "wood",
      hp: w.hp,
      maxHp: 120,
    });
  }
  return tiles;
}
function addWreck(world, f, s, kind = "platform") {
  if (world.wreckage.length >= 59) { collectMatter(world, f, s, kind); return; }
  const x = s.x + s.w / 2,
    y = s.y + s.h / 2;
  world.wreckage.push({
    id: ++world.wreckSerial,
    x,
    y,
    w: Math.min(150, s.w),
    h: Math.min(90, s.h),
    angle: s.angle || 0,
    hp: 120,
    kind,
    sourceKind: s.kind || null,
    sourceChunk: !!s.chunk,
    shape: s.shape,
    sourceArt: s.sourceArt,
    elevator: !!s.elevator,
    trapType: s.type || null,
    surface: s.surface || null,
    material: s.material || null,
    ice: !!s.ice,
    panel: s.panel || null,
    fieldId: f.riftId,
    outer: kind === "platform" && Math.hypot(x - f.x, y - f.y) > f.radius * .64,
    originX: x,
    originY: y,
    originAngle: 0,
    vx: s.vx || 0,
    vy: s.vy || 0,
    spin: s.spin || s.angularVelocity || 0,
  });
}
function tear(world, f) {
  f.torn = true;
  world.wreckage = world.wreckage.filter((w) => w.hp > 0);
  const cut = { id: `rift${f.riftId}`, x: f.x, y: f.y, radius: f.radius };
  world.rifts.push({ ...cut, id: f.riftId, born: world.time });
  const retained = [],
    sources = [];
  for (const p of world.platforms) {
    if (p.wreckId) continue;
    const remains = carveRectangle(p, cut, () => `cut${++world.terrainSerial}`);
    retained.push(...remains);
    if (remains[0] === p || p.hp === 0) continue;
    const start = Math.max(p.x, f.x - f.radius),
      end = Math.min(p.x + p.w, f.x + f.radius);
    for (let x = start; x < end; x += 110) {
      const w = Math.min(110, end - x),
        piece = { ...p, x, w };
      if (inBlast({ x: x + w / 2, y: p.y + p.h / 2 }, f)) sources.push(piece);
    }
  }
  world.platforms = retained;
  for (const w of world.wreckage)
    if (inBlast(w, f))
      if (w.kind === "matter") { collectMatter(world, f, w, "debris"); w.hp = 0; }
      else Object.assign(w, {
        fieldId: f.riftId,
        originX: w.x,
        originY: w.y,
        originAngle: w.angle,
      });
  world.cover = world.cover.filter((p) => {
    if (p.hp <= 0 || !bodyInBlast(p,cut)) return true;
    addWreck(world, f, p, "prop");
    return false;
  });
  world.hazards = world.hazards.filter((h) => {
    if (!inBlast(h, f) && !inBlast({ x: h.bodyX, y: h.bodyY }, f)) return true;
    addWreck(
      world,
      f,
      {
        ...h,
        x: h.bodyX - h.w / 4,
        y: h.bodyY - 22,
        w: Math.min(100, h.w),
        h: 44,
      },
      "trap",
    );
    return false;
  });
  // Prefer a spread of fragments across the affected floors, not one huge floor.
  const count = Math.min(26, sources.length);
  const chosen = new Set();
  for (let n = 0; n < count; n++)
    { const index = Math.floor((n * sources.length) / count); chosen.add(index); addWreck(world, f, sources[index]); }
  for (let i = 0; i < sources.length; i++) if (!chosen.has(i)) collectMatter(world, f, sources[i], "platform");
  world.wreckDirty = true;
  world.terrainVersion++;
  world.event("explosion", {
    x: f.x,
    y: f.y,
    radius: 190,
    effect: "singularity",
  });
}
export function updateBlackhole(world, f, dt) {
  f.age += dt;
  if (f.age < SINGULARITY.arm) return;
  if (!f.torn) tear(world, f);
  // Liquid and vapour become coloured samples in the existing planar orbit;
  // totals retain every parcel even when the visible sample budget is full.
  for (const key of ["water", "gas", "spills"]) world[key] = (world[key] || []).filter(q => {
    if (q.frozen || !inBlast(q, f)) return true;
    collectMatter(world, f, { ...q, color:key === "water" ? "#69c5ee" : key === "gas" ? "#b0c99f" :
      q.kind === "oil" ? "#827757" : q.kind === "glue" ? "#d3dba0" : "#6e497e" }, "debris");
    return false;
  });
  // Loose fragments and props can enter an already active field. Convert them
  // into the same deformable, collidable ribbons as the original torn terrain.
  for (const key of ["cover", "chunks"]) world[key] = world[key].filter(p => {
    if (p.hp <= 0 || !bodyInBlast(p,f)) return true;
    addWreck(world,f,p,"prop"); world.wreckDirty=true; world.terrainVersion++;
    return false;
  });
  for (const p of world.players.filter(p => p.alive)) {
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    if (!p.capturedBy && d < f.radius * .88) captureFighter(p, f);
    if (p.capturedBy !== f.riftId) continue;
    if (f.life <= .7 || (f.life < 1.1 && d < 85)) {
      collectMatter(world, f, p, "fighter");
      if (p.weapon) collectMatter(world, f, { ...p, type: p.weapon }, "weapon");
      world.kill(p, { effect: "singularity", sourceX: f.x, sourceY: f.y });
      world.ragdolls.pop(); // The same body is now part of the compressed matter.
      delete p.capturedBy; delete p.strands;
    }
  }
  // Existing corpses join the same colliding flow, regardless of how they died.
  for (const rag of world.ragdolls) {
    if (!rag.capturedBy && rag.points.some(p => Math.hypot(p.x-f.x,p.y-f.y) < f.radius * .88)) {
      rag.capturedBy = f.riftId; rag.targetX = f.x; rag.targetY = f.y;
    }
    if (rag.capturedBy !== f.riftId) continue;
    rag.life = Math.max(rag.life, f.life + .1);
    if (f.life <= .7) { collectMatter(world, f, { ...rag, ...rag.points[2] }, "fighter"); rag.life = 0; }
  }
  world.ragdolls = world.ragdolls.filter(r => r.life > 0);
  for (const [key, kind] of [["drops", "weapon"], ["projectiles", "projectile"], ["debris", "debris"], ["blood", "blood"]]) {
    world[key] = world[key].filter(p => {
      if (Math.hypot(p.x-f.x,p.y-f.y) > f.radius) return true;
      // Retained as orbiting matter; captured ammunition cannot detonate again.
      collectMatter(world,f,p,kind); return false;
    });
  }
  for (const w of world.wreckage) {
    if (w.hp <= 0 || w.fieldId !== f.riftId || w.outer || w.kind === "matter") continue;
    if (f.life < 1.1 || (w.spine && w.spine.every(p => Math.hypot(p.x-f.x,p.y-f.y)<30))) {
      collectMatter(world, f, w, w.kind); w.hp = 0; world.wreckDirty = true;
    }
  }
  packMatter(f, dt);
  if (f.life <= 0 && f.matter) {
    world.wreckage = world.wreckage.filter(w => w.hp > 0);
    if (world.wreckage.length >= 60) {
      const w = world.wreckage.pop(); collectMatter(world, f, w, w.kind); packMatter(f, dt);
    }
    world.wreckage.push(f.matter); delete f.matter;
    world.wreckDirty = true; world.terrainVersion++;
  }
}
export function updateWreckage(world, dt = 1 / 120) {
  const old = new Map(
    world.platforms.filter((p) => p.wreckId).map((p) => [p.id, p]),
  );
  const active = world.fields.some(
    (f) => f.kind === "blackhole" && f.torn && f.life > 0,
  );
  if (
    !active &&
    !world.wreckDirty &&
    ![...old.values()].some((p) => p.dx || p.dy)
  )
    return;
  world.wreckDirty = false;
  if (world.warpActive && !active) world.terrainVersion++;
  world.warpActive = active;
  for (const w of world.wreckage) {
    if (w.hp <= 0 || w.kind === "matter") continue;
    const f = world.fields.find(
      (f) =>
        f.kind === "blackhole" &&
        f.riftId === w.fieldId &&
        f.torn &&
        f.life > 0,
    );
    if (!f) continue;
    if (!w.spine) {
      w.spine = Array.from({ length: 6 }, (_, i) => ({
        x: w.x + (i / 5 - 0.5) * w.w * Math.cos(w.angle),
        y: w.y + (i / 5 - 0.5) * w.w * Math.sin(w.angle),
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
    w.angle = Math.atan2(
      w.spine.at(-1).y - w.spine[0].y,
      w.spine.at(-1).x - w.spine[0].x,
    );
    w.outline = ribbonOutline(w.spine, w.h, f);
  }
  world.platforms = world.platforms.filter((p) => !p.wreckId);
  for (const w of world.wreckage) world.platforms.push(...wreckTiles(w, old));
}
