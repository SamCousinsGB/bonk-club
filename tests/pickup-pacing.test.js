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
function scheduled(type) {
  const w = new World({ shuffle: false, random: () => .45 });
  combatFloor(w);
  w.arena = { ...w.arena, spikes: [] };
  w.players.forEach((p, i) => Object.assign(p, { x: 200 + i * 2100, y: 535 }));
  w.phase = "fight";
  w.weaponTimer = WEAPONS[type].kind === "grenade" ? Infinity : 6;
  w.grenadeTimer = WEAPONS[type].kind === "grenade" ? 2 : Infinity;
  return w;
}
function rollFor(w, type) {
  const tier = WEAPONS[type].rarity;
  const pool = Object.keys(WEAPONS).filter(k => k !== "nuke" && WEAPONS[k].rarity === tier);
  const rolls = [{ common: .2, uncommon: .5, rare: .8, exotic: .95 }[tier],
    (pool.indexOf(type) + .5) / pool.length];
  w.random = () => rolls.length ? rolls.shift() : .5;

}

for (const type of ["blaster", "bat", "blackhole", "grenade", "cluster", "cryo"]) {
  test(`${type} first and repeat drops use independent weapon and grenade clocks`, () => {
    const w = scheduled(type);
    const grenade = WEAPONS[type].kind === "grenade";
    for (const first of [true, false]) {
      rollFor(w, type);
      const timer = grenade ? "grenadeTimer" : "weaponTimer";
      const delay = w[timer];
      assert.ok(Math.abs(delay - (grenade ? (first ? 2 : 4) : (first ? 6 : 7))) < .03);
      advance(w, delay - .05);
      assert.equal(w.drops.length, 0, "no early reinforcement");
      advance(w, .05 + STEP);
      assert.equal(w.drops.length, 1);
      assert.equal(w.drops[0].type, type);
      assert.equal(w.drops[0].ammo, WEAPONS[type].ammo);
      const joined = expandSnapshot(compactSnapshot(w.snapshot()), validSnapshot);
      assert.ok(validSnapshot(joined));
      assert.equal(joined.drops[0].type, type);
      assert.equal(joined.drops[0].ammo, WEAPONS[type].ammo);
      w.drops = [];
    }
  });
}

test("grenades keep arriving when standard weapon refills are disabled", () => {
  const w = scheduled("grenade");
  rollFor(w, "grenade");
  advance(w, 2 + STEP);
  assert.equal(w.drops[0].type, "grenade");
  assert.equal(w.weaponTimer, Infinity);
});

test("a grenade roll cannot add a gun and a weapon roll cannot duplicate grenade drops", () => {
  for (const type of ["grenade", "blaster"]) {
    const w = scheduled(type);
    w.weaponTimer = type === "grenade" ? .01 : Infinity;
    w.grenadeTimer = type === "blaster" ? .01 : Infinity;
    rollFor(w, type);
    advance(w, .05);
    assert.equal(w.drops.length, 0);
  }
});

test("nukes appear once on every third standard round and never in random refills", () => {
  for (const arena of [0, ARENAS.length - 2, ARENAS.length - 1]) {
    const w = new World({ arena, shuffle: false, random: () => .99 });
    for (let round = 1; round <= 12; round++) {
      w.round = round; w.startRound();
      assert.equal(w.drops.filter(d => d.type === "nuke").length, round % 3 === 0 ? 1 : 0);
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
  const w = scheduled("blaster");
  w.phase = "countdown"; w.phaseTime = 2.4;
  advance(w, 2);
  assert.equal(w.weaponTimer, 6);
  w.weaponTimer = w.grenadeTimer = .01;
  w.round = 2; w.startRound();
  assert.equal(w.weaponTimer, 6);
  assert.equal(w.grenadeTimer, 2);
  assert.ok(w.players.every(p => !p.weapon));
});
