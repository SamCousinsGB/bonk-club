const deck = (x, y, w, h = 24, extra = {}) => ({ x, y, w, h, material: "metal", ...extra });
export const LINE_Y = 1190;
export const LINE_CYCLE = 8;
export const LINE_DWELL = 3;
export const LINE_PITCH = 600;
export const LINE_SPEED = LINE_PITCH / (LINE_CYCLE - LINE_DWELL);
export const STATIONS = [640, 1240, 1840];

// A low production floor with separate machine-top and maintenance routes.
// The press opening and robot workspaces are clear of fixed support pillars.
export const ASSEMBLY_ARENA = {
  name: "CAR ASSEMBLY", theme: "factory", color: "#182630", assembly: true,
  platforms: [
    ...Array.from({ length: 26 }, (_, i) => deck(i * 100, LINE_Y, Math.min(100, 2560 - i * 100), 38, { assemblyBelt: true })),
    deck(50, 970, 300), deck(2210, 970, 300),
    deck(350, 840, 160), deck(800, 840, 180),
    deck(1050, 840, 380, 32, { assemblyMount: 2 }), deck(1620, 840, 440, 32, { assemblyMount: 3 }),
    deck(480, 740, 320, 48, { assemblyMount: 1 }),
    deck(70, 640, 280), deck(2210, 640, 280),
    deck(420, 490, 340), deck(970, 490, 280), deck(1460, 490, 280), deck(1950, 490, 230),
  ],
  spawns: [[160, 928], [2400, 928], [180, 598], [2380, 598]],
  weapons: [[900, 810], [1510, 460]], starterWeapons: [],
  cover: [], spikes: [], hazards: ["crusher", "tesla"],
  traps: STATIONS.map((x, i) => ({ type: i === 0 ? "crusher" : "tesla", x, y: LINE_Y,
    w: 280, h: 300, dir: 1, assemblyStation: i + 1 })),
};
