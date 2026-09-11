import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { prepareProp, bodyBounds, damageProp } from "../src/props.js";
import { carriedObject, pickupObjectCandidate, objectInput, releaseObject, cleanCarriedObjects } from "../src/object-carry.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { makeRig } from "../src/puppet.js";
import { knockDown } from "../src/knockdown.js";
import { blackholeField, updateBlackhole } from "../src/blackhole.js";

const floor = (id, x, y, w, h = 24) => ({ id, x, y, w, h, baseX: x, baseY: y, dx: 0, dy: 0 });
const prop = (extra = {}) => prepareProp({ id: "box", kind: "crate", x: 550, y: 950,
  w: 52, h: 50, hp: 110, maxHp: 110, ...extra });
function lab(extra = {}) {
  const w = new World({ players: [0, 1], shuffle: false, random: () => .43 });
  Object.assign(w, { phase: "fight", weaponTimer: 999, cover: [prop(extra)], chunks: [],
    drops: [], hazards: [], water: [], gas: [], spills: [], fields: [], projectiles: [] });
  w.arena = { ...w.arena, spikes: [] };
  w.platforms = [floor("ground", 0, 1000, 2560)];
  for (const p of w.players) {
    Object.assign(p, { x: p.id ? 2000 : 500, y: 970, vx: 0, vy: 0, facing: 1,
      aimAngle: 0, ground: true, support: "ground", weapon: null, ammo: 0 });
    p.rig = makeRig(p);
  }
  return w;
}
function tick(w, input = {}, seconds = STEP) {
  for (let i = 0; i < seconds / STEP; i++) w.step(STEP, { 0: input });
}
function grab(w) { tick(w, { block: true, aim: 0 }); assert.equal(w.players[0].carryId, "box"); }

test("right-click claims the nearest front object, without teleporting or parrying", () => {
  const w = lab(), b = w.cover[0];
  w.cover.push(prop({ id: "behind", x: 425 }), prop({ id: "far", x: 620 }));
  grab(w);
  assert.equal(w.players[0].block, false);
  assert.equal(w.players[0].parryCooldown, 0);
  assert.ok(Math.abs(b.x - 550) < .1);
  tick(w, { block: true }, .5);
  assert.equal(w.players[0].carryId, "box", "held right-click must not repeatedly drop");
  assert.ok(b.y < 945, `original object lifted: ${b.y}`);
  assert.equal(w.cover.length, 3);
});

test("pickup respects facing, actual rotated reach, walls and objects in the way", () => {
  const w = lab(), p = w.players[0];
  assert.equal(pickupObjectCandidate(w, p, Math.PI), null);
  w.platforms.push(floor("wall", 532, 850, 6, 150));
  assert.equal(pickupObjectCandidate(w, p, 0), null);
  w.platforms.pop(); w.cover[0].x = 600;
  assert.equal(pickupObjectCandidate(w, p), null);
  Object.assign(w.cover[0], { x: 550, angle: Math.PI / 4 });
  assert.equal(pickupObjectCandidate(w, p)?.id, "box");
  w.cover.push(prop({ id: "front", x: 525, w: 15 }));
  assert.equal(pickupObjectCandidate(w, p)?.id, "front");
});

test("armed pickup sets down ammunition intact and never arms a nuclear weapon", () => {
  for (const weapon of ["shotgun", "nuke"]) {
    const w = lab(), p = w.players[0]; p.weapon = weapon; p.ammo = weapon === "nuke" ? 1 : 5;
    grab(w);
    assert.equal(p.weapon, null); assert.equal(p.ammo, 0);
    assert.equal(w.drops[0].type, weapon); assert.equal(w.drops[0].ammo, weapon === "nuke" ? 1 : 5);
    assert.ok(!w.drops[0].armed); assert.equal(w.projectiles.length, 0);
    tick(w, {}, .4); assert.equal(p.weapon, null, "no automatic weapon pickup while carrying");
  }
});

