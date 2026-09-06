import { combatFloor } from "./helpers.js";
import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { JOINTS } from "../src/puppet.js";
import { validSnapshot } from "../src/network.js";
function setup() {
  const w = new World({ shuffle: false });
  w.phase = "fight";
  combatFloor(w);
  Object.assign(w.players[0], { x: 600, y: 535, ground: true });
  Object.assign(w.players[1], { x: 980, y: 535, ground: true });
  return w;
}
const run = (w, n, input = {}) => {
  for (let k = 0; k < n; k++) w.step(STEP, { 0: input });
};
test("holding down lies flat and releasing recovers standing height", () => {
  const w = setup(),
    p = w.players[0];
  run(w, 120, { duck: true });
  assert.equal(p.prone, true);
  assert.ok(Math.abs(p.bodyAngle) > 1);
  assert.ok(p.y > 550);
  const head = p.rig[0],
    hip = p.rig[2];
  assert.ok(Math.abs(head.x - hip.x) > Math.abs(head.y - hip.y));
  run(w, 120, {});
  assert.equal(p.prone, false);
  assert.ok(p.y < 540);
  assert.ok(Math.abs(p.bodyAngle) < 0.2);
});
test("an active skeleton has independent limbs and stable joint lengths", () => {
  const w = setup(),
    p = w.players[0];
  run(w, 60, { right: true });
  assert.equal(p.rig.length, 11);
  assert.ok(p.rig.some((q) => Math.abs(q.x - q.px) > 1));
  for (const [a, b, len] of JOINTS) {
    const d = Math.hypot(p.rig[a].x - p.rig[b].x, p.rig[a].y - p.rig[b].y);
    assert.ok(Math.abs(d - len) < 10, `joint ${a}-${b}: ${d}`);
  }
  assert.ok(validSnapshot(w.snapshot()));
});
test("a hit imparts angular momentum and limb impulses", () => {
  const w = setup(),
    [p, q] = w.players;
  run(w, 5);
  w.hit(p, q, 25, 600, -1);
  assert.ok(p.angularVelocity < -4);
  assert.ok(p.rig.some((point) => point.x - point.px < -1));
});
test("knockout keeps the live skeleton instead of replacing its pose", () => {
  const w = setup(),
    p = w.players[0];
  run(w, 70, { duck: true });
  const before = structuredClone(p.rig);
  w.kill(p);
  assert.deepEqual(w.ragdolls[0].points, before);
  assert.ok(validSnapshot(w.snapshot()));
});
test("aim controls projectile direction and recoil", () => {
  const w = setup(),
    p = w.players[0];
  p.weapon = "blaster";
  p.ammo = 4;
  p.aimAngle = -Math.PI / 2;
  w.attack(p);
  assert.ok(Math.abs(w.projectiles[0].vx) < 0.001);
  assert.ok(w.projectiles[0].vy < -1000);
  assert.ok(p.vy > 0);
});
test("lying down dodges a horizontal chest-height bullet", () => {
  const w = setup(),
    p = w.players[0];
  run(w, 90, { duck: true });
  w.projectiles.push({
    kind: "bullet",
    owner: 1,
    x: 600,
    y: 523,
    vx: 0,
    vy: 0,
    r: 4,
    damage: 17,
    force: 350,
    life: 2,
  });
  w.updateProjectiles(STEP);
  assert.equal(p.hp, 100);
});
test("mouse aim is bounded and rejects invalid or injected values", () => {
  assert.equal(cleanInput({ aim: Infinity }).aim, null);
  assert.equal(cleanInput({ aim: "<img>" }).aim, null);
  assert.equal(cleanInput({ aim: 100 }).aim, Math.PI);
});
test("malformed remote score and pose data are rejected before rendering", () => {
  const w = setup();
  run(w, 5);
  const s = structuredClone(w.snapshot());
  s.scores[0] = "<img onerror=alert(1)>";
  assert.equal(validSnapshot(s), false);
  s.scores[0] = 0;
  s.players[0].rig = [{}];
  assert.equal(validSnapshot(s), false);
});
