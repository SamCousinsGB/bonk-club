import { planeHull } from "./plane.js";
const solid = (x, y, w, h = 42, extra = {}) => ({ x, y, w, h, material: "metal", ...extra });
const grate = (x, y, w, extra = {}) => ({ x, y, w, h: 16, material: "metal", oneWay: true, ...extra });


export const CARGO_PLANE_ARENA = {
  name: "CARGO PLANE HOLD",
  theme: "cargo-plane",
  color: "#263744",
  cargoPlane: true,
  compactSetpiece: "cargo-plane",
  platforms: [
    ...planeHull(),
    solid(870, 1150, 820, 26),
    grate(550, 910, 460), grate(1550, 910, 460),
    grate(760, 660, 400), grate(1400, 660, 400),
    grate(1040, 410, 480),
    solid(100, 700, 420, 24), solid(2040, 700, 420, 24),
  ],
  spawns: [[680, 878], [1880, 878], [900, 628], [1660, 628]],
  weapons: [[1170, 378], [1390, 378]],
  starterWeapons: [],
  spikes: [],
  cover: [
    { x: 910, y: 1068, w: 118, h: 82, kind: "crate", hp: 95, maxHp: 95, strapped: true, strapHp: 18 },
    { x: 1100, y: 1080, w: 128, h: 70, kind: "pallet", hp: 70, maxHp: 70, strapped: true, strapHp: 18 },
    { x: 1350, y: 1060, w: 132, h: 90, kind: "crate", hp: 100, maxHp: 100, strapped: true, strapHp: 22 },
    { x: 1500, y: 1078, w: 135, h: 72, kind: "pallet", hp: 75, maxHp: 75, strapped: true, strapHp: 20 },
  ],
  hazards: ["airflow", "turbine"],
  traps: [
    { type: "airflow", x: 1280, y: 710, w: 300, h: 240, dir: 1 },
    { type: "turbine", x: 275, y: 935, w: 250, h: 250, dir: 1 },
    { type: "turbine", x: 2285, y: 935, w: 250, h: 250, dir: -1 },
  ],
};

const washFloor = Array.from({ length: 8 }, (_, i) => solid(i * 320, 1160, 320, 50, {
  washFloor: true,
  ice: true,
}));

export const CAR_WASH_ARENA = {
  name: "CAR WASH",
  theme: "car-wash",
  color: "#24414b",
  carWash: true,
  compactSetpiece: "car-wash",
  platforms: [
    ...washFloor,
    grate(60, 830, 560),
    grate(760, 760, 420),
    grate(1380, 760, 420),
    grate(1940, 830, 560),
    grate(1080, 480, 400),
    grate(80, 510, 300),
    grate(2180, 510, 300),
  ],
  spawns: [[170, 798], [2390, 798], [1140, 448], [1420, 448]],
  weapons: [[940, 728], [1620, 728]],
  starterWeapons: [],
  spikes: [],
  cover: [
    { x: 180, y: 1060, w: 250, h: 100, kind: "car", hp: 200, maxHp: 200, mass: 200,
      carStage: 31, carPaint: 2, carCoat: 1 },
    { x: 380, y: 772, w: 82, h: 58, kind: "trolley", hp: 75, maxHp: 75 },
    { x: 2090, y: 772, w: 82, h: 58, kind: "trolley", hp: 75, maxHp: 75 },
    { x: 1190, y: 1092, w: 54, h: 68, kind: "barrel", hp: 75, maxHp: 75 },
  ],
  hazards: ["carwash", "conveyor"],
  traps: [
    { type: "carwash", x: 1280, y: 1160, w: 360, h: 300, dir: 1 },
    ...[430, 850, 1270, 1690, 2110].map((x, i) => ({
      type: "conveyor", x, y: 1160, w: 400, h: 20, dir: 1,
      beltSpeed: 320, beltForce: 980,
    })),
  ],
};