test("right-click still parries or alternate-fires when no object can be reached", () => {
  const w = lab(); w.cover = []; tick(w, { block: true });
  assert.ok(w.players[0].block);
  const other = lab(); other.cover = []; Object.assign(other.players[0], { weapon: "shotgun", ammo: 5 });
  tick(other, { block: true });
  assert.equal(other.players[0].ammo, 3); assert.ok(other.projectiles.length > 0);
});

test("a fresh right-click drops the object and cannot turn into a held parry", () => {
  const w = lab(); grab(w); tick(w, {}, .3); tick(w, { block: true });
  assert.equal(w.players[0].carryId, null);
  tick(w, { block: true }, .5); assert.equal(w.players[0].block, false);
  assert.equal(w.players[0].parryCooldown, 0);
});

test("left-click and F throw towards aim with mass-dependent speed, once per press", () => {
  for (const control of ["attack", "throw"]) {
    const speeds = [];
    for (const kind of ["crate", "stone"]) {
      const w = lab({ kind }); grab(w); tick(w, {}, .3);
      tick(w, { [control]: true, aim: -.4 });
      const b = w.cover[0], p = w.players[0];
      assert.equal(p.carryId, null); assert.ok(b.vx > 200 && b.vy < -150);
      speeds.push(b.vx); tick(w, { [control]: true, aim: -.4 }, .3);
      assert.equal(w.events.filter(e => e.type === "throw").length, 1);
      assert.equal(p.swing, 0, "holding fire after release cannot start punching");
    }
    assert.ok(speeds[0] > speeds[1] * 1.5);
  }
});

test("a held fire button cannot throw immediately after pickup", () => {
  const w = lab(); tick(w, { attack: true }); tick(w, { block: true, attack: true });
  assert.equal(w.players[0].carryId, "box");
  tick(w, { attack: true }, .2); assert.equal(w.players[0].carryId, "box");
  tick(w); tick(w, { attack: true }); assert.equal(w.players[0].carryId, null);
});

test("heavy carried objects slow running more than light objects, while recoil survives", () => {
  const speeds = [];
  for (const kind of ["crate", "stone"]) {
    const w = lab({ kind }); grab(w); tick(w, { right: true }, 1);
    assert.equal(w.players[0].carryId, "box"); speeds.push(w.players[0].vx);
    w.players[0].vx = 700; w.players[0].recoilTime = .5; tick(w, { right: true });
    assert.ok(w.players[0].vx > 650);
  }
  assert.ok(speeds[0] > speeds[1] + 45);
});

test("carried objects stay above floors and cannot be pulled through a thin wall", () => {
  const w = lab(); grab(w); tick(w, {}, .5);
  w.platforms.push(floor("wall", 665, 500, 6, 500));
  tick(w, { right: true }, 1.5);
  const box = bodyBounds(w.cover[0]);
  assert.ok(box.x + box.w <= 666, JSON.stringify(box));
  assert.ok(box.y + box.h <= 1001);
  assert.equal(w.players[0].hp, 100, "held body cannot repeatedly hit its own carrier");
});

test("a thrown object physically hits another fighter", () => {
  const w = lab(), target = w.players[1]; target.x = 780; target.rig = makeRig(target);
  grab(w); tick(w, {}, .4); tick(w, { attack: true, aim: 0 }); tick(w, {}, .4);
  assert.ok(target.hp < 100 || target.knockdown > 0, `hp=${target.hp}, x=${target.x}`);
  assert.ok(target.x > 780 || target.vx > 0);
});

test("persistent physical fragments can be carried and only one player can claim an object", () => {
  const w = lab(); w.chunks = [prop({ chunk: true, w: 30, h: 30, mass: 8, y: 970 })]; w.cover = [];
  const p = w.players[0], q = w.players[1]; q.x = 610; q.facing = -1; q.aimAngle = Math.PI;
  objectInput(w, p, cleanInput({ block: true, aim: 0 }));
  objectInput(w, q, cleanInput({ block: true, aim: Math.PI }));
  assert.equal(p.carryId, "box"); assert.equal(q.carryId, null);
  tick(w, {}, .3); assert.equal(carriedObject(w, p), w.chunks[0]);
});

