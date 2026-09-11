import test from "node:test";
import assert from "node:assert/strict";
import { MenuFight } from "../src/menu-fight.js";
import { WEAPONS } from "../src/arsenal.js";

function random(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

test("menu bots fight real rounds with melee, shots, pickups and changing weapons", () => {
  for (const seed of [7, 42, 91]) {
    const menu = new MenuFight(random(seed)), events = new Set(), weapons = new Set();
    for (let tick = 0; tick < 60 * 50; tick++) {
      const state = menu.advance(1 / 60);
      for (const e of state.events) events.add(e.type);
      for (const p of state.players) {
        assert.ok([p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite));
        if (p.weapon) { assert.ok(WEAPONS[p.weapon]); weapons.add(p.weapon); }
      }
      assert.ok(state.drops.length <= 8);
      assert.ok(state.ragdolls.length <= 4);
      assert.ok(state.projectiles.every(p => (p.age || 0) < 15));
    }
    for (const event of ["hit", "shoot", "swing", "pickup", "jump", "ko", "round"])
      assert.ok(events.has(event), `${seed}: actual ${event} events`);
    assert.ok(menu.world.round >= 3);
    assert.ok(weapons.size >= 8);
  }
});

test("menu uses fixed steps at different render rates and holds still for reduced motion", () => {
  const a = new MenuFight(random(4)), b = new MenuFight(random(4));
  for (let n = 0; n < 120; n++) a.advance(1 / 120);
  for (let n = 0; n < 30; n++) b.advance(1 / 30);
  assert.deepEqual(a.world.snapshot(), b.world.snapshot());
  const before = structuredClone(a.world.snapshot());
  for (let n = 0; n < 100; n++) a.advance(1 / 30, true);
  assert.deepEqual(a.world.snapshot(), before);
  for (const dt of [NaN, Infinity, -3]) a.advance(dt);
  assert.deepEqual(a.world.snapshot(), before);
  const t = a.world.time;
  a.advance(100);
  assert.ok(a.world.time - t <= 0.051, "background catch-up is bounded");
});

test("a new menu round restores its own terrain and loadouts without changing another World", () => {
  const a = new MenuFight(random(5)), b = new MenuFight(random(6));
  const other = structuredClone(b.world.snapshot());
  a.world.platforms[0].hp = 0;
  a.world.players[0].hp = 1;
  a.world.round++;
  a.world.startRound();
  assert.equal(a.world.phase, "fight");
  assert.notEqual(a.world.platforms[0].hp, 0);
  assert.ok(a.world.players.every(p => p.hp === 100 && p.rig.length === 11));
  assert.deepEqual(b.world.snapshot(), other);
});
