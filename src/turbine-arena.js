const deck = (x, y, w, h = 20) => ({ x, y, w, h, material: "metal" });
export const TURBINE_RADIUS = 246;
export const TURBINE_ARENA = {
  name: "TURBINE HALL", theme: "turbine", color: "#152b34", turbine: true,
  platforms: [
    ...Array.from({ length: 6 }, (_, i) => deck(i * 2560 / 6, 1420, 2560 / 6, 20)),
    deck(40, 1070, 180), deck(370, 920, 100), deck(645, 1050, 145),
    deck(980, 890, 100), deck(1280, 1030, 110), deck(1580, 890, 100),
    deck(1880, 1050, 110), deck(2190, 920, 100), deck(2380, 1070, 140),
    deck(40, 810, 140), deck(2380, 810, 140),
    deck(170, 550, 150), deck(500, 650, 100), deck(820, 550, 110),
    deck(1140, 690, 100), deck(1460, 550, 110), deck(1780, 690, 100),
    deck(2100, 550, 110), deck(2380, 550, 140),
    // Short steel suspension mounts; the heavy hanging conductors are pass-through.
    deck(340, 340, 100), deck(1010, 340, 100),
    deck(1510, 340, 100), deck(2180, 340, 100),
  ],
  spawns: [[130, 1028], [2450, 1028], [90, 768], [2470, 768]],
  weapons: [[1030, 860], [1630, 860]], starterWeapons: [],
  cover: [
    { x: 363, y: 272, w: 54, h: 68, kind: "barrel", hp: 75, maxHp: 75 },
    { x: 1533, y: 272, w: 54, h: 68, kind: "barrel", hp: 75, maxHp: 75 },
    { x: 2203, y: 272, w: 54, h: 68, kind: "barrel", hp: 75, maxHp: 75 },
  ],
  spikes: [], hazards: ["turbine", "powerline"],
  traps: [
    ...Array.from({ length: 6 }, (_, i) => ({ type: "turbine", x: (i + .5) * 2560 / 6,
      y: 1420, w: TURBINE_RADIUS * 2, h: 276, dir: i % 2 ? -1 : 1 })),
    ...[720, 1890].map((x, circuit) => ({ type: "powerline", circuit, x, y: 690, w: 670, h: 300, dir: circuit ? -1 : 1 })),
  ],
};

// The concrete sump and outer walls are arena boundaries, independent of the
// destructible decks and machines. Destroying a rotor leaves a contained pit.
export const TURBINE_BOUNDS = [
  { id: "hall-bottom", x: -80, y: 1428, w: 2720, h: 400 },
  { id: "hall-left", x: -80, y: -4000, w: 80, h: 5428 },
  { id: "hall-right", x: 2560, y: -4000, w: 80, h: 5428 },
].map(p => ({ ...p, material: "stone", boundary: true, dx: 0, dy: 0 }));
