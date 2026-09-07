// Selected floor panels can be shot out. Structural supports, stairs and lifts remain solid.
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
