import test from "node:test";
import assert from "node:assert/strict";
import { ARENAS, STEP, World } from "../src/engine.js";
import { updateHazards } from "../src/hazards.js";
import { RenderSnapshots } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";

const worldFor = theme => {
  const arena = ARENAS.findIndex(a => a.theme === theme);
  const world = new World({ arena, players: [0, 1, 2, 3], shuffle: false, random: () => .4 });
  world.phase = "fight";
  world.weaponTimer = world.grenadeTimer = 999;
  return world;
};
const place = (p, x, y) => Object.assign(p, { x, y, vx: 0, vy: 0, ground: true, support: null, rig: null });

test("cargo restraints absorb a hit, release under fire and preserve physical cargo", () => {
  const world = worldFor("cargo-plane"), cargo = world.cover.find(p => p.strapped);
  const x = cargo.x;
  world.damageCover(cargo, 8, 900, 0);
  assert.equal(cargo.strapped, true);
  assert.equal(cargo.strapHp, 10);
  assert.equal(cargo.x, x);
  world.damageCover(cargo, 14, 900, -120);
  assert.equal(cargo.strapped, false);
  assert.ok(cargo.vx > 0);
  assert.equal(cargo.hp, 91);
  assert.ok(validSnapshot(world.snapshot()));
});

test("the cargo ramp warns, opens and pulls fighters and released cargo toward the exit", () => {
  const world = worldFor("cargo-plane"), airflow = world.hazards.find(h => h.type === "airflow");
  const cargo = world.cover.find(p => p.strapped), player = world.players[0];
  place(player, 2200, 1128);
  airflow.age = 5.1;
  updateHazards(world, STEP);
  assert.ok(airflow.warning > 1 && !airflow.active);
  const fixedX = cargo.x;
  updateHazards(world, STEP);
  assert.equal(cargo.x, fixedX);
  world.damageCover(cargo, 30, 0, 0);
  airflow.age = 6.7;
  updateHazards(world, STEP);
  assert.ok(airflow.active);
  assert.ok(player.vx > 0);
  assert.ok(cargo.vx > 0);
});

test("cargo ramp and released restraints survive hot join and reset with the round", () => {
  const world = worldFor("cargo-plane"), airflow = world.hazards.find(h => h.type === "airflow");
  const cargo = world.cover.find(p => p.strapped);
  world.damageCover(cargo, 30, 500, 0);
  airflow.age = 7;
  updateHazards(world, STEP);
  const snapshot = expandSnapshot(compactSnapshot(new RenderSnapshots().make(world.snapshot())), validSnapshot);
  assert.ok(snapshot.hazards.find(h => h.type === "airflow").active);
  assert.equal(snapshot.cover.find(p => p.id === cargo.id).strapped, false);
  assert.ok(validSnapshot(snapshot));
  world.startRound();
  assert.ok(world.cover.filter(p => p.strapHp !== undefined).every(p => p.strapped && p.strapHp > 0));
  assert.equal(world.hazards.find(h => h.type === "airflow").age, 0);
});

test("car wash brushes strike through their visible columns without becoming kill walls", () => {
  const world = worldFor("car-wash"), wash = world.hazards.find(h => h.type === "carwash"), player = world.players[0];
  place(player, 770, 1128);
  updateHazards(world, STEP);
  assert.equal(player.hp, 96);
  assert.ok(player.vx !== 0);
  assert.ok(player.alive);
  place(world.players[1], 1280, 800);
  updateHazards(world, STEP);
  assert.equal(world.players[1].hp, 100);
  assert.ok(wash.hitIds.includes(player.id));
});

test("rinse water is finite and the dryer opposes the wash conveyor", () => {
  const world = worldFor("car-wash"), wash = world.hazards.find(h => h.type === "carwash"), player = world.players[0];
  place(player, 1220, 1128);
  wash.age = 5.1;
  for (let i = 0; i < 40; i++) updateHazards(world, STEP);
  assert.ok(wash.active);
  assert.ok(world.water.length > 0);
  place(player, 2200, 1128);
  wash.age = 11;
  updateHazards(world, STEP);
  assert.ok(player.vx < 0);
  assert.ok(validSnapshot(world.snapshot()));
});

test("the wash conveyor moves the heavy car as a damaging physical prop", () => {
  const world = worldFor("car-wash"), car = world.cover.find(p => p.kind === "car");
  const belt = world.hazards.find(h => h.type === "conveyor" && h.x === 430);
  Object.assign(car, { x: 310, y: 1060, vx: 0, vy: 0, angle: 0, spin: 0 });
  belt.cooldown = 0;
  const start = car.x;
  for (let i = 0; i < 120; i++) {
    world.updateCover(STEP);
    updateHazards(world, STEP);
  }
  assert.ok(car.x > start + 20);
  assert.ok(car.vx > 0);
  assert.ok(validSnapshot(world.snapshot()));
});

test("car wash water, car motion and machinery phase are valid for hot joins", () => {
  const world = worldFor("car-wash"), wash = world.hazards.find(h => h.type === "carwash");
  wash.age = 5.2;
  for (let i = 0; i < 35; i++) {
    world.updateCover(STEP);
    updateHazards(world, STEP);
  }
  const snapshot = expandSnapshot(compactSnapshot(new RenderSnapshots().make(world.snapshot())), validSnapshot);
  assert.ok(snapshot.water.length > 0);
  assert.ok(snapshot.cover.some(p => p.kind === "car"));
  assert.ok(snapshot.hazards.find(h => h.type === "carwash").active);
});

test("malformed compact set-piece state is rejected", () => {
  const cargo = new RenderSnapshots().make(worldFor("cargo-plane").snapshot());
  const strapped = cargo.cover.find(p => p.strapped);
  strapped.strapHp = 400;
  assert.equal(validSnapshot(cargo), false);
  const wash = new RenderSnapshots().make(worldFor("car-wash").snapshot());
  wash.hazards.find(h => h.type === "carwash").w = 900;
  assert.equal(validSnapshot(wash), false);
});
