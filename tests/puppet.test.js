import { combatFloor } from "./helpers.js";
import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { JOINTS, makeRig } from "../src/puppet.js";
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

for (const kind of ["solid", "slatted", "cable"]) for (const gap of [80, 120, 180]) {
  test(`jumping below a ${kind} platform ${gap} units overhead cannot pin the head or stretch limbs`, () => {
    const w = new World({ players: [0], bots: [], fillSolo: false, shuffle: false, random: () => .5 });
    w.phase = "fight";
    combatFloor(w);
    w.spikes = () => [];
    const ceiling = { id: "ceiling", x: 400, y: 800 - gap, w: 400, h: 16,
      oneWay: kind === "slatted", material: kind === "cable" ? "cable" : "metal" };
    if (kind === "cable") ceiling.circuit = 0;
    w.platforms = [{ id: "floor", x: 0, y: 800, w: 2500, h: 30 }, ceiling];
    for (const s of w.platforms) Object.assign(s, { baseX: s.x, baseY: s.y, dx: 0, dy: 0 });
    const p = w.players[0];
    Object.assign(p, { x: 600, y: 770, vx: 0, vy: 0, ground: true, support: "floor" });
    p.rig = makeRig(p);
    let landedAbove = false, headCleared = false;
    for (let n = 0; n < 360; n++) {
      w.step(STEP, { 0: { jump: n === 30 || n === 160 } });
      for (const [a, b, length] of JOINTS) {
        const distance = Math.hypot(p.rig[a].x - p.rig[b].x, p.rig[a].y - p.rig[b].y);
        assert.ok(distance < length + 6, `frame ${n}, joint ${a}-${b} stretched to ${distance}`);
      }
      if (kind === "solid") assert.ok(p.rig[0].y - 10 >= ceiling.y + ceiling.h,
        "the physical head stays below the solid ceiling");
      landedAbove ||= p.support === ceiling.id;
      headCleared ||= p.rig[0].y + 10 < ceiling.y;
    }
    assert.equal(landedAbove, kind !== "solid" && gap < 180);
    if (kind !== "solid" && gap === 180) {
      assert.ok(headCleared, "reproduce a jump where the head clears but the feet do not");
      assert.equal(p.support, "floor", "the entire rig returns to the lower floor");
      assert.ok(p.rig[0].y > ceiling.y + ceiling.h);
    }
    assert.ok(validSnapshot(w.snapshot()));
  });
}
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
