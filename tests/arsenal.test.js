import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput, WEAPONS } from "../src/engine.js";
import { chooseWeapon } from "../src/arsenal.js";
import { updateFields } from "../src/specials.js";
import { validSnapshot } from "../src/network.js";
import { combatFloor } from "./helpers.js";
const advance = (w, seconds, inputs = {}) => {
  for (let n = 0; n < seconds / STEP; n++) w.step(STEP, inputs);
};
function arena(bots = []) {
  const w = new World({
    players: [0, 1, 2, 3],
    bots,
    shuffle: false,
    random: () => 0.4,
  });
  w.phase = "fight";
  combatFloor(w);
  w.players.forEach((p, n) =>
    Object.assign(p, {
      x: 500 + n * 500,
      y: 535,
      ground: true,
      support: "floor0",
      aimAngle: n ? Math.PI : 0,
    }),
  );
  return w;
}
function fire(w, type, x = 600, y = 535) {
  const p = w.players[0];
  Object.assign(p, {
    weapon: type,
    ammo: WEAPONS[type].ammo,
    aimAngle: 0,
    x,
    y,
    cooldown: 0,
  });
  w.attack(p);
  return w.projectiles.at(-1);
}
test("held attack lands punch, kick and spin with a directional chase, healing only on contact", () => {
  const w = arena(),
    [p, q] = w.players;
  Object.assign(p, { hp: 65 });
  Object.assign(q, { x: 563 });
  const moves = new Set();
  for (let n = 0; n < 210 && q.alive; n++) {
    w.step(STEP, {
      0: {
        attack: true,
        right: q.x > p.x + 35,
        aim: Math.atan2(q.y - p.y, q.x - p.x),
      },
    });
    if (p.swing > 0) moves.add(p.meleeMove);
  }
  assert.deepEqual([...moves], ["punch", "kick", "spin"]);
  assert.equal(q.alive, false);
  assert.equal(p.hp, 77);
  assert.ok(q.vx > 800);
  assert.ok(p.x > 550, String(p.x));
});
test("a missed combo cannot heal, stacks no unlimited air boost, and expires after a gap", () => {
  const w = arena(),
    p = w.players[0];
  Object.assign(p, { ground: false, hp: 50, aimAngle: -Math.PI / 2, y: 250 });
  w.attack(p);
  const first = p.vy;
  w.attack(p);
  w.attack(p);
  assert.equal(p.hp, 50);
  assert.equal(p.vy, first);
  assert.ok(p.airLunge);
  p.comboTime = 0;
  w.attack(p);
  assert.equal(p.meleeMove, "punch");
});
test("spin hits both sides but cannot hit through a solid wall; parries remain a counter", () => {
  const w = arena(),
    [p, q, r] = w.players;
  q.x = 550;
  r.x = 450;
  p.comboStep = 2;
  p.comboTime = 0.8;
  w.attack(p);
  assert.equal(q.hp, 57);
  assert.equal(r.hp, 57);
  q.hp = 100;
  p.comboStep = 2;
  p.comboTime = 0.8;
  w.platforms.push({ id: "wall", x: 525, y: 400, w: 10, h: 160 });
  w.attack(p);
  assert.equal(q.hp, 100);
  w.platforms.pop();
  p.comboTime = 0;
  q.block = true;
  q.blockTime = 0;
  q.facing = -1;
  w.attack(p);
  assert.equal(q.hp, 100);
  assert.ok(p.stun > 0);
});
test("unarmed bots close the distance and finish melee without hunting distant pickups or crawling", () => {
  const w = arena([0]),
    [p, q] = w.players;
  q.x = 820;
  w.drops.push({
    x: 100,
    y: 545,
    type: "railgun",
    ammo: 4,
    life: 60,
    vx: 0,
    vy: 0,
  });
  let duckFrames = 0;
  const moves = new Set();
  for (let n = 0; n < 720 && q.alive; n++) {
    w.step(STEP);
    if (p.prone) duckFrames++;
    if (p.swing > 0) moves.add(p.meleeMove);
  }
  assert.equal(q.alive, false);
  assert.equal(p.weapon, null);
  assert.equal(duckFrames, 0);
  assert.ok(moves.has("spin"));
});
test("heavy machine gun requires a grounded prone stance and bots deploy before firing", () => {
  const w = arena([0]),
    p = w.players[0];
  fire(w, "machinegun");
  assert.equal(w.projectiles.length, 0);
  assert.equal(p.ammo, 100);
  p.prone = true;
  p.ground = false;
  w.attack(p);
  assert.equal(w.projectiles.length, 0);
  p.ground = true;
  w.attack(p);
  assert.equal(p.ammo, 99);
  p.prone = false;
  advance(w, 1.5);
  assert.ok(p.prone);
  assert.ok(p.ammo < 90);
  assert.ok(w.players[1].hp < 100);
});
test("fire burns after contact and the freeze ray slows without permanently disabling movement", () => {
  for (const type of ["flame", "frost"]) {
    const w = arena(),
      q = w.players[1];
    q.x = 730;
    fire(w, type);
    for (let n = 0; n < 40; n++) w.updateProjectiles(STEP);
    assert.ok(q.hp < 100);
    assert.ok(type === "flame" ? q.burn > 0 : q.chill > 0);
    const hp = q.hp;
    for (let n = 0; n < 100; n++) w.move(q, cleanInput({ right: true }), STEP);
    if (type === "flame") assert.ok(q.hp < hp);
    else {
      assert.ok(q.vx < 145);
      for (let n = 0; n < 180; n++)
        w.move(q, cleanInput({ right: true }), STEP);
      assert.ok(q.vx > 230);
    }
  }
});
test("ricochet shots and sawblades bounce; sawblades can pierce multiple opponents", () => {
  for (const type of ["ricochet", "saw"]) {
    const w = arena();
    w.platforms.push({ id: "wall", x: 750, y: 400, w: 20, h: 160 });
    const b = fire(w, type);
    for (let n = 0; n < 28; n++) w.updateProjectiles(STEP);
    assert.ok(b.vx < 0);
    assert.ok(b.life > 0);
  }
  const w = arena();
  w.players[1].x = 710;
  w.players[2].x = 780;
  fire(w, "saw");
  for (let n = 0; n < 45; n++) w.updateProjectiles(STEP);
  assert.ok(w.players[1].hp < 100 && w.players[2].hp < 100);
});
test("Tesla chains to nearby fighters but solid cover blocks the chain", () => {
  for (const wall of [false, true]) {
    const w = arena();
    w.players[1].x = 740;
    w.players[2].x = 920;
    if (wall) w.platforms.push({ id: "wall", x: 820, y: 400, w: 20, h: 160 });
    fire(w, "tesla");
    for (let n = 0; n < 15; n++) w.updateProjectiles(STEP);
    assert.ok(w.players[1].hp < 100);
    assert.equal(w.players[2].hp < 100, !wall);
  }
});
test("homing rockets steer and cluster bombs release six secondary explosives", () => {
  const w = arena();
  w.players[1].y = 400;
  const rocket = fire(w, "homing");
  w.updateProjectiles(STEP);
  assert.ok(rocket.vy < 0);
  w.projectiles = [];
  const cluster = fire(w, "cluster");
  cluster.life = STEP / 2;
  w.updateProjectiles(STEP);
  assert.equal(w.projectiles.length, 6);
  assert.ok(w.projectiles.every((p) => !p.cluster));
});
test("black holes arm, attract all sides and loose items, damage nearby fighters, then expire", () => {
  const w = arena(),
    [p, q] = w.players;
  const b = fire(w, "blackhole");
  b.life = 0.001;
  w.updateProjectiles(STEP);
  assert.equal(w.fields.length, 1);
  const f = w.fields[0];
  Object.assign(p, { x: f.x - 60, y: f.y, vx: 0, vy: 0 });
  Object.assign(q, { x: f.x + 60, y: f.y, vx: 0, vy: 0 });
  const d = {
    x: f.x + 100,
    y: f.y,
    vx: 0,
    vy: 0,
    type: "bat",
    ammo: 8,
    life: 20,
  };
  w.drops = [d];
  for (let n = 0; n < 60; n++) updateFields(w, STEP);
  assert.ok(p.vx > 0 && q.vx < 0 && d.vx < 0);
  assert.ok(p.hp < 100 && q.hp < 100);
  assert.ok(validSnapshot(w.snapshot()));
  for (let n = 0; n < 600; n++) updateFields(w, STEP);
  assert.equal(w.fields.length, 0);
});
test("repulsor redirects incoming shots and has much more force than damage", () => {
  const w = arena();
  w.players[1].x = 760;
  const force = fire(w, "repulsor");
  w.projectiles.push({
    x: 640,
    y: 525,
    vx: -800,
    vy: 0,
    owner: 1,
    kind: "bullet",
    r: 4,
    life: 2,
    damage: 9,
    force: 10,
  });
  const shot = w.projectiles[1];
  w.updateProjectiles(STEP);
  assert.equal(shot.owner, 0);
  assert.ok(shot.vx > 0);
  for (let n = 0; n < 22; n++) w.updateProjectiles(STEP);
  assert.ok(w.players[1].vx > 1400);
  assert.ok(w.players[1].hp >= 75);
  assert.ok(force.hitIds.includes(1));
});
test("all 23 weapons and their effects produce valid online snapshots", () => {
  assert.equal(Object.keys(WEAPONS).length, 23);
  for (const type of Object.keys(WEAPONS)) {
    const w = arena();
    if (WEAPONS[type].proneOnly) w.players[0].prone = true;
    fire(w, type);
    for (let n = 0; n < 100; n++) {
      w.updateProjectiles(STEP);
      updateFields(w, STEP);
      assert.ok(validSnapshot(w.snapshot()), type);
    }
  }
  const s = arena().snapshot();
  s.fields.push({
    kind: "blackhole",
    x: 5,
    y: 5,
    ex: 5,
    ey: 5,
    life: 4,
    radius: Infinity,
  });
  assert.equal(validSnapshot(s), false);
});
test("rarity is weighted across tiers, including initial map pickups", () => {
  const counts = { common: 0, uncommon: 0, rare: 0, exotic: 0 };
  for (let n = 0; n < 10000; n++) {
    let next = n / 10000;
    counts[
      WEAPONS[
        chooseWeapon(() => {
          const v = next;
          next = 0.5;
          return v;
        })
      ].rarity
    ]++;
  }
  assert.deepEqual(counts, {
    common: 6800,
    uncommon: 2500,
    rare: 600,
    exotic: 100,
  });
  const w = new World({ arena: 16, random: () => 0.2 });
  assert.ok(w.drops.length > 0);
  assert.ok(w.drops.every((d) => WEAPONS[d.type].rarity === "common"));
});
test("running stance stays upright and recovers after crouching in either direction", () => {
  for (const direction of [-1, 1]) {
    const w = arena(),
      p = w.players[0];
    p.x = 1200;
    w.players[1].x = 2300;
    advance(w, 0.5, { 0: { duck: true } });
    advance(w, 1.5, { 0: { left: direction < 0, right: direction > 0 } });
    assert.equal(p.prone, false);
    const head = p.rig[0],
      hip = p.rig[2];
    assert.ok(hip.y - head.y > 35, `${direction}: ${hip.y - head.y}`);
    assert.ok(Math.abs(head.x - hip.x) < 22);
  }
});
