// Mount positions are shared by the solver and the insulator/electrode artwork.
export const CABLE_SEGMENTS = 24;
export const TOWER_MOUNTS = [440, 860].map(y => [
  { x: 770, y: y + 70, supportY: y },
  { x: 1790, y: y + 70, supportY: y },
]);
export const CABLE_LAYOUTS = [
  ...TOWER_MOUNTS.map(([a, b], index) => ({ id: `tower${index}`, kind: "tower", index, a, b, sag: 92 })),
  ...[-1, 1].flatMap((side, n) => [0, 1, 2].map(index => ({
    id: `furnace${n * 3 + index}`, kind: "furnace", side, index,
    a: { x: side < 0 ? 70 : 2490, y: 210 + index * 72 },
    b: { x: 1280 + side * (245 - index * 30), y: 585 + index * 44 },
    sag: 195 + index * 24,
  }))),
];
export const cableLayout = id => CABLE_LAYOUTS.find(c => c.id === id);
