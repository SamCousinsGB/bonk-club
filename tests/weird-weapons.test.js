import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS, cleanInput } from "../src/engine.js";
import { combatFloor } from "./helpers.js";
import { makeRig } from "../src/puppet.js";
import { firePhaser, beamTouches, carveBeam } from "../src/phaser.js";
import { impactSpecial } from "../src/specials.js";
import { WeaponRotation } from "../src/arsenal.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { captureFighter } from "../src/singularity-body.js";
import { blackholeField } from "../src/blackhole.js";

function fixture() {
  const w = new World({ players: [0, 1, 2, 3], shuffle: false, random: () => .5 });
  combatFloor(w); w.phase = "fight"; w.arena = { ...w.arena, spikes: [] };
  w.players.forEach((p, i) => {
    Object.assign(p, { x: [400, 750, 1700, 2200][i], y: 535, vx: 0, vy: 0,
      ground: true, support: "floor0", aimAngle: 0 }); p.rig = makeRig(p);
  });
  return w;
}
function fire(w, type) {
  const p = w.players[0]; Object.assign(p, { weapon: type, ammo: WEAPONS[type].ammo });
  w.attack(p); return w.projectiles[0];
}
function projectiles(w, seconds) { for (let t = 0; t < seconds; t += STEP) w.updateProjectiles(STEP); }
const wire = w => new RenderSnapshots().make(w.snapshot());

test("phase muzzle follows the physical hand for standing, prone and airborne aims", () => {
  for (const angle of [0, Math.PI, -.7, Math.PI / 2, -Math.PI / 2]) {
    for (const prone of [false, true]) {
      const w = fixture(), p = w.players[0]; p.prone = prone;
      p.rig[6].x = p.x - 7; p.rig[6].y = p.y + (prone ? 4 : -25);
      const f = firePhaser(w, p, Math.cos(angle), Math.sin(angle));
      assert.ok(Math.abs(f.x - p.rig[6].x - Math.cos(angle) * 54) < .001);
      assert.ok(Math.abs(f.y - p.rig[6].y - Math.sin(angle) * 54) < .001);
      assert.ok(validSnapshot(wire(w)));
    }
  }
});

test("triangular flare excludes targets beside the muzzle and reaches full width after the flare", () => {
  for (const angle of [0, .8, Math.PI, -Math.PI / 2]) {
    const f = { x: 500, y: 500, ex: 500 + Math.cos(angle)*3500, ey: 500 + Math.sin(angle)*3500, radius: 72, flare: 150 };
    const box = (along, side) => ({ x: f.x + Math.cos(angle)*along - Math.sin(angle)*side - 1,
      y: f.y + Math.sin(angle)*along + Math.cos(angle)*side - 1, w: 2, h: 2 });
    assert.equal(beamTouches(box(20, 40), f), false);
    assert.equal(beamTouches(box(80, 20), f), true);
    assert.equal(beamTouches(box(170, 65), f), true);
    assert.equal(beamTouches(box(-15, 0), f), false);
    const untouched = box(20, 40);
    assert.equal(carveBeam(untouched, f, () => "bad")[0], untouched);
  }
});

test("the last phase shot retains the gun throughout its discharge, then releases it", () => {
  const w = fixture(), p = w.players[0]; Object.assign(p, { weapon: "phaser", ammo: 1 });
  w.attack(p); assert.equal(p.weapon, "phaser"); assert.equal(p.ammo, 0);
  for (let t = 0; t < .3; t += STEP) w.move(p, cleanInput({}), STEP);
  assert.equal(p.weapon, "phaser");
  for (let t = 0; t < .2; t += STEP) w.move(p, cleanInput({}), STEP);
  assert.equal(p.weapon, null);
});

