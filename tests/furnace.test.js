import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateHazards } from "../src/hazards.js";
import { furnaceHeat } from "../src/furnace.js";
import { FurnaceCables, FURNACE_CABLE_COUNT } from "../src/furnace-cables.js";
import { carveExplosion } from "../src/terrain.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { interpolateStates } from "../src/render-state.js";

function arena() {
  const w = new World({ arena: ARENAS.findIndex(a => a.furnace), players: [0, 1, 2, 3], shuffle: false, random: () => .4 });
  w.phase = "fight"; w.botIds.clear(); w.weaponTimer = 999;
  w.cover = []; w.chunks = []; w.water = []; w.spills = []; w.gas = []; w.drops = [];
  return w;
}
function advance(w, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) { w.time += STEP; updateHazards(w, STEP); }
}

test("furnace has nine open seconds, two warning seconds, five active seconds and bounded cooling", () => {
  const w = arena(), h = w.hazards[0];
  advance(w, 8.9); assert.ok(!h.active && !h.warning); assert.equal(furnaceHeat(h), 0);
  advance(w, .1); assert.ok(!h.active && h.warning > 1.99);
  advance(w, 2); assert.ok(h.active && h.warning === 0); assert.ok(h.duration > 4.99);
  advance(w, 5); assert.ok(!h.active); assert.ok(furnaceHeat(h) > .99);
  advance(w, 2.5); assert.equal(furnaceHeat(h), 0);
  advance(w, 8.5); assert.ok(h.active);
});

for (const dir of [-1, 1]) test(`central grate is traversable when off (${dir})`, () => {
  const w = arena(), p = w.players[0];
  Object.assign(p, { x: dir > 0 ? 965 : 1595, y: 970, vx: 0, vy: 0, ground: true, rig: null });
  for (let i = 0; i < 3.2 / STEP; i++) {
    w.move(p, cleanInput({ left: dir < 0, right: dir > 0 }), STEP); updateHazards(w, STEP);
  }
  assert.ok(dir > 0 ? p.x > 1660 : p.x < 900, `${p.x},${p.y}`);
  assert.ok(p.alive && p.hp === 100 && p.y < 1000);
});

test("warning is safe, active arcs kill across the full vertical crossing but leave the galleries safe", () => {
  const w = arena(), h = w.hazards[0];
  Object.assign(w.players[0], { x: 1280, y: 970 });
  Object.assign(w.players[1], { x: 1280, y: 200 });
  Object.assign(w.players[2], { x: 995, y: 970 });
  Object.assign(w.players[3], { x: 1565, y: 500 });
  h.age = 9; advance(w, .8); assert.ok(w.players.every(p => p.hp === 100));
  h.age = 11; advance(w, STEP);
  assert.ok(!w.players[0].alive && !w.players[1].alive);
  assert.ok(w.players[2].alive && w.players[3].alive);
  assert.ok(w.ragdolls.every(r => r.effect === "tesla"));
  assert.equal(w.lastDeathCause, "electrified");
});

test("cooling only burns grate contact, expires, and molten slag remains dangerous", () => {
  const w = arena(), h = w.hazards[0], p = w.players[0], q = w.players[1];
  h.age = 16; Object.assign(p, { x: 1280, y: 970 }); Object.assign(q, { x: 1280, y: 850 });
  advance(w, STEP); assert.equal(p.hp, 94); assert.equal(q.hp, 100);
  advance(w, .2); assert.equal(p.hp, 94);
  advance(w, 3); const hp = p.hp; assert.ok(p.alive && hp >= 70);
  advance(w, 1); assert.equal(p.hp, hp);
  Object.assign(q, { x: 1280, y: 1380 }); advance(w, STEP);
  assert.equal(q.alive, false); assert.equal(w.ragdolls.at(-1).effect, "burn");
});

test("guest prediction cannot deal furnace or slag damage; only fight time advances the cycle", () => {
  const w = arena(); w.prediction = true; w.hazards[0].age = 11;
  Object.assign(w.players[0], { x: 1280, y: 970 }); Object.assign(w.players[1], { x: 1280, y: 1380 });
  advance(w, .2); assert.ok(w.players.every(p => p.hp === 100));
  for (const phase of ["countdown", "result"]) {
    w.phase = phase; const age = w.hazards[0].age; advance(w, 20); assert.equal(w.hazards[0].age, age);
  }
});

