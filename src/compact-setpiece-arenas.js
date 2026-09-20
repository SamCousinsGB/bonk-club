const solid = (x, y, w, h = 42, extra = {}) => ({ x, y, w, h, material: "metal", ...extra });
const grate = (x, y, w, extra = {}) => ({ x, y, w, h: 16, material: "metal", oneWay: true, ...extra });

const cargoFloor = Array.from({ length: 8 }, (_, i) => solid(i * 320, 1160, 320, 50, {
  cargoFloor: true,
}));

export const CARGO_PLANE_ARENA = {
  name: "CARGO PLANE HOLD",
  theme: "cargo-plane",
  color: "#263744",
  cargoPlane: true,
  compactSetpiece: "cargo-plane",
  platforms: [
    ...cargoFloor,
    grate(80, 840, 520),
    grate(720, 780, 420),
    grate(1420, 780, 420),
    grate(1960, 840, 520),
    grate(1040, 500, 480),
    grate(20, 570, 280),
    grate(2260, 570, 280),
  ],
  spawns: [[170, 1128], [2390, 1128], [210, 808], [2350, 808]],
  weapons: [[930, 748], [1630, 748]],
  starterWeapons: [],
  spikes: [],
  cover: [
    { x: 390, y: 1078, w: 118, h: 82, kind: "crate", hp: 95, maxHp: 95, strapped: true, strapHp: 18 },
    { x: 760, y: 1090, w: 128, h: 70, kind: "pallet", hp: 70, maxHp: 70, strapped: true, strapHp: 18 },
    { x: 1665, y: 1070, w: 132, h: 90, kind: "crate", hp: 100, maxHp: 100, strapped: true, strapHp: 22 },
    { x: 2030, y: 1088, w: 135, h: 72, kind: "pallet", hp: 75, maxHp: 75, strapped: true, strapHp: 20 },
  ],
  hazards: ["airflow", "conveyor"],
  traps: [
    { type: "airflow", x: 1680, y: 1160, w: 300, h: 240, dir: 1 },
    { type: "conveyor", x: 1280, y: 1160, w: 320, h: 20, dir: 1, beltSpeed: 280, beltForce: 760 },
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
