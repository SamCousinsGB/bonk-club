import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateAssembly, carTiles, robotPose } from "../src/assembly.js";
import { carveExplosion } from "../src/terrain.js";
import { validSnapshot } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { nuclearField, updateNuclear } from "../src/nuclear.js";

function fixture() {
  const w = new World({ arena: ARENAS.findIndex(a => a.assembly), players: [0, 1, 2, 3], shuffle: false, random: () => .4 });
  w.phase = "fight"; w.weaponTimer = 999; w.grenadeTimer = 999; w.drops = [];
  return w;
}
function advance(w, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) { w.time += STEP; w.movePlatforms(); updateAssembly(w, STEP); }
}

test("a chassis travels through three working stations to become a complete car", () => {
  const w = fixture(), car = w.assembly.cars[0];
  assert.equal(car.stage, 0); assert.equal(carTiles(w, car.id).length, 1);
  advance(w, 9.6); assert.equal(car.stage, 1); assert.ok(Math.abs(car.x - 640) < .01);
  advance(w, 8); assert.equal(car.stage, 2); assert.ok(carTiles(w, car.id).some(p => p.assemblyPart === "cabin"));
  advance(w, 8); assert.equal(car.stage, 3); assert.equal(carTiles(w, car.id).length, 5);
  assert.equal(w.assembly.completed, 4); assert.ok(validSnapshot(w.snapshot()));
});

test("preloaded work finishes during a short round, belt dwells and bounded feed continues", () => {
  const w = fixture(); advance(w, 1.6); assert.equal(w.assembly.completed, 1);
  assert.equal(w.assembly.cars[0].x, 40); advance(w, 1.4); assert.ok(Math.abs(w.assembly.cars[0].x - 40) < .01);
  advance(w, 2); assert.ok(Math.abs(w.assembly.cars[0].x - 280) < .01);
  advance(w, 115); assert.ok(w.assembly.completed >= 14); assert.ok(w.assembly.cars.length <= 6);
  assert.ok(w.platforms.filter(p => p.assemblyCar).length <= 30); assert.ok(validSnapshot(w.snapshot()));
});

test("fighters ride both the running belt and a car roof, and can jump off", () => {
  for (const roof of [false, true]) {
    const w = fixture(); advance(w, 3);
    const p = w.players[0], car = w.assembly.cars[2];
    const surface = roof ? carTiles(w, car.id).find(p => p.assemblyPart === "cabin") : w.platforms.find(p => p.assemblyBelt && p.x === 300);
    Object.assign(p, { x: roof ? car.x : 350, y: surface.y - 30, ground: true, support: surface.id, rig: null, vx: 0, vy: 0 });
    const x = p.x;
    for (let i = 0; i < 60; i++) { w.movePlatforms(); updateAssembly(w, STEP); w.move(p, cleanInput({}), STEP); }
    assert.ok(p.x > x + 50, `${roof}: ${p.x - x}`); assert.ok(p.ground && p.alive);
    w.move(p, cleanInput({ jump: true }), STEP); assert.ok(p.vy < -400 && !p.ground);
  }
});

test("body welding lifts an existing rider to the new solid roof", () => {
  const w = fixture(), car = w.assembly.cars[2], p = w.players[0];
  Object.assign(p, { x: car.x + 55, y: 1090, ground: true, rig: null });
  advance(w, 1.6); assert.equal(car.stage, 2); assert.equal(p.y, 1020); assert.ok(p.alive);
});

test("stamping warns safely, then its descending physical head crushes only contact", () => {
  const w = fixture();
  Object.assign(w.players[0], { x: 640, y: 1090, rig: null });
  Object.assign(w.players[1], { x: 840, y: 1090, rig: null });
  advance(w, .9); assert.ok(w.hazards[0].warning > 0); assert.ok(w.players[0].alive);
  advance(w, .7); assert.equal(w.players[0].alive, false); assert.equal(w.players[1].hp, 100);
  assert.equal(w.lastDeathCause, "crusher"); assert.ok(w.platforms.some(p => p.assemblyHead && p.y > 1090));
});

test("robot welders damage at their moving arm and tool rather than across the entire station", () => {
  const w = fixture(); advance(w, 1.1);
  const h = w.hazards[1], tip = robotPose(h, w.assembly.clock % 8)[2];
  Object.assign(w.players[0], { x: tip.x, y: tip.y, rig: null });
  Object.assign(w.players[1], { x: h.x + 140, y: 1150, rig: null });
  advance(w, STEP); assert.equal(w.players[0].hp, 62); assert.equal(w.players[1].hp, 100);
  advance(w, .05); assert.equal(w.players[0].hp, 62);
});

