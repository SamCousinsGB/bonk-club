import { carveRectangle, inBlast } from "./nuclear.js";
import { carryImpulse } from "./impact.js";
export const SINGULARITY = { radius: 620, duration: 5.5, arm: 0.4, core: 135 };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

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
// Rasterized collision follows each rotated piece, instead of leaving an
// invisible unrotated floor behind. At most twelve strips per piece.
export function wreckTiles(w, old = new Map()) {
  if (w.hp <= 0) return [];
  const points = wreckCorners(w),
    left = Math.min(...points.map((p) => p.x)),
    right = Math.max(...points.map((p) => p.x));
  const count = Math.max(1, Math.ceil((right - left) / 16)),
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
      id = `wreck${w.id}:${i}`,
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
  if (world.wreckage.length >= 60) return;
  const x = s.x + s.w / 2,
    y = s.y + s.h / 2;
  world.wreckage.push({
    id: ++world.wreckSerial,
    x,
    y,
    w: Math.min(150, s.w),
    h: Math.min(90, s.h),
    angle: 0,
    hp: 120,
    kind,
    trapType: s.type || null,
    surface: s.surface || null,
    material: s.material || null,
    ice: !!s.ice,
    panel: s.panel || null,
    fieldId: f.riftId,
    originX: x,
    originY: y,
    originAngle: 0,
  });
}
function tear(world, f) {
  f.torn = true;
  const cut = { id: `rift${f.riftId}`, x: f.x, y: f.y, radius: f.radius };
  world.rifts.push({ ...cut, id: f.riftId, born: world.time });
  const retained = [],
    sources = [];
  for (const p of world.platforms) {
    if (p.wreckId) continue;
    const remains = carveRectangle(p, cut);
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
      Object.assign(w, {
        fieldId: f.riftId,
        originX: w.x,
        originY: w.y,
        originAngle: w.angle,
      });
  world.cover = world.cover.filter((p) => {
    if (carveRectangle(p, cut)[0] === p) return true;
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
  for (let n = 0; n < count; n++)
    addWreck(world, f, sources[Math.floor((n * sources.length) / count)]);
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
  if (world.phase !== "fight") return;
  f.tick -= dt;
  const pulse = f.tick <= 0;
  if (pulse) f.tick = 0.2;
  for (const p of [
    ...world.players.filter((p) => p.alive),
    ...world.drops,
    ...world.projectiles,
    ...world.debris,
  ]) {
    const dx = f.x - p.x,
      dy = f.y - p.y,
      d = Math.hypot(dx, dy);
    if (d > f.radius) continue;
    if (p.id !== undefined && d < SINGULARITY.core) {
      world.kill(p, { effect: "singularity", sourceX: f.x, sourceY: f.y });
      continue;
    }
    const nx = dx / Math.max(18, d),
      ny = dy / Math.max(18, d),
      force = (1 - d / f.radius) * 14500;
    p.vx = clamp((p.vx || 0) + (nx - ny * 0.22) * force * dt, -1700, 1700);
    p.vy = clamp((p.vy || 0) + (ny + nx * 0.22) * force * dt, -1700, 1700);
    if (p.id !== undefined) {
      carryImpulse(p, 0.25);
      p.ground = false;
      p.support = null;
    }
    if (p.id !== undefined && pulse && d < 290)
      world.hit(p, { x: f.x, y: f.y, vx: 0, vy: 0 }, 9, 0, 0, 0, {
        blast: true,
        effect: "singularity",
        hitstop: 0,
        stun: 0.01,
      });
  }
}
export function updateWreckage(world) {
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
    const f = world.fields.find(
      (f) =>
        f.kind === "blackhole" &&
        f.riftId === w.fieldId &&
        f.torn &&
        f.life > 0,
    );
    if (!f) continue;
    const t = clamp(
      (f.age - SINGULARITY.arm) / (SINGULARITY.duration - SINGULARITY.arm),
      0,
      1,
    );
    const ease = t * t * (3 - 2 * t),
      dx = w.originX - f.x,
      dy = w.originY - f.y;
    const orbit = Math.atan2(dy, dx) + ease * (1.7 + (w.id % 5) * 0.37);
    const radius = Math.hypot(dx, dy) * (1 - 0.35 * ease);
    w.x = f.x + Math.cos(orbit) * radius;
    w.y = f.y + Math.sin(orbit) * radius;
    w.angle = w.originAngle + ease * (Math.PI * 1.6 + (w.id % 4) * 0.5);
  }
  world.platforms = world.platforms.filter((p) => !p.wreckId);
  for (const w of world.wreckage) world.platforms.push(...wreckTiles(w, old));
}
