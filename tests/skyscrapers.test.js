import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, CITY_ARENAS, WEAPONS } from "../src/engine.js";
import { validSnapshot } from "../src/network.js";

function lab() {
  const w = new World({ arena: 0, shuffle: false, random: () => 0.5 });
  w.phase = "fight";
  w.weaponTimer = 999;
  w.platforms = [
    {
      id: "floor0",
      x: 80,
      y: 600,
      w: 1120,
      h: 25,
      baseX: 80,
      baseY: 600,
      dx: 0,
      dy: 0,
    },
  ];
  w.cover = [];
  w.drops = [];
  Object.assign(w.players[0], {
    x: 540,
    y: 570,
    ground: true,
    support: "floor0",
    aimAngle: 0,
  });
  Object.assign(w.players[1], {
    x: 740,
    y: 570,
    ground: true,
    support: "floor0",
    aimAngle: Math.PI,
  });
  return w;
}
const advance = (w, seconds, inputs = {}) => {
  for (let n = 0; n < Math.ceil(seconds / STEP); n++) w.step(STEP, inputs);
};
const table = () => ({
  id: "cover0",
  x: 600,
  y: 550,
  w: 70,
  h: 50,
  hp: 75,
  maxHp: 75,
  kind: "table",
  dx: 0,
  dy: 0,
});
const bullet = (kind = "bullet") => ({
  x: 560,
  y: 560,
  vx: 30000,
  vy: 0,
  life: 2,
  r: 4,
  owner: 0,
  damage: 20,
  force: 350,
  kind,
  hitIds: [],
});

test("weapons are collected without a pickup button and do not replace held weapons", () => {
  const w = lab(),
    p = w.players[0];
  w.drops.push({
    x: 550,
    y: 580,
    type: "minigun",
    ammo: 80,
    vx: 0,
    vy: 0,
    life: 10,
  });
  w.step(STEP);
  assert.equal(p.weapon, "minigun");
  assert.equal(w.drops.length, 0);
  w.drops.push({
    x: 550,
    y: 580,
    type: "railgun",
    ammo: 4,
    vx: 0,
    vy: 0,
    life: 10,
  });
  advance(w, 0.3);
  assert.equal(p.weapon, "minigun");
  assert.equal(w.drops[0].type, "railgun");
});

test("automatic pickup does not reach through solid cover", () => {
  const w = lab();
  w.cover = [{ ...table(), x: 550, w: 12 }];
  w.drops = [
    { x: 570, y: 570, type: "railgun", ammo: 4, vx: 0, vy: 0, life: 10 },
  ];
  w.pickup(w.players[0]);
  assert.equal(w.players[0].weapon, null);
});

test("throw input launches the held weapon once, preserves ammo and cannot immediately recollect it", () => {
  const w = lab(),
    p = w.players[0];
  p.weapon = "railgun";
  p.ammo = 3;
  w.step(STEP, { 0: { throw: true, aim: -Math.PI / 4 } });
  assert.equal(p.weapon, null);
  assert.equal(w.projectiles.length, 0);
  assert.equal(w.drops.length, 1);
  assert.equal(w.drops[0].ammo, 3);
  assert.ok(w.drops[0].vx > 400 && w.drops[0].vy < -400);
  w.pickup(p);
  assert.equal(p.weapon, null);
  advance(w, 0.1, { 0: { throw: true } });
  assert.equal(w.events.filter((e) => e.type === "throw").length, 1);
});

test("a thrown weapon damages another player then becomes a normal pickup", () => {
  const w = lab(),
    p = w.players[0];
  w.players[1].x = 640;
  p.weapon = "shotgun";
  p.ammo = 4;
  w.throwWeapon(p);
  for (let n = 0; n < 25; n++) w.updateDrops(STEP);
  assert.equal(w.players[1].hp, 78);
  assert.equal(w.drops[0].armed, false);
  w.drops[0].lock = 0;
  w.drops[0].ownerLock = 0;
  Object.assign(p, { x: w.drops[0].x, y: w.drops[0].y, pickupCooldown: 0 });
  w.pickup(p);
  assert.equal(p.weapon, "shotgun");
  assert.equal(p.ammo, 4);
});

