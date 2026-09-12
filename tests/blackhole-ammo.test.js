import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP } from "../src/engine.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { combatFloor } from "./helpers.js";

const world = () => new World({ players: [0, 1], arena: 0, shuffle: false, weaponPool: ["blackhole"], random: () => .4 });
async function guestState(w) {
  const state = new RenderSnapshots().make(w.snapshot());
  return expandSnapshot(await decodeState(await encodeState(compactSnapshot(state))), validSnapshot);
}

test("a picked-up generator fires one persistent seed, empties, and still activates on contact", async () => {
  const w = world(), p = w.players[0], pickup = w.drops.find(d => d.type === "blackhole");
  assert.ok(pickup);
  assert.equal(pickup.ammo, 1);
  combatFloor(w); w.phase = "fight";
  Object.assign(p, { x: 500, y: 535, aimAngle: 0, cooldown: 0 });
  w.drops = [{ ...pickup, x: p.x, y: p.y }];
  w.pickup(p);
  assert.equal(p.weapon, "blackhole"); assert.equal(p.ammo, 1);
  assert.equal((await guestState(w)).players[0].ammo, 1);
  w.attack(p);
  assert.equal(w.projectiles.length, 1);
  assert.equal(w.projectiles[0].kind, "singularity");
  assert.equal(p.weapon, null); assert.equal(p.ammo, 0);
  const guest = await guestState(w);
  assert.equal(guest.players[0].weapon, null); assert.equal(guest.players[0].ammo, 0);
  assert.equal(guest.projectiles.length, 1);
  p.cooldown = 0; w.attack(p);
  assert.equal(w.projectiles.length, 1, "a second press cannot fire another seed");
  Object.assign(w.projectiles[0], { y: 552, vy: 1000 });
  w.updateProjectiles(STEP);
  assert.equal(w.fields.filter(f => f.kind === "blackhole").length, 1,
    "the fired shot survives the generator being consumed");
});

test("opening, refill, thrown and next-round generators all retain exactly one shot", async () => {
  const w = world(), p = w.players[0];
  assert.ok(w.drops.length > 0);
  assert.ok(w.drops.every(d => d.type === "blackhole" && d.ammo === 1));
  combatFloor(w);
  Object.assign(p, { x: 400, y: 535 }); Object.assign(w.players[1], { x: 2100, y: 535 });
  w.spawnWeapon("blackhole");
  assert.equal(w.drops.length, 1); assert.equal(w.drops[0].ammo, 1);
  Object.assign(w.drops[0], { x: p.x, y: p.y }); w.pickup(p);
  w.throwWeapon(p);
  assert.equal(p.weapon, null);
  assert.equal(w.drops.length, 1); assert.equal(w.drops[0].ammo, 1);
  assert.equal((await guestState(w)).drops[0].ammo, 1);
  w.startRound();
  assert.ok(w.drops.length > 0 && w.drops.every(d => d.ammo === 1));
});
