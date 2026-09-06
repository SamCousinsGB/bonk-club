// Combat fixtures have a known clear floor, independent of level layout changes.
export function combatFloor(w) {
  w.platforms = [
    {
      id: "floor0",
      x: 80,
      y: 565,
      w: 2400,
      h: 30,
      baseX: 80,
      baseY: 565,
      dx: 0,
      dy: 0,
    },
  ];
  w.cover = [];
  w.drops = [];
  w.weaponTimer = 999;
}