test("flames reach distant fighters and cover still stops ignition", () => {
  for (const wall of [false, true]) {
    const w = fixture(), q = w.players[1]; q.x = 1150;
    if (wall) w.platforms.push({ id: "wall", x: 800, y: 350, w: 30, h: 210 });
    fire(w, "flame"); projectiles(w, .85);
    assert.equal(q.burn, wall ? 0 : 3); assert.equal(w.projectiles.length, 0);
  }
  const w = fixture(); w.players[1].x = 1320; fire(w, "flame"); projectiles(w, 1);
  assert.ok(w.players[1].hp < 100);
});

test("a single ignition expires after three seconds and resets next round", () => {
  const w = fixture(), q = w.players[1]; q.x = 1000;
  fire(w, "flame"); projectiles(w, .8); assert.equal(q.burn, 3);
  const hp = q.hp;
  for (let t = 0; t < 2.5; t += STEP) w.move(q, cleanInput({}), STEP);
  assert.ok(q.alive); assert.ok(q.hp < hp - 40); assert.ok(q.burn > 0 && q.burn < .51);
  assert.ok(validSnapshot(wire(w)));
  for (let t = 0; t < 4 && q.alive; t += STEP) w.move(q, cleanInput({}), STEP);
  assert.equal(q.alive, true); assert.equal(q.burn, 0); assert.ok(Math.abs(q.hp - (hp - 54)) < 1e-6);
  w.startRound(); assert.ok(w.players.every(p => p.burn === 0 && p.bubble === 0));
});

test("extended flame and novelty barrels cannot spawn shots beyond nearby cover", () => {
  for (const type of ["flame", "bubble", "duck", "boomerang"]) {
    const w = fixture();
    w.platforms.push({ id: "wall", x: 430, y: 350, w: 8, h: 210 });
    const b = fire(w, type); assert.ok(b.x < 430);
    projectiles(w, .3); assert.equal(w.players[1].hp, 100);
    assert.equal(w.players[1].burn, 0); assert.equal(w.players[1].bubble, 0);
  }
});

test("black-hole capture pops a bubble but cannot extinguish a burning fighter", () => {
  const w = fixture(), q = w.players[1]; q.burn = 1; q.bubble = 2;
  const field = blackholeField(w, { x: 900, y: 500, owner: 0 }); w.fields = [field];
  captureFighter(q, field); assert.equal(q.bubble, 0); assert.equal(q.burn, 1);
  w.move(q, cleanInput({}), STEP); assert.ok(q.hp < 100); assert.ok(q.strands);
  assert.ok(validSnapshot(wire(w)));
});

test("parrying flames or bubbles prevents ignition/capture and transfers ownership", () => {
  for (const type of ["flame", "bubble", "boomerang"]) {
    const w = fixture(), q = w.players[1]; Object.assign(q, { block: true, blockTime: 0, aimAngle: Math.PI });
    const b = fire(w, type);
    for (let n = 0; n < 120 && b.owner === 0; n++) w.updateProjectiles(STEP);
    assert.equal(b.owner, q.id, type); assert.equal(q.hp, 100);
    assert.equal(q.burn, 0); assert.equal(q.bubble, 0);
  }
});

test("bubbles lift living opponents, retain controls, collide with ceilings and expire", () => {
  const w = fixture(), q = w.players[1]; fire(w, "bubble"); projectiles(w, .6);
  assert.ok(q.bubble > 0); const y = q.y, x = q.x;
  w.platforms.push({ id: "ceiling", x: 600, y: 355, w: 650, h: 25 });
  for (let t = 0; t < 1.2; t += STEP) w.move(q, cleanInput({ right: true }), STEP);
  assert.ok(q.y < y - 70); assert.ok(q.y >= 408 - .1); assert.ok(q.x > x + 100);
  q.weapon = "blaster"; q.ammo = 14; w.attack(q); assert.equal(q.ammo, 13);
  for (let t = 0; t < 2; t += STEP) w.move(q, cleanInput({}), STEP);
  assert.equal(q.bubble, 0); assert.equal(q.alive, true);
});