test("knockdown, freeze, death and destroyed objects release the original body", () => {
  for (const effect of ["knockdown", "freeze", "death", "destroy"]) {
    const w = lab(); grab(w); const p = w.players[0];
    if (effect === "knockdown") knockDown(p, "bat");
    if (effect === "freeze") p.freeze = .5;
    if (effect === "death") w.kill(p);
    if (effect === "destroy") damageProp(w, w.cover[0], 200);
    cleanCarriedObjects(w); assert.equal(p.carryId, null);
    assert.ok(validSnapshot(w.snapshot()));
  }
});

test("held explosive barrels retain their fuse and explode while carried", () => {
  const w = lab({ kind: "barrel" }); grab(w); w.damageCover(w.cover[0], 5);
  const fuse = w.cover[0].fuse; tick(w, {}, .3);
  assert.ok(w.cover[0].fuse < fuse);
  tick(w, {}, 3); assert.equal(w.cover[0].hp, 0); assert.equal(w.players[0].carryId, null);
  assert.ok(w.chunks.length > 0);
});

test("black holes consume a held prop without duplicating it or leaving a carry reference", () => {
  const w = lab(); grab(w);
  const b = w.cover[0], f = blackholeField(w, { x: b.x + 26, y: b.y + 25, owner: 1 });
  w.fields = [f]; updateBlackhole(w, f, .41); cleanCarriedObjects(w);
  assert.equal(w.players[0].carryId, null);
  assert.ok(validSnapshot(w.snapshot()));
});

test("slot replacement, leaving and round reset release carry ownership", () => {
  const w = lab(); grab(w); w.replacePlayer(0, true);
  assert.equal(w.players[0].carryId, null);
  const other = lab(); grab(other); other.syncSlots(["player", "player", "closed", "closed"], [{ id: 1 }]);
  assert.ok(!other.players.some(p => p.carryId));
  const reset = lab(); grab(reset); reset.startRound();
  assert.ok(reset.players.every(p => p.carryId === null));
});

test("carry identity and moving body survive compressed snapshots, interpolation and hot join", async () => {
  const w = lab(), render = new RenderSnapshots(); grab(w); tick(w, {}, .3);
  const a = render.make(w.snapshot()); tick(w, { right: true }, .2);
  const b = render.make(w.snapshot());
  assert.ok(validSnapshot(a)); assert.ok(validSnapshot(b));
  const guest = await decodeState(await encodeState(b));
  assert.equal(guest.players[0].carryId, "box"); assert.equal(guest.cover.length, 1);
  assert.equal(guest.players[0].carryPoint, undefined);
  const halfway = interpolateStates(a, b, .5);
  assert.equal(halfway.players[0].carryId, "box");
  assert.ok(halfway.cover[0].x > a.cover[0].x && halfway.cover[0].x < b.cover[0].x);
  w.syncSlots(["player", "player", "player", "closed"], [{ id: 0 }, { id: 1 }, { id: 2 }]);
  assert.equal(w.players[0].carryId, "box"); assert.ok(validSnapshot(w.snapshot()));
});

test("wire validation rejects forged, duplicate, invalid and incompatible carry references", () => {
  const w = lab(); grab(w); const good = new RenderSnapshots().make(w.snapshot());
  for (const mutate of [s => s.players[0].carryId = "missing", s => s.players[0].carryId = {},
    s => s.players[0].carryId = "x".repeat(81), s => s.players[0].weapon = "blaster",
    s => s.players[0].alive = false, s => s.players[1].carryId = "box", s => s.cover[0].hp = 0]) {
    const s = structuredClone(good); mutate(s); assert.equal(validSnapshot(s), false);
  }
  assert.equal(cleanInput({ carryId: "box", block: true }).carryId, undefined);
});
