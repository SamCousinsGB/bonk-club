const deck = (x, y, w, h = 20, extra = {}) => ({ x, y, w, h, material: "metal", ...(y < 1140 ? {oneWay:true} : {}), ...extra });
export const TURBINE_RADIUS = 246;
export const TURBINE_ARENA = {
  name: "TURBINE HALL", theme: "turbine", color: "#152b34", turbine: true,
  platforms: [
    ...Array.from({ length: 6 }, (_, i) => deck((i + .5) * 2560 / 6 - 28, 1420, 56, 20)),
    deck(40, 1070, 180), deck(370, 920, 140), deck(610, 1050, 195),
    deck(940, 890, 230), deck(1280, 1030, 110), deck(1530, 890, 230),
    deck(1810, 1050, 195), deck(2120, 920, 170), deck(2380, 1070, 140),
    deck(40, 810, 140), deck(2380, 810, 140),
    deck(170, 550, 150), deck(500, 650, 100), deck(820, 550, 110),
    deck(1140, 690, 100), deck(1460, 550, 110), deck(1780, 690, 100),
    deck(2100, 550, 110), deck(2380, 550, 140),
    // Maintenance galleries give fights room; narrow moving steps connect levels.
    deck(330, 340, 260), deck(1080, 400, 400), deck(1970, 340, 260),
    deck(690, 780, 110, 18, {move:55,speed:.6}),
    deck(1760, 780, 110, 18, {move:55,speed:.6}),
  ],
  spawns: [[130, 1028], [2450, 1028], [90, 768], [2470, 768]],
  weapons: [[1030, 860], [1630, 860]], starterWeapons: [],
  cover: [
    { x: 363, y: 272, w: 54, h: 68, kind: "barrel", hp: 75, maxHp: 75 },
    { x: 1370, y: 332, w: 54, h: 68, kind: "barrel", hp: 75, maxHp: 75 },
    { x: 2103, y: 272, w: 54, h: 68, kind: "barrel", hp: 75, maxHp: 75 },
  ],
  spikes: [], hazards: ["turbine"],
  traps: [
    ...Array.from({ length: 6 }, (_, i) => ({ type: "turbine", x: (i + .5) * 2560 / 6,
      y: 1420, w: TURBINE_RADIUS * 2, h: 276, dir: i % 2 ? -1 : 1 })),
  ],
};

// One recessed trough per rotor, with short collision strips matching its art.
// There is no floor spanning the arena. The sumps remain after machine damage.
export const turbineBedY = x => 1290 + 124 * Math.sin(Math.PI * Math.max(0, Math.min(2560, x)) / (2560 / 6)) ** 2;
export const TURBINE_BED = Array.from({length:96},(_,i) => {
  const x=i*2560/96,w=2560/96,y=turbineBedY(x+w/2);
  return {id:`hall-bed${i}`,x,y,w:w+.05,h:1600-y,material:"stone",boundary:true,dx:0,dy:0};
});
export const TURBINE_BOUNDS = [
  ...TURBINE_BED,
  { id: "hall-left", x: -80, y: -4000, w: 80, h: 5600 },
  { id: "hall-right", x: 2560, y: -4000, w: 80, h: 5600 },
].map(p => ({ ...p, material: "stone", boundary: true, dx: 0, dy: 0 }));
