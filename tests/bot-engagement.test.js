import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS } from "../src/engine.js";
import { combatFloor } from "./helpers.js";

function islands(weapon, separation = 1200) {
  const world = new World({ players: [0, 1], bots: [1], shuffle: false, random: () => 0.5 });
  combatFloor(world);
  world.phase = "fight";
  world.platforms = [
    { id: "left", x: 100, y: 1200, w: 130, h: 24 },
    { id: "right", x: 100 + separation, y: 1200, w: 400, h: 24 },
  ];
  Object.assign(world.players[0], { x: 185 + separation, y: 1170, ground: true, support: "right" });
  Object.assign(world.players[1], {
    x: 185, y: 1170, ground: true, support: "left", weapon,
    ammo: WEAPONS[weapon]?.ammo || 0,
  });
  return world;
}

function advance(world, seconds, observe = () => {}) {
  for (let n = 0; n < seconds / STEP && world.phase === "fight"; n++) {
    world.step(STEP);
    observe(world);
  }
}

for (const [weapon, separation] of [["barrage", 1250], ["saw", 1400], ["railgun", 2100], ["blaster", 1700],
  ["flame",1200],["repulsor",1200],["jelly",1200],["midas",1200],["tangle",1200]]) {
  test(`${weapon} AI fires across a destroyed gap without waiting for a safe recoil stance`, () => {
    const world = islands(weapon, separation);
    const ammo = world.players[1].ammo;
    let firingDistance = 0;
    advance(world, 3.5, w => {
      if (!firingDistance && w.events.some(e => e.type === "shoot"))
        firingDistance = Math.abs(w.players[0].x - w.players[1].x);
    });
    assert.ok(world.players[1].ammo < ammo || world.events.some(e => e.type === "shoot"));
    assert.ok(firingDistance > separation - 150, `engaged at ${firingDistance}`);
  });
}

for (const separation of [500, 1150]) {
  test(`black hole AI deploys a real field against an opponent ${separation} units away`, () => {
    const world = islands("blackhole", separation);
    advance(world, 0.2);
    assert.equal(world.players[1].ammo, 2, "Easy still waits for its reaction delay");
    let field = false;
    advance(world, 2, w => { field ||= w.fields.some(f => f.kind === "blackhole"); });
    assert.ok(world.events.some(e => e.type === "shoot"));
    assert.ok(field, "the projectile must actually arm, rather than just setting an attack flag");
  });
}

test("black hole AI deploys against distant structural cover within pulling range of its target", () => {
  const world = islands("blackhole", 850);
  world.platforms.push({ id: "wall", x: 800, y: 1040, w: 50, h: 160 });
  let field = false;
  advance(world, 2, w => { field ||= w.fields.some(f => f.kind === "blackhole" && f.x > 750 && f.x < 820); });
  assert.ok(field);
});

test("black hole AI does not deploy into a wall immediately in front of its muzzle", () => {
  const world = islands("blackhole", 850);
  world.platforms.push({ id: "wall", x: 220, y: 1000, w: 80, h: 200 });
  advance(world, 2);
  assert.equal(world.players[1].ammo, 2);
  assert.ok(!world.events.some(e => e.type === "shoot"));
});

test("black hole AI does not bypass deployment clearance when trying to clear nearby furniture", () => {
  const world = islands("blackhole", 850);
  world.platforms[0].w = 450;
  world.cover = [{ id: "crate", kind: "crate", x: 220, y: 1140, w: 80, h: 60, hp: 90, maxHp: 90 }];
  advance(world, 1.5);
  assert.ok(!world.events.some(e => e.type === "shoot"), "close furniture must not override the orb's clearance check");
});

for (const weapon of ["bat"]) {
  test(`${weapon} AI keeps its actual short reach instead of wasting attacks across a gap`, () => {
    const world = islands(weapon, 1200);
    advance(world, 2);
    assert.equal(world.players[1].ammo, WEAPONS[weapon].ammo);
    assert.ok(!world.events.some(e => e.type === "shoot" || e.type === "swing"));
  });
}

test("stranded unarmed AI attempts a double jump toward its opponent even if the gap is fatal", () => {
  const world = islands(null);
  let crossedEdge = false, airJump = false;
  advance(world, 8, w => {
    const bot = w.players[1];
    crossedEdge ||= bot.x > 250 && !bot.ground;
    airJump ||= bot.jumps === 2;
  });
  assert.ok(crossedEdge, "leave the isolated ledge toward the opponent");
  assert.ok(airJump, "try the second normal jump instead of giving up in midair");
  assert.equal(world.players[1].alive, false, "a failed jump is allowed to end the stand-off");
});

test("stuck AI walks out from under a low ceiling before attempting its risky jump", () => {
  const world = islands(null);
  world.platforms[0].w = 450;
  world.platforms.push({ id: "roof", x: 100, y: 1090, w: 300, h: 25 });
  Object.assign(world.players[0], { x: 250, y: 1060, support: "roof" });
  Object.assign(world.players[1], { x: 250 });
  let leftRoof = false, headTrapJumps = 0;
  advance(world, 10, w => {
    const bot = w.players[1];
    leftRoof ||= bot.x > 420;
    if (bot.jumpHeld && bot.x > 120 && bot.x < 380 && bot.y > 1120) headTrapJumps++;
  });
  assert.ok(leftRoof);
  assert.equal(headTrapJumps, 0, "do not repeatedly jump into the same ceiling");
});
