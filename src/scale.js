// World units are independent of the display size and the fighters' skeletons.
export const W = 2560;
export const H = 1440;
export const RUN_SPEED = 240;
export const CRAWL_SPEED = 85;
export const GUARD_SPEED = 80;
export const SUDDEN_DEATH = 120;

// Keep the older arenas' lower geometry, then add connected upper routes.
// Heights between landings stay within the existing double jump's reach.
export function expandArena(arena) {
  const platforms = arena.platforms.map((p) => ({
    ...p,
    x: p.x * 2,
    y: p.y + 660,
    w: p.w * 2,
    ...(p.move ? { move: p.move * 2 } : {}),
  }));
  for (const [row, y] of [220, 540, 860].entries()) {
    const shift = row % 2 ? 60 : 0;
    for (const x of [160, 980, 1800])
      platforms.push({
        x: x + shift,
        y,
        w: 540,
        h: 22,
        ...(arena.name === "ICE" ? { ice: true } : {}),
      });
    // Short landings split the wide gaps, so crossing needs no long run-up.
    for (const x of [780, 1600])
      platforms.push({ x: x + shift, y: y + 160, w: 120, h: 18 });
  }
  for (const y of [310, 490, 670, 850, 1030, 1210])
    for (const x of [40, 2440]) platforms.push({ x, y, w: 80, h: 18 });
  const cover = platforms
    .filter((p) => p.w >= 400 && !p.move)
    .map((p) => ({
      x: p.x + p.w / 2 - 45,
      y: p.y - 50,
      w: 90,
      h: 50,
      hp: 75,
      maxHp: 75,
      kind: "table",
    }));
  return {
    ...arena,
    platforms,
    cover,
    spawns: [
      [230, 818],
      [2320, 818],
      [230, 178],
      [2320, 178],
    ],
    spikes: arena.spikes.map((s) => ({
      ...s,
      x: s.x * 2,
      y: s.y + 660,
      w: s.w * 2,
    })),
    weapons: [
      [560, 772, "railgun"],
      [2040, 772, "barrage"],
      [1230, 452, "minigun"],
      [1230, 202, "plasma"],
    ],
  };
}
