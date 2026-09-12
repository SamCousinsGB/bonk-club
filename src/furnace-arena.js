import { dressArena } from "./arena-dressing.js";

export const FURNACE_CYCLE = 16;
export const FURNACE_WARNING = 9;
export const FURNACE_ON = 11;
export const FURNACE_COOLING = 2.5;
const deck = (x, y, w, h = 24) => ({ x, y, w, h, material: "metal" });

// The central grate is the only route between the two galleries. Everything
// above it (electrodes, cables, extraction hood and arcs) is pass-through art.
export const FURNACE_ARENA = dressArena({
  name: "ARC FURNACE", theme: "furnace", color: "#161b26", furnace: true,
  platforms: [
    deck(260, 1240, 640, 32), deck(1660, 1240, 640, 32),
    deck(260, 1000, 720), deck(1580, 1000, 720), deck(980, 1000, 600, 18),
    deck(280, 660, 560), deck(1720, 660, 560),
    deck(40, 830, 160), deck(800, 830, 180),
    deck(1580, 830, 180), deck(2360, 830, 160),
    deck(40, 1110, 160),
    deck(2360, 1110, 160),
    deck(480, 450, 300), deck(1780, 450, 300),
    deck(850, 1420, 860, 20),
  ],
  spawns: [[280, 1198], [2280, 1198], [390, 618], [2170, 618]],
  cover: [], weapons: [], spikes: [], hazards: ["furnace", "slag"],
  traps: [
    { type: "furnace", x: 1280, y: 1000, w: 460, h: 1250, dir: 1 },
    { type: "slag", x: 1280, y: 1420, w: 860, h: 64, dir: -1 },
  ],
});
