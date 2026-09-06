import { H } from "./scale.js";
const floor = (x, y, w) => ({ x, y, w, h: 22, material: "concrete" });
const lift = (x, y, w, travel, speed = 0.28) => ({
  x,
  y,
  w,
  h: 18,
  travel,
  speed,
  elevator: true,
});
const table = (x, y) => ({
  x,
  y: y - 50,
  w: 90,
  h: 50,
  hp: 75,
  maxHp: 75,
  kind: "table",
});
const tower = (x, y, w) => ({ x, y, w, h: H + 160 - y });
const floors = [1300, 1120, 940, 760, 580, 400, 220];

function building({
  name,
  color,
  towers,
  rooms,
  elevators,
  bridges = [],
  spikes = [],
}) {
  const platforms = [],
    cover = [];
  for (const [i, y] of floors.entries()) {
    for (const [x, w] of rooms(i)) {
      platforms.push(floor(x, y, w));
      // Leave both exits clear; furniture creates several breakable sightlines.
      for (let tx = x + 170; tx + 130 < x + w; tx += 260)
        cover.push(table(tx, y));
    }
  }
  // Outside landings offer a second way up without waiting for a lift.
  for (const y of floors.slice(0, -1))
    platforms.push(floor(30, y - 90, 80), floor(2450, y - 90, 80));
  platforms.push(...elevators, ...bridges);
  return {
    name,
    color,
    city: true,
    towers,
    platforms,
    cover,
    spikes,
    spawns: [
      [220, 900],
      [2340, 900],
      [220, 360],
      [2340, 360],
    ],
    weapons: [
      [560, 922, "minigun"],
      [2070, 922, "barrage"],
      [550, 382, "railgun"],
      [2060, 382, "plasma"],
      [560, 1282, "shotgun"],
      [2060, 1282, "rocket"],
      [550, 202, "plasma"],
      [2060, 202, "railgun"],
    ],
  };
}

export const SKYSCRAPERS = [
  building({
    name: "OFFICE TOWER",
    color: "#213341",
    towers: [tower(130, 100, 2300)],
    rooms: () => [
      [130, 570],
      [860, 740],
      [1760, 670],
    ],
    elevators: [lift(720, 1300, 120, -1080), lift(1620, 220, 120, 1080)],
  }),
  building({
    name: "TWIN TOWERS",
    color: "#293347",
    towers: [tower(130, 100, 870), tower(1560, 100, 870)],
    rooms: () => [
      [130, 870],
      [1560, 870],
    ],
    elevators: [lift(1020, 1300, 140, -1080), lift(1400, 220, 140, 1080)],
    bridges: [
      floor(1180, 1120, 200),
      floor(1180, 760, 200),
      floor(1180, 400, 200),
    ],
    spikes: [{ x: 1010, y: 1420, w: 540 }],
  }),
  building({
    name: "CONSTRUCTION SITE",
    color: "#383b3c",
    towers: [tower(130, 120, 570), tower(900, 90, 700), tower(1860, 120, 570)],
    rooms: (i) => [
      [130, i % 2 ? 520 : 550],
      [900 + (i % 2) * 60, 640],
      [1860, 570],
    ],
    elevators: [
      lift(720, 1300, 140, -1080, 0.32),
      lift(1680, 220, 140, 1080, 0.32),
    ],
    spikes: [
      { x: 700, y: 1420, w: 180 },
      { x: 1640, y: 1420, w: 200 },
    ],
  }),
  building({
    name: "SKYBRIDGE",
    color: "#2b354a",
    towers: [tower(130, 100, 690), tower(1740, 100, 690)],
    rooms: (i) => [[130, 690], ...(i % 2 ? [[1040, 480]] : []), [1740, 690]],
    elevators: [lift(860, 1300, 140, -1080), lift(1560, 220, 140, 1080)],
    bridges: [
      floor(1160, 1300, 240),
      floor(1160, 940, 240),
      floor(1160, 580, 240),
      floor(1160, 220, 240),
    ],
    spikes: [{ x: 830, y: 1420, w: 900 }],
  }),
];