test("station destruction prevents its build operation permanently and does not restore a press head", () => {
  for (const station of [1, 2, 3]) {
    const w = fixture(), h = w.hazards[station - 1], car = w.assembly.cars[station];
    const mount = w.platforms.find(p => p.assemblyMount === station);
    carveExplosion(w, { x: h.x, y: mount.y, radius: 140 }); advance(w, 2);
    assert.ok(h.done); assert.equal(car.stage, station - 1);
    if (station === 1) assert.ok(!w.platforms.some(p => p.assemblyHead));
    assert.ok(validSnapshot(w.snapshot()));
  }
});

test("car cuts persist while travelling and damaged work is never silently rebuilt", () => {
  const w = fixture(), car = w.assembly.cars[2];
  carveExplosion(w, { x: car.x + 95, y: 1130, radius: 40 });
  const before = carTiles(w, car.id).reduce((sum, p) => sum + p.w * p.h, 0);
  advance(w, 10); assert.ok(car.damaged); assert.equal(car.stage, 1);
  assert.equal(carTiles(w, car.id).reduce((sum, p) => sum + p.w * p.h, 0), before);
  assert.ok(car.x > 1800); assert.ok(validSnapshot(w.snapshot()));
});

test("a severed conveyor stops approaching pallets and keeps the queue bounded", () => {
  const w = fixture(), car = w.assembly.cars[0];
  carveExplosion(w, { x: 390, y: 1190, radius: 85 }); advance(w, 55);
  assert.ok(car.x < 310); assert.ok(w.assembly.cars.length <= 6); assert.ok(validSnapshot(w.snapshot()));
});

test("destroyed car identities leave no collision, never reappear, and reset restores the line", () => {
  const w = fixture(), id = w.assembly.cars[2].id;
  carveExplosion(w, { x: 1240, y: 1140, radius: 200 }); advance(w, 2);
  assert.ok(!w.assembly.cars.some(c => c.id === id)); assert.equal(carTiles(w, id).length, 0);
  advance(w, 18); assert.equal(carTiles(w, id).length, 0);
  w.startRound(); assert.equal(w.assembly.clock, 0); assert.equal(w.assembly.completed, 0);
  assert.equal(w.assembly.cars.length, 4); assert.ok(w.hazards.every(h => !h.done)); assert.ok(validSnapshot(w.snapshot()));
});

test("nuclear removal cannot be recreated by the next production tick", () => {
  const w = fixture(), id = w.assembly.cars[2].id;
  const field = nuclearField(w, { x: 1240, y: 1100, owner: 0 });
  field.age = 1; updateNuclear(w, field, STEP); advance(w, 2);
  assert.equal(carTiles(w, id).length, 0); assert.ok(validSnapshot(w.snapshot()));
});

test("prediction, countdown and results cannot advance production or award cars", () => {
  const w = fixture(), initial = structuredClone(w.snapshot());
  for (const phase of ["countdown", "result"]) { w.phase = phase; advance(w, 5); assert.deepEqual(w.snapshot().assembly, initial.assembly); }
  w.phase = "fight"; w.prediction = true; advance(w, 5); assert.deepEqual(w.snapshot().assembly, initial.assembly);
});

test("changed-map hot join retains car stages, cuts, completion counts and smooth movement", () => {
  const w = fixture(), snapshots = new RenderSnapshots(); advance(w, 4);
  carveExplosion(w, { x: w.assembly.cars[2].x + 110, y: 1130, radius: 30 }); advance(w, STEP);
  const a = snapshots.make(w.snapshot());
  const received = expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(a))), validSnapshot);
  assert.deepEqual(received.assembly, a.assembly); assert.deepEqual(received.platforms, JSON.parse(JSON.stringify(a.platforms)));
  advance(w, .1); const b = snapshots.make(w.snapshot()), view = interpolateStates(a, b, .5);
  assert.ok(view.assembly.cars[0].x > a.assembly.cars[0].x && view.assembly.cars[0].x < b.assembly.cars[0].x);
  assert.equal(view.assembly.completed, b.assembly.completed); assert.ok(validSnapshot(b));
});

test("wire validation rejects invalid production state and orphan car collision", () => {
  const w = fixture();
  for (const patch of [{ clock: NaN }, { completed: -1 }, { completed: 99 }, { serial: Infinity }, { cars: Array(7).fill(w.snapshot().assembly.cars[0]) }]) {
    const s = structuredClone(w.snapshot()); Object.assign(s.assembly, patch); assert.equal(validSnapshot(s), false);
  }
  for (const patch of [{ stage: 4 }, { x: Infinity }, { damaged: "yes" }, { id: 0 }]) {
    const s = structuredClone(w.snapshot()); Object.assign(s.assembly.cars[0], patch); assert.equal(validSnapshot(s), false);
  }
  const s = structuredClone(w.snapshot()); s.platforms.find(p => p.assemblyCar).assemblyCar = 999; assert.equal(validSnapshot(s), false);
  const missing = structuredClone(w.snapshot()); delete missing.assembly; assert.equal(validSnapshot(missing), false);
});
