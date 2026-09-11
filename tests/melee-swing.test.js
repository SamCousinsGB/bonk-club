import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS } from "../src/engine.js";
import { makeRig, updateRig } from "../src/puppet.js";
import { updateMelee } from "../src/melee.js";
import { meleeBlade } from "../src/melee-pose.js";
import { validSnapshot } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { combatFloor } from "./helpers.js";

function setup(weapon, facing = 1) {
  const w = new World({ players: [0, 1], shuffle: false });
  combatFloor(w); w.phase = "fight";
  const [p, q] = w.players;
  Object.assign(p, { x: 600, y: 535, vx: 0, vy: 0, ground: false,
    airLunge: true, weapon, ammo: 4, facing, aimAngle: facing === 1 ? 0 : Math.PI });
  Object.assign(q, { x: 1600, y: 535, vx: 0, vy: 0 });
  p.rig = makeRig(p); q.rig = makeRig(q);
  for (let i = 0; i < 60; i++) updateRig(p, STEP, [], 0);
  return { w, p, q };
}
// Isolate the weapon path from target movement and hitstop.
function advance(w, p, duration) {
  for (let t = 0; t < duration; t += STEP) {
    p.swing = Math.max(0, p.swing - STEP);
    updateRig(p, STEP, [], t);
    updateMelee(w, p);
  }
}

for (const weapon of ["bat", "sword", "hammer"]) {
  for (const facing of [1, -1]) {
    test(`${weapon} winds up, sweeps overhead and follows through facing ${facing}`, () => {
      const { w, p, q } = setup(weapon, facing);
      q.x = p.x + facing * 35; q.y = p.y - 112;
      w.attack(p);
      advance(w, p, p.swingDuration * 0.15);
      assert.equal(q.hp, 100, "wind-up cannot deal damage");
      const raised = meleeBlade(p), raisedHand = p.rig[6].y;
      advance(w, p, p.swingDuration * 0.55);
      const lowered = meleeBlade(p);
      assert.equal(q.hp, 100 - WEAPONS[weapon].damage, "arc reaches above the old straight poke");
      assert.ok(lowered.tipY > raised.tipY + 80, "weapon crosses from above to below");
      assert.ok(p.rig[6].y > raisedHand + 20, "arm follows the swing");
      advance(w, p, p.swingDuration);
      assert.equal(q.hp, 100 - WEAPONS[weapon].damage, "one hit per target");
    });
  }
  test(`${weapon} sweep hits in front, respects walls and damages each cover object once`, () => {
    const { w, p, q } = setup(weapon);
    q.x = 675; q.y = 510;
    const wall = { id: "wall", x: 635, y: 360, w: 12, h: 250,
      hp: 200, maxHp: 200, kind: "crate" };
    w.platforms = []; w.cover = [wall];
    w.attack(p); advance(w, p, p.swingDuration);
    assert.equal(q.hp, 100, "solid wall blocks the opponent");
    assert.equal(wall.hp, 200 - WEAPONS[weapon].damage * 1.8);
    w.cover = []; p.cooldown = 0;
    w.attack(p); advance(w, p, p.swingDuration);
    assert.equal(q.hp, 100 - WEAPONS[weapon].damage);
  });
  test(`${weapon} cannot hit during recovery or after being thrown`, () => {
    const { w, p, q } = setup(weapon);
    w.attack(p); advance(w, p, p.swingDuration * 0.8);
    q.x = 670; q.y = 510;
    advance(w, p, 0.2);
    assert.equal(q.hp, 100);
    q.x = 1600; w.attack(p); advance(w, p, p.swingDuration * 0.25);
    w.throwWeapon(p); q.x = 650;
    advance(w, p, 0.3);
    assert.equal(q.hp, 100, "throw cancels held weapon contacts");
    assert.equal(w.drops[0].ammo, 2);
  });
  test(`${weapon} can be parried and the remaining arc cannot hit again`, () => {
    const { w, p, q } = setup(weapon);
    Object.assign(q, { x: 665, y: 510, facing: -1, aimAngle: Math.PI,
      block: true, blockTime: 0 });
    w.attack(p); advance(w, p, p.swingDuration * 0.65);
    assert.equal(q.hp, 100);
    assert.equal(w.events.filter(e => e.type === "parry").length, 1);
    p.stun = 0; q.block = false;
    advance(w, p, p.swingDuration);
    assert.equal(q.hp, 100);
  });
}

test("guest swing timing interpolates within an attack, preserves the last use and resets", () => {
  const { w, p } = setup("sword"), encoder = new RenderSnapshots();
  p.ammo = 1; w.attack(p);
  advance(w, p, 0.1);
  const a = encoder.make(w.snapshot());
  advance(w, p, 0.05);
  const b = encoder.make(w.snapshot()), middle = interpolateStates(a, b, 0.5);
  assert.ok(validSnapshot(a) && validSnapshot(b) && validSnapshot(middle));
  assert.equal(middle.players[0].weapon, "sword");
  assert.equal(middle.players[0].ammo, 0);
  assert.ok(middle.players[0].swing < a.players[0].swing && middle.players[0].swing > b.players[0].swing);
  const remaining = p.swing; w.attack(p);
  assert.equal(p.swing, remaining, "no extra attack from an exhausted weapon");
  p.ammo = 2; w.attack(p);
  const next = encoder.make(w.snapshot());
  assert.equal(interpolateStates(b, next, 0.5).players[0].swing, next.players[0].swing);
  w.startRound();
  const reset = w.players[0];
  assert.equal(reset.swing, 0); assert.equal(reset.weapon, null);
  updateMelee(w, reset);
  assert.equal(w.players[1].hp, 100);
});