test("bubble duration cannot stack and a heavy follow-up pops it", () => {
  const w = fixture(), q = w.players[1]; impactSpecial(w, { kind: "bubble" }, q, true);
  w.move(q, cleanInput({}), .2); const remaining = q.bubble;
  impactSpecial(w, { kind: "bubble" }, q, true); assert.equal(q.bubble, remaining);
  w.hit(q, w.players[0], 24, 80, 1, 0, { projectile: true }); assert.equal(q.bubble, 0);
});

test("boomerangs turn back, can hit twice, and are caught without damaging their owner", () => {
  const w = fixture(), p = w.players[0], q = w.players[1]; q.x = 680;
  const b = fire(w, "boomerang"); projectiles(w, .4);
  assert.equal(q.hp, 62); assert.equal(b.returning, undefined);
  // Step into its curved return path; a moving opponent may be struck again.
  projectiles(w, .4);
  q.x = b.x + b.vx * .09; q.y = b.y + b.vy * .09;
  let returned = false;
  for (let n = 0; n < 300 && w.projectiles.length; n++) { w.updateProjectiles(STEP); returned ||= b.vx < 0; }
  assert.ok(returned); assert.equal(q.hp, 24); assert.equal(p.hp, 100);
  assert.equal(w.projectiles.length, 0); assert.ok(w.events.some(e => e.type === "pickup"));
});

test("a boomerang keeps travelling if its owner dies, and bounces off solid walls", () => {
  const w = fixture(); w.players[1].y = 900;
  w.platforms.push({ id: "wall", x: 600, y: 300, w: 20, h: 250 });
  const b = fire(w, "boomerang"); projectiles(w, .3); assert.ok(b.vx < 0);
  w.kill(w.players[0]); projectiles(w, 3); assert.ok(w.projectiles.includes(b));
});

test("rubber ducks bounce then explode on a final collision, carving actual terrain once", () => {
  const w = fixture(); for (const p of w.players) p.y = 100;
  const b = fire(w, "duck"); b.x = 800; b.y = 520; b.vx = 50; b.vy = 200;
  projectiles(w, .15); assert.ok(b.vy < 0); assert.ok(b.life > 1.8);
  const terrain = JSON.stringify(w.platforms); b.bounces = 0; b.x = 850; b.y = 540; b.vy = 1000;
  projectiles(w, .1); assert.notEqual(JSON.stringify(w.platforms), terrain);
  assert.equal(w.events.filter(e => e.type === "explosion").length, 1);
  assert.equal(w.projectiles.length, 0); assert.ok(validSnapshot(wire(w)));
});

test("a direct duck hit detonates and has blast damage and remains", () => {
  const w = fixture(), q = w.players[1]; q.x = 600; q.hp = 25;
  fire(w, "duck"); projectiles(w, .6);
  assert.equal(q.alive, false); assert.equal(w.ragdolls[0].effect, "blast");
  assert.equal(w.events.filter(e => e.type === "explosion").length, 1);
});

test("new weapons appear in the featured rotation and preserve validated guest/hot-join state", () => {
  const rotation = new WeaponRotation(() => .5);
  const count = Object.values(WEAPONS).filter(w => ["rare", "exotic"].includes(w.rarity)).length;
  const bag = Array.from({ length: count }, () => rotation.next());
  for (const type of ["bubble", "boomerang", "duck"]) {
    assert.ok(bag.includes(type));
    const w = fixture(); fire(w, type); const a = wire(w); projectiles(w, .05);
    const b = wire(w), hot = JSON.parse(JSON.stringify(b));
    assert.ok(validSnapshot(hot), type); assert.ok(validSnapshot(interpolateStates(a, b, .5)));
    for (const mutate of [s => s.players[0].bubble = 99, s => s.players[0].burn = 99,
      s => s.projectiles[0].life = 999, s => s.projectiles[0].r = 300,
      s => s.projectiles[0].owner = 4, s => s.projectiles[0].returning = "true"]) {
      const bad = structuredClone(hot); mutate(bad); assert.equal(validSnapshot(bad), false);
    }
    w.startRound(); assert.equal(w.projectiles.length, 0);
  }
});
