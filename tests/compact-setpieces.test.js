import test from "node:test";
import assert from "node:assert/strict";
import { ARENAS, STEP, World } from "../src/engine.js";
import { carveExplosion } from "../src/terrain.js";
import { planeBreaches } from "../src/plane.js";
import { updateHazards } from "../src/hazards.js";
import { RenderSnapshots } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { hazardProps } from "../src/props.js";

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

test("a sealed hull has no decompression, while a physical breach pulls toward its opening", () => {
  const world = worldFor("cargo-plane"), airflow = world.hazards.find(h => h.type === "airflow");
  const player = world.players[0];
  place(player, 1900, 710);
  airflow.age = 7;
  updateHazards(world, STEP);
  assert.equal(airflow.active, false);
  assert.deepEqual(planeBreaches(world.platforms), []);
  carveExplosion(world, {x:2080,y:710,radius:145});
  player.vx=0;
  updateHazards(world, STEP);
  assert.ok(airflow.active);
  assert.ok(player.vx > 25);
  assert.equal(airflow.done, false);
});

test("hull breaches and released restraints survive hot join and reset with the round", () => {
  const world = worldFor("cargo-plane"), airflow = world.hazards.find(h => h.type === "airflow");
  const cargo = world.cover.find(p => p.strapped);
  world.damageCover(cargo, 30, 500, 0);
  airflow.age = 7;
  carveExplosion(world, {x:2080,y:710,radius:145});
  updateHazards(world, STEP);
  const snapshot = expandSnapshot(compactSnapshot(new RenderSnapshots().make(world.snapshot())), validSnapshot);
  assert.ok(snapshot.hazards.find(h => h.type === "airflow").active);
  assert.equal(snapshot.cover.find(p => p.id === cargo.id).strapped, false);
  assert.ok(validSnapshot(snapshot));
  assert.deepEqual(planeBreaches(snapshot.platforms),planeBreaches(world.platforms));
  world.startRound();
  assert.deepEqual(planeBreaches(world.platforms),[]);
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
  const start = car.x;
  for (let i = 0; i < 60; i++) {
    world.updateCover(STEP);
    updateHazards(world, STEP);
  }
  assert.ok(car.x > start + 20);
  assert.ok(car.vx > 0);
  assert.ok(validSnapshot(world.snapshot()));
});

test("the wash starts immediately, warns, reverses the car and resets its drive", () => {
  const world = worldFor("car-wash"), car = world.cover.find(p => p.kind === "car");
  const advance = n => { for(let i=0;i<n;i++) {world.time+=STEP;world.updateCover(STEP);updateHazards(world,STEP);} };
  advance(1);
  assert.ok(world.hazards.filter(h=>h.type==="conveyor").every(h=>h.active&&h.cooldown===0));
  assert.ok(car.vx>0);
  advance(59);
  assert.ok(car.x>280, "the actual starting car should move visibly in the first half second");
  advance(840);
  assert.ok(world.hazards.filter(h=>h.type==="conveyor").every(h=>h.warning>0&&h.dir===1));
  const before=car.x;
  advance(360);
  assert.ok(car.x<before-300 && car.vx<0, "the same physical car returns through the arena");
  assert.ok(validSnapshot(world.snapshot()));
  world.startRound();
  assert.equal(world.cover.find(p=>p.kind==="car").x,180);
  assert.ok(world.hazards.filter(h=>h.type==="conveyor").every(h=>h.age===0&&h.dir===1&&h.cooldown===0));
});

test("a wash belt cannot drive a car over a missing contact surface", () => {
  const world=worldFor("car-wash"),car=world.cover.find(p=>p.kind==="car");
  const belt=world.hazards.find(h=>h.type==="conveyor");
  world.platforms=world.platforms.filter(p=>!p.washFloor);
  // Keep the motor's mounting, but remove the surface under the body.
  world.platforms.push({x:190,y:1160,w:20,h:50,hp:100});
  Object.assign(car,{x:230,y:1026,vx:0,vy:0});
  hazardProps(world,belt,{x:20,y:1140,w:360,h:20},STEP);
  assert.equal(car.vx,0);
  for(let i=0;i<90;i++)world.updateCover(STEP);
  assert.ok(car.y>1200,"the unsupported car falls through the belt hole");
});

test("wash destruction and reversed machinery survive a hot join, then reset", () => {
  const world=worldFor("car-wash");
  carveExplosion(world,{x:680,y:1160,radius:125});
  carveExplosion(world,{x:1280,y:650,radius:110});
  for(const h of world.hazards)h.age=8.5;
  updateHazards(world,STEP);
  world.damageCover(world.cover.find(p=>p.kind==="car"),500,400,-200);
  const state=expandSnapshot(compactSnapshot(new RenderSnapshots().make(world.snapshot())),validSnapshot);
  assert.deepEqual(state.platforms,new RenderSnapshots().make(world.snapshot()).platforms);
  assert.ok(state.hazards.some(h=>h.type==="conveyor"&&h.dir===-1));
  assert.ok(state.chunks.some(c=>c.kind==="car"));
  world.startRound();
  assert.equal(world.chunks.length,0);
  assert.equal(world.platforms.length,world.arena.platforms.length);
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

test("destroying a wash machine mounting removes only that machine's effects", () => {
  const world=worldFor("car-wash"),wash=world.hazards.find(h=>h.type==="carwash");
  carveExplosion(world,{x:770,y:800,radius:100});
  place(world.players[0],770,1128);place(world.players[1],1580,1128);
  updateHazards(world,STEP);
  assert.equal(world.players[0].hp,100);
  assert.equal(world.players[1].hp,96);
  carveExplosion(world,{x:1225,y:650,radius:100});
  wash.age=5.1;updateHazards(world,STEP);
  assert.equal(wash.active,false);assert.equal(world.water.length,0);
  carveExplosion(world,{x:2416,y:1160,radius:100});
  wash.age=11;updateHazards(world,STEP);
  assert.equal(wash.active,false);
  assert.ok(validSnapshot(world.snapshot()));
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