test("fast bullets hit the first table and cannot damage the player behind it", () => {
  const w = lab();
  w.cover = [table()];
  w.projectiles = [bullet()];
  w.updateProjectiles(STEP);
  assert.equal(w.cover[0].hp, 55);
  assert.equal(w.players[1].hp, 100);
  assert.equal(w.projectiles.length, 0);
});

test("destroying cover opens the shot path and produces physical fragments", () => {
  const w = lab();
  w.cover = [table()];
  w.damageCover(w.cover[0], 80, 900, -100);
  assert.equal(w.cover[0].hp, 0);
  assert.equal(w.debris.length, 9);
  const oldY = w.debris[0].y;
  w.updateDebris(STEP);
  assert.notEqual(w.debris[0].y, oldY);
  w.projectiles = [bullet()];
  w.updateProjectiles(STEP);
  assert.equal(w.players[1].hp, 80);
});

test("melee attacks damage the table before anyone behind it", () => {
  const w = lab(),
    p = w.players[0];
  w.cover = [{ ...table(), x: 565, w: 20 }];
  w.players[1].x = 600;
  w.attack(p);
  assert.equal(w.cover[0].hp, 40);
  assert.equal(w.players[1].hp, 100);
});

test("railgun penetrates a table and multiple players without hitting them twice", () => {
  const w = new World({ players: [0, 1, 2], arena: 0 });
  w.cover = [table()];
  w.platforms = [];
  Object.assign(w.players[0], { x: 530, y: 570 });
  Object.assign(w.players[1], { x: 710, y: 570 });
  Object.assign(w.players[2], { x: 780, y: 570 });
  w.projectiles = [{ ...bullet("rail"), damage: 85 }];
  w.updateProjectiles(STEP);
  assert.equal(w.cover[0].hp, 0);
  assert.equal(w.players[1].hp, 15);
  assert.equal(w.players[2].hp, 15);
  w.updateProjectiles(STEP);
  assert.equal(w.players[2].hp, 15);
});

test("plasma reflects from a solid wall and detonates after its bounces are exhausted", () => {
  const w = lab();
  w.platforms.push({ x: 650, y: 450, w: 20, h: 100 });
  w.projectiles = [
    { ...bullet("plasma"), y: 500, vx: 1600, bounces: 2, radius: 105 },
  ];
  for (let n = 0; n < 10; n++) w.updateProjectiles(STEP);
  assert.equal(w.projectiles[0].bounces, 1);
  assert.ok(w.projectiles[0].vx < 0);
  Object.assign(w.projectiles[0], { x: 640, y: 500, vx: 1600, bounces: 0 });
  w.updateProjectiles(STEP);
  assert.equal(w.projectiles.length, 0);
  assert.ok(w.events.some((e) => e.type === "explosion"));
});

test("triple rocket launcher creates three distinct trajectories and heavy recoil", () => {
  const w = lab(),
    p = w.players[0];
  p.weapon = "barrage";
  p.ammo = 3;
  w.attack(p);
  assert.equal(w.projectiles.length, 3);
  assert.equal(new Set(w.projectiles.map((b) => b.vy)).size, 3);
  assert.ok(p.vx <= -300);
  assert.equal(p.ammo, 2);
});

test("concrete walls stop fast rounds and block blast damage on other floors", () => {
  const w = lab();
  w.platforms.push({ x: 620, y: 510, w: 12, h: 90 });
  w.projectiles = [bullet("rail")];
  w.updateProjectiles(STEP);
  assert.equal(w.players[1].hp, 100);
  assert.equal(w.projectiles.length, 0);
  w.explode({ x: 610, y: 560, radius: 200, damage: 70, force: 1000 });
  assert.equal(w.players[1].hp, 100);
  assert.ok(w.players[0].hp < 100);
});

test("tables absorb an explosion before breaking", () => {
  const w = lab();
  w.cover = [table()];
  w.players[1].x = 700;
  w.explode({ x: 585, y: 560, radius: 180, damage: 70, force: 1000 });
  assert.equal(w.cover[0].hp, 0);
  assert.ok(w.players[1].hp > 90);
});

