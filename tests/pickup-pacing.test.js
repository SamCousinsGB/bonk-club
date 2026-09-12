import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, WEAPONS } from "../src/engine.js";
import { chooseWeapon } from "../src/arsenal.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { validSnapshot } from "../src/network.js";
import { combatFloor } from "./helpers.js";

const advance = (w, seconds) => {
  for (let n = 0; n < Math.round(seconds / STEP); n++) w.step(STEP);
};
function scheduled(type, first) {
  const w = new World({ shuffle: false, random: () => .45 });
  combatFloor(w);
  w.arena = { ...w.arena, spikes: [] };
  w.players.forEach((p, i) => Object.assign(p, { x: 200 + i * 2100, y: 535 }));
  w.phase = "fight";
  const tier = WEAPONS[type].rarity;
  const pool = Object.keys(WEAPONS).filter(k => k !== "nuke" && WEAPONS[k].rarity === tier);
  const rolls = [{ common: .2, uncommon: .5, rare: .8, exotic: .95 }[tier],
    (pool.indexOf(type) + .5) / pool.length];
  w.random = () => rolls.length ? rolls.shift() : .5;
  w.scheduleWeapon(first);
  assert.equal(w.nextWeaponType, type);
  return w;
}

for (const type of ["blaster", "bat", "blackhole", "grenade", "cluster", "cryo"]) {
  for (const first of [true, false]) test(`${type} ${first ? "first" : "repeat"} drop waits for its own delay`, () => {
    const w = scheduled(type, first);
    const grenade = WEAPONS[type].kind === "grenade";
    const delay = grenade ? (first ? 2 : 4) : (first ? 6 : 7);
    advance(w, delay - .05);
    assert.equal(w.drops.length, 0, "no early reinforcement");
    advance(w, .1);
    assert.equal(w.drops.length, 1);
    assert.equal(w.drops[0].type, type);
    assert.equal(w.drops[0].ammo, WEAPONS[type].ammo);
    const joined = expandSnapshot(compactSnapshot(w.snapshot()), validSnapshot);
    assert.ok(validSnapshot(joined));
    assert.equal(joined.drops[0].type, type);
    assert.equal(joined.drops[0].ammo, WEAPONS[type].ammo);
  });
}

test("nukes appear once on every third standard round and never in random refills", () => {
  for (const arena of [0, ARENAS.length - 2, ARENAS.length - 1]) {
    const w = new World({ arena, shuffle: false, random: () => .99 });
    for (let round = 1; round <= 12; round++) {
      w.round = round; w.startRound();
      assert.equal(w.drops.filter(d => d.type === "nuke").length, round % 3 === 0 ? 1 : 0);
      assert.notEqual(w.nextWeaponType, "nuke");
      for (let i = 0; i < 15; i++) { w.drops = []; w.spawnWeapon(); }
      assert.ok(w.drops.every(d => d.type !== "nuke"));
    }
  }
  // Exclusion fallbacks must not put a nuke back into the random pool.
  for (const excluded of [new Set(), new Set(Object.keys(WEAPONS)),
    new Set(Object.keys(WEAPONS).filter(k => k !== "nuke"))]) {
    for (let roll = 0; roll < 100; roll++)
      assert.notEqual(chooseWeapon(() => roll / 100, excluded), "nuke");
  }
});

test("countdown does not consume the drop delay and a new round resets a pending refill", () => {
  const w = scheduled("blaster", true);
  w.phase = "countdown"; w.phaseTime = 2.4;
  advance(w, 2);
  assert.equal(w.weaponTimer, 6);
  w.nextWeaponType = "nuke"; w.weaponTimer = .01;
  w.round = 2; w.startRound();
  assert.notEqual(w.nextWeaponType, "nuke");
  assert.ok(w.weaponTimer >= 2);
  assert.ok(w.players.every(p => !p.weapon));
});
