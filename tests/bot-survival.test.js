import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS } from "../src/engine.js";
import { combatFloor } from "./helpers.js";

function fixture(difficulty = "easy") {
  const w = new World({players:[0, 1], bots:[1], shuffle:false, random:() => .45, difficulty});
  combatFloor(w);
  w.phase = "fight";
  Object.assign(w.players[0], {x:1120, y:535, ground:true, support:"floor0"});
  Object.assign(w.players[1], {x:1000, y:535, ground:true, support:"floor0"});
  return w;
}
const drop = (type, x, y = 555) => ({id:`pickup-${type}`, type, x, y, vx:0, vy:0, ammo:WEAPONS[type].ammo, life:90});
function advance(w, seconds, observe = () => {}) {
  for (let n = 0; n < seconds / STEP && w.phase === "fight"; n++) {
    w.step(STEP);
    observe(w);
  }
}
function ledge(w, x = 1000, width = 180) {
  w.platforms = [
    {id:"floor0", x:x - width / 2, y:1200, w:width, h:25},
    {id:"enemy", x:1900, y:1200, w:400, h:25},
  ];
  Object.assign(w.players[0], {x:2100, y:1170, ground:true, support:"enemy"});
  Object.assign(w.players[1], {x, y:1170, ground:true, support:"floor0"});
}

for (const difficulty of ["easy", "normal", "hard"]) {
  test(`${difficulty} unarmed bot gets a weapon behind it instead of chasing a close opponent`, () => {
    const w = fixture(difficulty);
    w.drops = [drop("blaster", 650)];
    advance(w, .5);
    assert.ok(w.players[1].x < 960);
    assert.equal(w.players[0].hp, 100);
    assert.ok(!w.events.some(e => e.type === "swing"));
    advance(w, 1.6);
    assert.equal(w.players[1].weapon, "blaster");
  });
}

for (const type of ["bat", "sword", "grenade"]) {
  test(`unarmed bot prefers a reachable ${type} to fists`, () => {
    const w = fixture();
    w.drops = [drop(type, 760)];
    let acquired = false;
    advance(w, 1.5, () => {acquired ||= w.players[1].weapon === type;});
    assert.ok(acquired);
  });
}

test("unarmed bot seeks a distant reachable weapon even with an opponent close by", () => {
  const w = fixture();
  w.drops = [drop("blaster", 140)];
  let acquired = false;
  advance(w, 5, () => {acquired ||= w.players[1].weapon === "blaster";});
  assert.ok(acquired);
});

test("a nearby reachable gun outranks a similar nearby melee pickup", () => {
  const w = fixture();
  w.drops = [drop("bat", 700), drop("blaster", 730)];
  advance(w, 1.5);
  assert.equal(w.players[1].weapon, "blaster");
});

test("fists can clear an opponent standing between the bot and its weapon", () => {
  const w = fixture();
  Object.assign(w.players[0], {x:950});
  w.drops = [drop("blaster", 650)];
  advance(w, .15);
  assert.ok(w.players[0].hp < 100);
  assert.ok(w.players[1].x < 1000);
});

test("fists remain available when no usable weapon can be reached", () => {
  const w = fixture();
  w.drops = [{...drop("blaster", 650), ammo:0}];
  advance(w, .8);
  assert.ok(w.players[0].hp < 100);
});

test("a claimed pickup is abandoned in favour of the next reachable weapon", () => {
  const w = fixture();
  w.drops = [drop("blaster", 650)];
  advance(w, .25);
  assert.ok(w.players[1].x < 1000);
  w.drops = [drop("railgun", 1700)];
  let acquired = false;
  // Move the observer out of the route so it cannot block pickup acquisition.
  Object.assign(w.players[0], {x:200, y:535});
  advance(w, 5, () => {acquired ||= w.players[1].weapon === "railgun";});
  assert.ok(acquired);
});

test("an unreachable exotic pickup does not lure a bot over a fatal edge", () => {
  const w = fixture();
  ledge(w);
  w.drops = [drop("phaser", 1500, 1160)];
  advance(w, 20);
  assert.equal(w.players[1].alive, true);
  assert.ok(w.players[1].x > 910 && w.players[1].x < 1090);
});

test("low health alone never authorizes a fatal jump", () => {
  const w = fixture();
  ledge(w);
  w.players[1].hp = 1;
  advance(w, 20);
  assert.equal(w.players[1].alive, true);
});

test("a close opponent across a gap cannot bait an unarmed lunge off the ledge", () => {
  const w = fixture();
  ledge(w);
  w.platforms[1].x = 1150;
  w.players[0].x = 1175;
  w.players[1].x = 1058;
  // A wall prevents a safe upward crossing while keeping the enemy visible.
  w.platforms.push({id:"ceiling", x:880, y:1095, w:800, h:25});
  advance(w, 10);
  assert.equal(w.players[1].alive, true);
  assert.ok(w.players[1].x < 1090);
});

test("a projectile dodge on a narrow ledge lands back on solid ground", () => {
  const w = fixture("hard");
  ledge(w, 1000, 150);
  w.projectiles = [{id:99, kind:"rocket", x:700, y:1170, vx:1000, vy:0, owner:0, life:10, r:6, damage:1, force:0, radius:30}];
  let jumped = false;
  advance(w, 2, () => {jumped ||= w.players[1].jumps > 0;});
  assert.ok(jumped, "the safety check must preserve a useful dodge");
  assert.equal(w.players[1].alive, true);
  assert.equal(w.players[1].support, "floor0");
});

test("a gun with fatal recoil is held until the bot has room to fire", () => {
  const w = fixture();
  ledge(w, 1000, 150);
  Object.assign(w.players[1], {weapon:"railgun", ammo:3});
  advance(w, 12);
  assert.equal(w.players[1].alive, true);
  assert.equal(w.players[1].ammo, 3);
});

test("safe double-jump routes to a weapon are still executed", () => {
  const w = fixture();
  ledge(w, 300, 320);
  w.platforms.push({id:"pickup-floor", x:650, y:1040, w:300, h:25});
  w.drops = [drop("blaster", 750, 1030)];
  let acquired = false, doubleJump = false;
  advance(w, 8, () => {
    acquired ||= w.players[1].weapon === "blaster";
    doubleJump ||= w.players[1].jumps === 2;
  });
  assert.ok(doubleJump);
  assert.ok(acquired);
  assert.equal(w.players[1].alive, true);
});

test("destroyed destinations invalidate a route before takeoff", () => {
  const w = fixture();
  ledge(w, 300, 320);
  w.platforms.push({id:"pickup-floor", x:650, y:1040, w:300, h:25});
  w.drops = [drop("blaster", 750, 1030)];
  advance(w, .2);
  w.platforms = w.platforms.filter(s => s.id !== "pickup-floor");
  w.terrainVersion++;
  advance(w, 12);
  assert.equal(w.players[1].alive, true);
  assert.equal(w.players[1].support, "floor0");
});

test("an imminent nuke destroying the entire ledge permits a last-ditch escape", () => {
  const w = fixture();
  ledge(w, 1000, 130);
  w.projectiles = [{id:99, kind:"grenade", nuclear:true, weapon:"nuke", x:970, y:1188, vx:0, vy:0,
    owner:0, life:.8, r:12, radius:480, damage:260, force:3000, bounces:99}];
  let jumped = false, leftLedge = false;
  advance(w, .65, () => {
    jumped ||= w.players[1].jumps > 0;
    leftLedge ||= w.players[1].x > 1080;
  });
  assert.ok(jumped);
  assert.ok(leftLedge);
});
