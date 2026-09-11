import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { makeRig } from "../src/puppet.js";
import { knockDown } from "../src/knockdown.js";

function fixture() {
  const w = new World({ players: [0, 1], bots: [], shuffle: false, random: () => 0.4 });
  w.phase = "fight";
  w.cover = []; w.hazards = []; w.drops = []; w.weaponTimer = 999;
  w.arena = { ...w.arena, spikes: [] };
  w.platforms = [{ id: "floor", x: 0, y: 1000, w: 2560, h: 8,
    baseX: 0, baseY: 1000, dx: 0, dy: 0 }];
  for (const p of w.players) {
    Object.assign(p, { x: 700 + p.id * 900, y: 970, vx: 0, vy: 0,
      ground: true, support: "floor" });
    p.rig = makeRig(p);
  }
  return w;
}

function aboveFloor(w, p) {
  assert.ok(p.y + (p.prone ? 10 : 30) <= w.platforms[0].y + 0.001,
    `fighter penetrated floor: y=${p.y}, prone=${p.prone}`);
}

for (const force of [60, 120, 360]) for (const releaseAfter of [0, 1, 4])
  test(`standing after a prone hit stays above thin flooring (force ${force}, delay ${releaseAfter})`, () => {
    const w = fixture(), p = w.players[0];
    w.move(p, cleanInput({ duck: true }), STEP);
    w.hit(p, w.players[1], 5, force, 1, -0.5);
    w.hitstop = 0;
    assert.equal(p.ground, false, "the hit lifts the fighter off its support");
    for (let n = 0; n < 180; n++) {
      w.step(STEP, { 0: { duck: n < releaseAfter } });
      aboveFloor(w, p);
    }
    assert.ok(p.alive && p.ground && !p.prone);
    assert.equal(p.support, "floor");
    assert.ok(p.x > 710, "collision repair must preserve the hit's horizontal impulse");
  });

test("holding S through a hit and landing retains prone floor collision", () => {
  const w = fixture(), p = w.players[0];
  w.move(p, cleanInput({ duck: true }), STEP);
  w.hit(p, w.players[1], 5, 360, 1);
  for (let n = 0; n < 180; n++) {
    w.step(STEP, { 0: { duck: true } });
    aboveFloor(w, p);
  }
  assert.ok(p.prone && p.ground && p.alive);
});

test("a prone fighter cannot cross a thin floor at the maximum fall speed and step", () => {
  const w = fixture(), p = w.players[0];
  Object.assign(p, { y: 989.5, prone: true, ground: false, support: null, vy: 1150 });
  w.step(0.025, { 0: { duck: true } });
  aboveFloor(w, p);
  assert.ok(p.ground && p.prone);
  assert.equal(p.support, "floor");
});

test("airborne posture changes preserve the feet and do not create vertical motion", () => {
  const w = fixture(), p = w.players[0];
  Object.assign(p, { y: 700, ground: false, support: null, vy: 0 });
  for (let n = 0; n < 8; n++) {
    const feet = p.y + (p.prone ? 10 : 30);
    w.move(p, cleanInput({ duck: n % 2 === 0 }), STEP);
    assert.ok(Math.abs(p.y + (p.prone ? 10 : 30) - feet - p.vy * STEP) < 0.00001);
  }
});

test("releasing S after a hit beneath a low ceiling stays prone until there is headroom", () => {
  const w = fixture(), p = w.players[0];
  w.move(p, cleanInput({ duck: true }), STEP);
  w.platforms.push({ id: "ceiling", x: 500, y: 945, w: 500, h: 20 });
  w.hit(p, w.players[1], 5, 60, 1);
  for (let n = 0; n < 120; n++) {
    w.step(STEP);
    assert.equal(p.prone, true);
    aboveFloor(w, p);
    assert.ok(p.y - 10 >= 965);
  }
  w.platforms.pop();
  w.step(STEP);
  assert.equal(p.prone, false);
  aboveFloor(w, p);
});

test("lying down beside a wall waits for enough width instead of growing into it", () => {
  const w = fixture(), p = w.players[0];
  w.platforms.push({ id: "wall", x: 720, y: 900, w: 20, h: 100 });
  w.move(p, cleanInput({ duck: true }), STEP);
  assert.equal(p.prone, false);
  assert.equal(p.x, 700);
  p.x = 680;
  w.move(p, cleanInput({ duck: true }), STEP);
  assert.equal(p.prone, true);
  aboveFloor(w, p);
});

for (const duck of [false, true]) test(`thrown knockdown from prone recovers above the floor with S ${duck ? "held" : "released"}`, () => {
  const w = fixture(), p = w.players[0];
  for (let n = 0; n < 60; n++) w.step(STEP, { 0: { duck: true } });
  w.hit(p, w.players[1], 22, 600, 1, -0.35);
  knockDown(p, "bat");
  for (let n = 0; n < 360; n++) {
    w.step(STEP, { 0: { duck } });
    if (!p.knockdown) aboveFloor(w, p);
    assert.ok(p.alive);
  }
  assert.ok(!p.knockdown && p.ground);
  assert.equal(p.prone, duck);
});

test("stance changes after hits land on a moving floor", () => {
  const w = fixture(), p = w.players[0];
  Object.assign(w.platforms[0], { move: 60, speed: 2, travel: -90 });
  w.step(STEP, { 0: { duck: true } });
  w.hit(p, w.players[1], 5, 120, 1);
  for (let n = 0; n < 180; n++) {
    w.step(STEP, { 0: { duck: n % 8 < 4 } });
    aboveFloor(w, p);
  }
  assert.ok(p.alive && p.ground);
  assert.equal(p.support, "floor");
});

test("prone fighters still fall through a real gap in the floor", () => {
  const w = fixture(), p = w.players[0];
  w.platforms = [ { ...w.platforms[0], w: 550 },
    { ...w.platforms[0], id: "right", x: 850, w: 1710 } ];
  for (let n = 0; n < 180 && p.alive; n++) w.step(STEP, { 0: { duck: n % 2 === 0 } });
  assert.equal(p.alive, false);
  assert.equal(w.lastDeathCause, "fall");
});
