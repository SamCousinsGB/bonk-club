import { planeHull } from "./plane.js";
import { carShape } from "./assembly-geometry.js";
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
    solid(820, 1150, 920, 26),
    grate(520, 910, 490), grate(1550, 910, 490),
    grate(730, 660, 430), grate(1400, 660, 430),
    grate(1040, 410, 480),
    solid(50, 700, 440, 32), solid(2070, 700, 440, 32),
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
    solid(0, 1070, 42, 90), solid(2518, 1070, 42, 90),
    grate(70, 910, 380), grate(2110, 910, 380),
    grate(590, 800, 360), grate(1450, 800, 360),
    grate(1050, 650, 400),
    grate(120, 630, 290), grate(2150, 630, 290),
    grate(570, 410, 400), grate(1580, 410, 400),
    grate(1080, 240, 400),
  ],
  spawns: [[190, 878], [2370, 878], [710, 378], [1840, 378]],
  weapons: [[1160, 618], [1390, 208]],
  starterWeapons: [],
  spikes: [],
  cover: [
    { x: 180, y: 1026, w: 250, h: 134, kind: "car", hp: 200, maxHp: 200, mass: 200,
      carStage: 31, carPaint: 2, carCoat: 1, shape: carShape(31) },
    { x: 310, y: 852, w: 82, h: 58, kind: "trolley", hp: 75, maxHp: 75 },
    { x: 2170, y: 852, w: 82, h: 58, kind: "trolley", hp: 75, maxHp: 75 },
    { x: 1300, y: 582, w: 54, h: 68, kind: "waterTank", hp: 75, maxHp: 75 },
  ],
  hazards: ["carwash", "conveyor"],
  traps: [
    { type: "carwash", x: 1280, y: 1160, w: 360, h: 300, dir: 1 },
    ...Array.from({length: 7}, (_, i) => ({
      type: "conveyor", x: 200 + i * 360, y: 1160, w: 360, h: 20, dir: 1,
      beltSpeed: 320, beltForce: 980,
    })),
  ],
};