test("fighters jump through the hanging cable runs without landing on them", () => {
  const w = arena(), p = w.players[0];
  Object.assign(p, { x: 400, y: 630, vx: 0, vy: 0, ground: true, rig: null });
  let highest = p.y;
  for (let i = 0; i < 180; i++) {
    w.move(p, cleanInput({ jump: i === 0 }), STEP); highest = Math.min(highest, p.y);
  }
  assert.ok(highest < 510); assert.ok(p.ground && Math.abs(p.y - 630) < 1);
  assert.equal(p.hp, 100);
});

test("active furnace also blocks a recoil-assisted route underneath the grate", () => {
  const w = arena(); w.hazards[0].age = 11;
  Object.assign(w.players[0], { x: 1280, y: 1200 }); advance(w, STEP);
  assert.equal(w.players[0].alive, false); assert.equal(w.ragdolls[0].effect, "tesla");
});

test("furnace mounting destruction clears danger and heat permanently, with reset next round", () => {
  const w = arena(), h = w.hazards[0]; h.age = 11; advance(w, STEP);
  carveExplosion(w, { x: 1280, y: 1000, radius: 95 }); advance(w, STEP);
  assert.ok(h.done && !h.active); assert.equal(furnaceHeat(h), 0);
  advance(w, 30); assert.ok(h.done); assert.ok(validSnapshot(w.snapshot()));
  w.startRound(); assert.ok(w.hazards.every(h => !h.done && !h.active && h.age === 0));
});

test("late joins retain active, cooling and destroyed furnace state; malformed dimensions reject", () => {
  const w = arena();
  for (const age of [10, 12, 16.5, 19]) {
    w.hazards[0].age = age; advance(w, STEP);
    const s = JSON.parse(JSON.stringify(w.snapshot())); assert.ok(validSnapshot(s));
    const hotJoin = expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(s))), validSnapshot);
    assert.deepEqual(hotJoin.hazards, s.hazards);
    const next = structuredClone(s); next.time += .1;
    const view = interpolateStates(hotJoin, next, .5);
    assert.equal(view.hazards[0].active, s.hazards[0].active);
    assert.equal(furnaceHeat(view.hazards[0]), furnaceHeat(s.hazards[0]));
  }
  for (const patch of [{ h: 1301 }, { w: 601 }, { age: -1 }, { duration: 8 }, { active: "true" }]) {
    const s = structuredClone(w.snapshot()); Object.assign(s.hazards[0], patch); assert.equal(validSnapshot(s), false);
  }
  const s = structuredClone(w.snapshot()); s.hazards[1].w = 901; assert.equal(validSnapshot(s), false);
});

test("six loose cables retain endpoints and bounded lengths, gain motion under current and never add collision", () => {
  const w = arena(), idle = new FurnaceCables(), live = new FurnaceCables();
  const solids = w.solids().map(p => p.id), snapshotKeys = Object.keys(w.snapshot());
  let idleMotion = 0, liveMotion = 0;
  for (let i = 0; i < 480; i++) {
    const beforeIdle = idle.cables[0].points.map(p => [p.x, p.y]);
    const beforeLive = live.cables[0].points.map(p => [p.x, p.y]);
    idle.step(i * STEP, 0); live.step(i * STEP, 1);
    if (i > 360) for (let n = 1; n < 24; n++) {
      idleMotion += Math.hypot(idle.cables[0].points[n].x - beforeIdle[n][0], idle.cables[0].points[n].y - beforeIdle[n][1]);
      liveMotion += Math.hypot(live.cables[0].points[n].x - beforeLive[n][0], live.cables[0].points[n].y - beforeLive[n][1]);
    }
  }
  assert.equal(live.cables.length, FURNACE_CABLE_COUNT); assert.ok(liveMotion > idleMotion * 1.4, `${liveMotion}/${idleMotion}`);
  for (const cable of live.cables) {
    assert.equal(cable.points[0].x, cable.a.x); assert.equal(cable.points.at(-1).y, cable.b.y);
    for (const [i, p] of cable.points.slice(1).entries()) {
      const q = cable.points[i]; assert.ok(Number.isFinite(p.x + p.y));
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < cable.lengths[i] * 1.2);
    }
  }
  assert.deepEqual(w.solids().map(p => p.id), solids); assert.deepEqual(Object.keys(w.snapshot()), snapshotKeys);
  const state = w.snapshot(); assert.equal(live.update(state, STEP).length, 6);
  state.hazards[0].done = true; assert.equal(live.update(state, STEP).length, 0);
});
