const deck = (x, y, w, h = 24, extra = {}) => ({ x, y, w, h, material: "metal", ...(h === 24 ? {oneWay:true} : {}), ...extra });
export const LINE_Y = 1190;
export const LINE_CYCLE = 8;
export const LINE_PITCH = 600;
export const LINE_SPEED = LINE_PITCH / LINE_CYCLE;
export const STATIONS = [500, 1020, 1560, 2120];

// A low production floor with separate machine-top and maintenance routes.
// The press opening and robot workspaces are clear of fixed support pillars.
export const ASSEMBLY_ARENA = {
  name: "CAR ASSEMBLY", theme: "factory", color: "#182630", assembly: true,
  platforms: [
    ...Array.from({ length: 26 }, (_, i) => deck(i * 100, LINE_Y, Math.min(100, 2560 - i * 100), 38, { assemblyBelt: true })),
    // End access landings climb into a suspended maintenance gallery.
    deck(50, 970, 270), deck(2240, 970, 270),
    deck(230, 825, 190), deck(2140, 825, 190),
    deck(55, 665, 230), deck(2275, 665, 230),
    deck(340, 565, 390), deck(860, 565, 400),
    deck(1390, 565, 400), deck(1920, 565, 380),
    // These are real machine crowns, also usable as the lower crossing route.
    deck(340, 740, 320, 48, { assemblyMount: 1 }),
    deck(830, 840, 380, 32, { assemblyMount: 2 }),
    deck(1340, 840, 440, 32, { assemblyMount: 3 }),
    deck(1910, 780, 410, 40, { assemblyMount: 4 }),
  ],
  spawns: [[160, 928], [2400, 928], [170, 623], [2390, 623]],
  weapons: [[1020, 535], [1590, 535]], starterWeapons: [],
  cover: [], spikes: [], hazards: ["crusher", "tesla"],
  traps: STATIONS.map((x, i) => ({ type: i === 0 ? "crusher" : "tesla", x, y: LINE_Y,
    w: 280, h: 300, dir: 1, assemblyStation: i + 1 })),
};
