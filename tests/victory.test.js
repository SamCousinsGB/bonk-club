import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, H, WEAPONS, emptyInput } from "../src/engine.js";
import { makeRig } from "../src/puppet.js";
import { nuclearField } from "../src/nuclear.js";
import { blackholeField } from "../src/blackhole.js";
import { updateFields } from "../src/specials.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { encodeState, decodeState, validSnapshot } from "../src/network.js";
import { VICTORY_MESSAGES, victoryMessage } from "../src/victory.js";
import { SUDDEN_DEATH } from "../src/scale.js";
import { combatFloor } from "./helpers.js";

function fixture(ids = [0, 1]) {
  const w = new World({ players: ids, shuffle: false, random: () => .4 });
  combatFloor(w);
  w.phase = "fight";
  w.players.forEach((p, i) => {
    Object.assign(p, { x: 500 + i * 300, y: 535, vx: 0, vy: 0,
      ground: true, support: "floor0", aimAngle: 0 });
    p.rig = makeRig(p);
  });
  return w;
}
function finish(w, cause) {
  w.hitstop = 0;
  w.step(STEP);
  assert.equal(w.phase, "result");
  assert.equal(w.winner, 0);
  assert.equal(w.victoryCause, cause);
  assert.equal(w.scores[0], 1);
  assert.equal(victoryMessage(w.snapshot(), "Sam").detail, VICTORY_MESSAGES[cause]);
}

for (const [kind, create] of [["nuke", nuclearField], ["singularity", blackholeField]]) {
  test(`${kind} final elimination survives the pending field and expired death visuals`, () => {
    const w = fixture(), [winner, victim] = w.players;
    winner.x = 2300; winner.rig = makeRig(winner);
    w.fields.push(create(w, { x: victim.x, y: victim.y, owner: winner.id }));
    for (let n = 0; n < 80 && victim.alive; n++) updateFields(w, STEP);
    assert.equal(victim.alive, false);
    assert.equal(w.lastDeathCause, kind);
    w.step(STEP);
    assert.equal(w.phase, "fight", "wait for the dangerous field before declaring a winner");
    while (w.fields.length) { w.time += STEP; updateFields(w, STEP); w.updateRagdolls(STEP); }
    w.events = []; w.ragdolls = [];
    finish(w, kind);
  });
}

test("the final death overrides an earlier special kill and duplicate kills do not change it", () => {
  const w = fixture([0, 1, 2]);
  w.kill(w.players[1], { cause: "nuke" });
  w.players[2].y = H + 130;
  finish(w, "fall");
  w.kill(w.players[1], { effect: "singularity" });
  assert.equal(w.victoryCause, "fall");
});

test("a draw has no winner message and the next round clears the previous cause", () => {
  const w = fixture();
  for (const p of w.players) w.kill(p, { cause: "nuke" });
  w.step(STEP);
  assert.equal(w.winner, null);
  assert.equal(w.victoryCause, null);
  assert.deepEqual(victoryMessage(w.snapshot(), "Sam"), { title: "DRAW", detail: "" });
  w.startRound();
  assert.equal(w.victoryCause, null);
  assert.equal(w.lastDeathCause, null);
});

for (const [weapon, cause] of [["saw", "saw"], ["railgun", "railgun"], ["blaster", "bullet"],
  ["shotgun", "shotgun"], ["plasma", "plasma"], ["tesla", "tesla"], ["phaser", "phaser"],
  ["flame", "burn"], ["frost", "ice"], ["rocket", "blast"]]) {
  test(`a lethal ${weapon} attack records the actual finish even after using its last ammo`, () => {
    const w = fixture(), [p, q] = w.players;
    q.x = weapon === "flame" ? 610 : 800; q.hp = 1; q.rig = makeRig(q);
    Object.assign(p, { weapon, ammo: 1 });
    w.attack(p);
    for (let n = 0; n < 120 && q.alive; n++) w.updateProjectiles(STEP);
    assert.equal(q.alive, false, weapon);
    finish(w, cause);
  });
}

for (const [weapon, cause] of [[null, "punch"], ["bat", "bat"], ["sword", "sword"]]) {
  test(`a lethal ${weapon || "unarmed"} swing records its finish`, () => {
    const w = fixture(), [p, q] = w.players;
    q.x = 558; q.hp = 1; q.rig = makeRig(q);
    p.weapon = weapon; p.ammo = weapon ? WEAPONS[weapon].ammo : 0;
    for (let n = 0; n < 100 && q.alive; n++) w.step(STEP, { 0: { ...emptyInput(), attack: true } });
    assert.equal(q.alive, false);
    if (w.phase !== "result") finish(w, cause);
    else assert.equal(w.victoryCause, cause);
  });
}

test("burn damage, shattering ice and sudden death use their actual lethal effects", () => {
  const burning = fixture(), frozen = fixture(), sudden = fixture();
  burning.players[1].burn = 1; burning.players[1].hp = .001;
  finish(burning, "burn");
  frozen.players[1].freeze = 1; frozen.players[1].hp = 10;
  frozen.hit(frozen.players[1], frozen.players[0], 25, 0, 1, 0,
    { projectile: true, weapon: "railgun", effect: "slice", execute: true });
  finish(frozen, "ice");
  sudden.elapsed = SUDDEN_DEATH + 1; sudden.players[1].hp = .001;
  finish(sudden, "sudden");
});

test("throwing a weapon to finish a fighter records the throw", () => {
  const w = fixture(), [p, q] = w.players;
  q.x = 600; q.hp = 1; q.rig = makeRig(q);
  p.weapon = "bat"; p.ammo = 4;
  w.throwWeapon(p);
  for (let n = 0; n < 40 && q.alive; n++) w.updateDrops(STEP);
  assert.equal(q.alive, false);
  finish(w, "thrown");
});

test("removing a living opponent does not reuse an earlier kill message", () => {
  const w = fixture([0, 1, 2]);
  w.kill(w.players[1], { cause: "nuke" });
  w.syncSlots(["player", "player", "closed", "closed"],
    w.players.slice(0, 2).map(p => ({ ...p, bot: false })));
  w.step(STEP);
  assert.equal(w.victoryCause, null);
});

test("result messages survive compressed snapshots, interpolation and joining mid-result", async () => {
  const w = fixture();
  const wire = new RenderSnapshots();
  const before = wire.make(w.snapshot());
  w.kill(w.players[1], { effect: "singularity" });
  finish(w, "singularity");
  const decoded = await decodeState(await encodeState(wire.make(w.snapshot())));
  assert.ok(validSnapshot(decoded));
  assert.deepEqual(victoryMessage(decoded, "Sam"), {
    title: "SAM WON", detail: "By commanding the forces of space and time",
  });
  assert.equal(interpolateStates(before, decoded, .5).victoryCause, "singularity");
  const hotJoin = await decodeState(await encodeState(new RenderSnapshots().make(w.snapshot())));
  assert.ok(validSnapshot(hotJoin));
  assert.equal(hotJoin.victoryCause, "singularity");
  for (const bad of [undefined, {}, 1, "<img onerror=alert(1)>", "toString", "constructor"]) {
    assert.equal(validSnapshot({ ...decoded, victoryCause: bad }), false);
  }
});
