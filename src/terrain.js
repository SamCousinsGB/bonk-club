import { carveRectangle } from "./nuclear.js";

// Panel materials remain part of the maps. Every surface is blast-carvable;
// bullets do not remove terrain, including the wood and glass sections.
export function preparePlatforms(arena, arenaIndex) {
  const candidates = arena.platforms
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        p.w >= 280 &&
        p.y >= 280 &&
        p.y <= 1250 &&
        !p.travel &&
        !p.move &&
        !p.elevator,
    );
  const selected = new Set(
    candidates
      .sort(
        (a, b) =>
          ((a.i * 17 + arenaIndex * 13) % 41) -
          ((b.i * 17 + arenaIndex * 13) % 41),
      )
      .slice(0, 6)
      .map(({ i }) => i),
  );
  const glass =
    ["hospital", "arctic"].includes(arena.theme) ||
    (arenaIndex >= 8 && arenaIndex <= 11);
  const panel = (p) => ({
    ...p,
    destructible: true,
    panel: glass ? "glass" : "wood",
    hp: glass ? 65 : 100,
    maxHp: glass ? 65 : 100,
  });
  return arena.platforms.flatMap((p, i) => {
    if (!selected.has(i)) return [{ ...p }];
    const width = Math.min(190, p.w * 0.42),
      side = (p.w - width) / 2;
    return [
      { ...p, w: side },
      panel({ ...p, x: p.x + side, w: width }),
      { ...p, x: p.x + side + width, w: side },
    ];
  });
}

export function carveExplosion(world, blast) {
  const cut = { ...blast, id: `blast${++world.terrainSerial}` };
  let changed = false;
  const removedWreck = new Set();
  const pieces = [];
  for (const p of world.platforms) {
    if (p.hp === 0) continue;
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
  const traps = world.hazards.length;
  world.hazards = world.hazards.filter(h => {
    const box = {
    x: h.bodyX - h.w / 4, y: h.bodyY - 16, w: h.w / 2, h: 32,
    };
    return carveRectangle(box, cut)[0] === box;
  });
  changed ||= traps !== world.hazards.length;
  if (!changed) return;
  world.terrainVersion++;
  const ids = new Set(world.solids().map(s => s.id));
  for (const p of world.players) if (p.support && !ids.has(p.support)) {
    p.support = null; p.ground = false; p.coyote = 0;
  }
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
