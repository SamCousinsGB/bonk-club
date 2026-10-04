import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS } from '../src/engine.js';
import { addSpill, addWater, updateReactions } from '../src/reactions.js';
import { prepareProp } from '../src/props.js';
import { corrodeTerrain } from '../src/terrain.js';
import { validSnapshot, encodeState, decodeState } from '../src/network.js';
import { RenderSnapshots } from '../src/render-state.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';

const floor = (id, y, h = 24, extra = {}) =>
  ({ id, x: 0, y, w: 2560, h, baseX: 0, baseY: y, dx: 0, dy: 0, ...extra });
const area = (w, id) => w.platforms.filter(p => (p.sourceId || p.id) === id).reduce((n, p) => n + p.w * p.h, 0);
const tick = (w, t = .05) => { for (let n = 0; n < Math.ceil(t / .05); n++) { w.time += .05; updateReactions(w, .05); } };
function lab() {
  const w = new World({ players: [0, 1], shuffle: false, random: () => .5 });
  Object.assign(w, { phase: 'fight', cover: [], chunks: [], hazards: [], cables: [], water: [], spills: [], gas: [],
    drops: [], platforms: [floor('top', 500, 48), floor('middle', 800), floor('bottom', 1120)],
    arena: { ...w.arena, spikes: [] } });
  for (const p of w.players) Object.assign(p, { x: 2200 + p.id * 140, y: 1080, spawnShield: 0 });
  addSpill(w, 'acid', 1280, 500, 180);
  return w;
}

test('acid eats through stacked floors in contact order and reaches props and fighters below', () => {
  const w = lab(), top = area(w, 'top'), middle = area(w, 'middle'), bottom = area(w, 'bottom');
  const b = prepareProp({ id: 'lower-stone', kind: 'stone', x: 1220, y: 1070, w: 160, h: 50, hp: 85, maxHp: 85 });
  w.cover = [b]; Object.assign(w.players[0], { x: 1320, y: 1090 });
  const volume = w.spills.reduce((n, q) => n + q.h, 0);
  tick(w);
  assert.ok(area(w, 'top') < top); assert.equal(area(w, 'middle'), middle); assert.equal(area(w, 'bottom'), bottom);
  assert.equal(b.hp, 85); assert.equal(w.players[0].hp, 100);
  let reachedMiddle = false, reachedBottom = false;
  for (let n = 0; n < 360; n++) {
    tick(w);
    reachedMiddle ||= area(w, 'middle') < middle;
    reachedBottom ||= area(w, 'bottom') < bottom;
    assert.ok(validSnapshot(w.snapshot()), `snapshot at ${w.time}`);
    assert.ok(w.spills.reduce((n, q) => n + q.h, 0) <= volume + 1e-6);
  }
  assert.ok(reachedMiddle, 'liquid must descend through the first floor');
  assert.ok(reachedBottom, 'liquid must descend through the next floor');
  assert.ok(b.hp < 85, 'lower stone prop corrodes'); assert.ok(w.players[0].hp < 100, 'lower fighter is exposed');
  assert.ok(w.platforms.some(p => p.x < 300 && p.x + p.w > 300 && p.y === 500), 'distant floor stays intact');
  assert.equal(w.craters.length, 0); assert.equal(w.debris.length, 0, 'corrosion does not emit explosion chips');
});

test('all arena floor materials corrode locally, with real cuts and released supports', () => {
  for (const material of ['metal', 'stone', 'wood', 'glass', 'ice', undefined]) {
    const w = lab(); w.platforms = [floor('surface', 500, 40, { material, travel: 120, elevator: true })];
    Object.assign(w.players[1], { support: 'surface', ground: true });
    tick(w);
    assert.ok(area(w, 'surface') < 2560 * 40, String(material));
    assert.ok(w.platforms.every(p => !p.travel && !p.elevator));
    assert.equal(w.players[1].support, null); assert.equal(w.players[1].ground, false);
    assert.ok(w.terrainVersion > 0);
  }
});

test('water and coolant prevent a first-tick floor bite, expired acid and guest prediction cannot carve', () => {
  for (const mode of ['water', 'coolant', 'expired', 'prediction']) {
    const w = lab(), before = structuredClone(w.platforms);
    if (mode === 'water') addWater(w, 1280, 500, 180);
    if (mode === 'coolant') addSpill(w, 'coolant', 1280, 500, 180);
    if (mode === 'expired') w.spills.forEach(q => q.life = .01);
    if (mode === 'prediction') w.prediction = true;
    tick(w); assert.deepEqual(w.platforms, before, mode);
  }
});

test('corrosion damages the owner of wreck collision instead of a disposable collision strip', () => {
  const w = lab(), b = { id: 1, hp: 16 };
  w.wreckage = [b]; w.platforms = [floor('wreck-strip', 500, 20, { wreckId: 1, hp: 16, destructible: true })];
  const q = w.spills[0]; q.grounded = true;
  corrodeTerrain(w, [q]); assert.equal(b.hp, 8); assert.ok(w.wreckDirty);
  w.time += .4; q.grounded = true; corrodeTerrain(w, [q]); assert.equal(b.hp, 0);
  assert.ok(w.platforms.every(p => p.hp === 0));
});

test('melted world and falling acid survive compact hot join; round reset restores map terrain', async () => {
  const w = lab(); tick(w, 6);
  assert.ok(area(w, 'middle') < 2560 * 24);
  const s = new RenderSnapshots().make(w.snapshot()); assert.ok(validSnapshot(s));
  const joined = expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))), validSnapshot);
  for (const key of ['spills', 'platforms', 'cover', 'gas']) assert.deepEqual(joined[key], JSON.parse(JSON.stringify(s[key])));
  w.startRound(); assert.equal(w.spills.length, 0);
  assert.equal(w.platforms.length, ARENAS[w.arenaIndex].platforms.length);
  assert.ok(w.platforms.every(p => !p.sourceId && p.id.startsWith('floor')));
});

test('a large acid spill remains bounded throughout its lifetime', () => {
  const w = lab(); w.platforms = [floor('rock', 500, 700)]; addSpill(w, 'acid', 1280, 500, 10000);
  let peak = 0;
  for (let n = 0; n < 620; n++) {
    tick(w); peak = Math.max(peak, w.platforms.length);
    if (n % 10 === 0) assert.ok(validSnapshot(w.snapshot()), `snapshot ${n}: ${w.platforms.length} pieces`);
  }
  assert.ok(peak <= 1400, `peak ${peak}`); assert.equal(w.spills.length, 0);
});
