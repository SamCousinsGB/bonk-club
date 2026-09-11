// Flat arenas change the task from climbing for weapons to surviving machinery.
const slab = (x, y, w, material) => ({ x, y, w, h: 42, material, ...(material === "ice" ? { ice: true } : {}) });
const arena = (name, theme, color, kind, instruction, y, traps) => ({
  name, theme, color, survival: { kind, firstWeapon: 12, weaponInterval: 15 }, instruction,
  platforms: [slab(100, y, 2360, theme === "arctic" ? "ice" : "metal")],
  spawns: [530, 1030, 1530, 2030].map(x => [x, y - 42]),
  weapons: [], starterWeapons: [], cover: [], spikes: [], traps,
  hazards: [...new Set(traps.map(h => h.type))],
});
export const SURVIVAL_ARENAS = [
  arena("CARGO CONVEYOR", "factory", "#293c46", "cargo",
    "Jump incoming boxes. The conveyor pulls left.", 1080, [
      ...Array.from({ length: 7 }, (_, i) => ({ type: "conveyor", x: 270 + i * 335, y: 1080,
        w: 335, h: 20, dir: -1, beltSpeed: 155, beltForce: 220 })),
      { type: "loader", x: 2390, y: 1080, w: 140, h: 210, dir: -1 },
    ]),
  arena("PRESS FLOOR", "factory", "#423c40", "press",
    "Leave the lit lanes before the presses fall.", 1120,
    Array.from({ length: 6 }, (_, i) => ({ type: "crusher", x: 430 + i * 340, y: 1120,
      w: 220, h: 280, dir: i % 2 ? -1 : 1 }))),
  arena("ICE SWEEP", "arctic", "#294d65", "sweep",
    "Jump the sweeping saws. Allow room to brake on ice.", 1120, [
      { type: "saw", x: 1280, y: 1120, w: 2200, h: 160, dir: 1, motionSpeed: .65, motionPhase: -Math.PI / 2 },
      { type: "saw", x: 1280, y: 1120, w: 2200, h: 160, dir: -1, motionSpeed: .65, motionPhase: Math.PI / 2 },
    ]),
];
