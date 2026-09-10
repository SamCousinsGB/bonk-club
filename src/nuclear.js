import { NUCLEAR } from "./impact.js";

export const inBlast = (p, f, radius = f.radius) =>
  Math.hypot(p.x - f.x, p.y - f.y) <= radius;

// Thin horizontal slices follow the circular cut to within 8 units without
// leaving invisible collision inside the crater. Intact elevators keep moving.
export function carveRectangle(s, f) {
  const nearX = Math.max(s.x, Math.min(s.x + s.w, f.x));
  const nearY = Math.max(s.y, Math.min(s.y + s.h, f.y));
  if (!inBlast({ x: nearX, y: nearY }, f)) return [s];
  const pieces = [];
  const add = (x, y, w, h) => {
    if (w < 0.5 || h < 0.5) return;
    const previous = pieces.at(-1);
    if (
      previous &&
      previous.x === x &&
      previous.w === w &&
      Math.abs(previous.y + previous.h - y) < 0.001
    ) {
      previous.h += h;
      return;
    }
    pieces.push({
      ...s,
      id: `${s.id}:c${f.id}:${pieces.length}`,
      x,
      y,
      w,
      h,
      baseX: x,
      baseY: y,
      dx: 0,
      dy: 0,
      move: undefined,
      travel: undefined,
      elevator: false,
    });
  };
  for (let y = s.y; y < s.y + s.h; y += 8) {
    const h = Math.min(8, s.y + s.h - y);
    const dy = Math.max(y - f.y, f.y - y - h, 0);
    if (dy >= f.radius) {
      add(s.x, y, s.w, h);
      continue;
    }
    const span = Math.sqrt(f.radius ** 2 - dy ** 2);
    const left = Math.max(s.x, Math.min(s.x + s.w, f.x - span));
    const right = Math.max(s.x, Math.min(s.x + s.w, f.x + span));
    add(s.x, y, left - s.x, h);
    add(right, y, s.x + s.w - right, h);
  }
  return pieces;
}

export function nuclearField(world, b) {
  const crater = {
    id: ++world.craterSerial,
    x: b.x,
    y: b.y,
    radius: NUCLEAR.coreRadius,
    born: world.time,
  };
  world.craters.push(crater);
  return {
    kind: "shockwave",
    x: b.x,
    y: b.y,
    ex: b.x,
    ey: b.y,
    radius: NUCLEAR.waveRadius,
    life: NUCLEAR.duration,
    age: 0,
    owner: b.owner,
    craterId: crater.id,
    melted: false,
    hitIds: [],
  };
}

export function updateNuclear(world, f, dt) {
  const previousAge = f.age;
  f.age += dt;
  const radius = Math.min(f.radius, f.age * NUCLEAR.waveSpeed);
  // The flash is lethal, including to its owner. The cooled hole is safe to
  // traverse afterwards; it is not a lingering invisible damage field.
  if (world.phase === "fight" && previousAge <= NUCLEAR.meltAt) {
    for (const p of world.players) {
      if (!p.alive || f.hitIds.includes(p.id) || !inBlast(p, f, radius))
        continue;
      f.hitIds.push(p.id);
      world.kill(p, { ash: true, sourceX: f.x });
    }
    for (const rag of world.ragdolls) {
      if (rag.ash || !inBlast(rag.points[2], f, radius)) continue;
      Object.assign(rag, {
        ash: true,
        ashAge: 0,
        life: NUCLEAR.ashDuration,
        ashDirection: Math.sign(rag.points[2].x - f.x) || 1,
      });
      // Nuclear heat consumes other death poses too, including severed halves.
      rag.points = rag.points.slice(0, 11);
      delete rag.effect;
      delete rag.deathAge;
      delete rag.stretchOrigin;
      delete rag.strands;
      delete rag.anchor;
      delete rag.severed;
      for (const p of rag.points) {
        p.px = p.x;
        p.py = p.y;
      }
    }
  }
  if (!f.melted && f.age >= NUCLEAR.meltAt) {
    f.melted = true;
    const crater = world.craters.find((c) => c.id === f.craterId);
    world.wreckage = world.wreckage.filter((w) => {
      if (!w.outline)
        return (
          Math.hypot(w.x - f.x, w.y - f.y) > f.radius + Math.hypot(w.w, w.h) / 2
        );
      return w.outline.every((a, i) => {
        const b = w.outline[(i + 1) % w.outline.length],
          dx = b.x - a.x,
          dy = b.y - a.y,
          t = Math.max(
            0,
            Math.min(
              1,
              ((f.x - a.x) * dx + (f.y - a.y) * dy) / (dx * dx + dy * dy || 1),
            ),
          );
        return !inBlast({ x: a.x + dx * t, y: a.y + dy * t }, f);
      });
    });
    world.wreckDirty = true;
    world.platforms = world.platforms
      .filter(
        (p) => !p.wreckId || world.wreckage.some((w) => w.id === p.wreckId),
      )
      .flatMap((s) => carveRectangle(s, crater));
    // Props and trap mechanisms are consumed, not launched into a chain of
    // explosions across the rest of the arena.
    world.cover = world.cover.filter((s) => carveRectangle(s, crater)[0] === s);
    world.hazards = world.hazards.filter(
      (h) => !inBlast(h, f) && !inBlast({ x: h.bodyX, y: h.bodyY }, f),
    );
    for (const key of ["drops", "projectiles", "debris", "blood"])
      world[key] = world[key].filter((p) => !inBlast(p, f));
    world.terrainVersion++;
    for (const p of world.players)
      if (!world.solids().some((s) => s.id === p.support)) {
        p.support = null;
        p.ground = false;
      }
  }
}