for (const arena of CITY_ARENAS)
  test(`elevators carry standing and prone passengers for a full return trip in arena ${arena}`, () => {
    for (const duck of [false, true]) {
      const w = new World({ arena, shuffle: false });
      w.phase = "fight";
      w.weaponTimer = 999;
      w.drops = [];
      const lifts = w.platforms.filter((s) => s.elevator);
      for (const lift of lifts) {
        const p = w.players[0];
        // Isolate each shaft while retaining all real geometry, so ceilings are tested too.
        w.time = 0;
        w.movePlatforms();
        Object.assign(p, {
          x: lift.x + lift.w / 2,
          y: lift.y - (duck ? 10 : 30),
          vx: 0,
          vy: 0,
          alive: true,
          hp: 100,
          ground: true,
          prone: duck,
          support: lift.id,
        });
        const bottom = duck ? 10 : 30;
        for (let n = 0; n < Math.ceil((2 * Math.PI) / lift.speed / STEP); n++) {
          w.time += STEP;
          w.movePlatforms();
          w.move(
            p,
            { left: false, right: false, jump: false, duck, aim: null },
            STEP,
          );
          assert.ok(
            Math.abs(p.y + bottom - lift.y) < 0.5,
            `passenger left elevator at ${w.time}: ${p.y + bottom} versus ${lift.y}`,
          );
          assert.ok(p.ground);
        }
      }
    }
  });

test("loose weapons ride elevators in both directions and jumping releases support", () => {
  const w = new World({ arena: CITY_ARENAS[0] });
  w.phase = "fight";
  w.weaponTimer = 999;
  const lift = w.platforms.find((s) => s.elevator),
    p = w.players[0];
  const d = {
    x: lift.x + lift.w / 2,
    y: lift.y - 7,
    vx: 0,
    vy: 0,
    type: "railgun",
    ammo: 4,
    life: 99,
    support: lift.id,
  };
  w.drops = [d];
  for (let n = 0; n < 1200; n++) {
    w.time += STEP;
    w.movePlatforms();
    w.updateDrops(STEP);
    assert.ok(Math.abs(d.y + 7 - lift.y) < 0.5);
  }
  Object.assign(p, {
    x: lift.x + lift.w / 2,
    y: lift.y - 30,
    vx: 0,
    vy: 0,
    ground: true,
    support: lift.id,
  });
  w.move(p, { jump: true, aim: null }, STEP);
  assert.equal(p.ground, false);
  assert.equal(p.support, null);
  assert.ok(p.vy < -600);
});

test("new arenas, weapons, thrown items and destroyed cover serialize for online guests", () => {
  for (const arena of CITY_ARENAS) {
    const w = new World({ arena });
    w.phase = "fight";
    for (const type of Object.keys(WEAPONS)) {
      w.players[0].weapon = type;
      w.players[0].ammo = WEAPONS[type].ammo;
      w.attack(w.players[0]);
    }
    w.players[0].weapon = "minigun";
    w.throwWeapon(w.players[0]);
    w.damageCover(w.cover[0], 100);
    advance(w, 0.05);
    assert.equal(validSnapshot(JSON.parse(JSON.stringify(w.snapshot()))), true);
    const bad = structuredClone(w.snapshot());
    bad.cover[0].hp = NaN;
    assert.equal(validSnapshot(bad), false);
  }
});

test("the skyscraper rotation stays within the selected map set", () => {
  const w = new World({
    arena: CITY_ARENAS[0],
    arenaPool: CITY_ARENAS,
    random: () => 0.99,
  });
  w.phase = "result";
  w.phaseTime = 0;
  w.step(STEP);
  assert.ok(CITY_ARENAS.includes(w.arenaIndex));
  assert.notEqual(w.arenaIndex, CITY_ARENAS[0]);
});

test("automatic pickup cannot catch an incoming thrown weapon before impact", () => {
  const w = lab();
  w.players[1].x = 900;
  w.players[0].weapon = "shotgun";
  w.players[0].ammo = 4;
  w.step(STEP, { 0: { throw: true } });
  advance(w, 0.55);
  assert.equal(w.players[1].hp, 78);
});
