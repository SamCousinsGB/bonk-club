import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS } from "../src/engine.js";
import { validSnapshot } from "../src/network.js";
import { combatFloor } from "./helpers.js";

function fight() {
  const w = new World({
    players: [0, 1],
    bots: [1],
    shuffle: false,
    random: () => 0.45,
  });
  combatFloor(w);
  w.phase = "fight";
  Object.assign(w.players[0], { x: 600, y: 535, ground: true });
  Object.assign(w.players[1], { x: 1000, y: 535, ground: true });
  return w;
}
function advance(w, seconds, input = {}) {
  for (let n = 0; n < seconds / STEP; n++) w.step(STEP, input);
}
test("an AI aims and fires real projectiles that damage its opponent", () => {
  const w = fight();
  Object.assign(w.players[1], { weapon: "blaster", ammo: 14 });
  advance(w, 1.5);
  assert.ok(w.players[0].hp < 100);
  assert.ok(w.players[1].ammo < 14);
  assert.ok(w.events.some((e) => e.type === "shoot"));
});
test("an unarmed AI approaches and automatically picks up a weapon", () => {
  const w = fight();
  w.players[0].x = 1900;
  w.drops = [
    { x: 875, y: 555, vx: 0, vy: 0, type: "blaster", ammo: 14, life: 60 },
  ];
  advance(w, 1.2);
  assert.equal(w.players[1].weapon, "blaster");
});
test("an AI climbs separated platforms and reaches an opponent using the normal jump physics", () => {
  const w = fight();
  w.platforms = [
    { x: 100, y: 700, w: 500, h: 22 },
    { x: 650, y: 580, w: 200, h: 22 },
    { x: 920, y: 430, w: 250, h: 22 },
  ].map((p, n) => ({
    ...p,
    id: "floor" + n,
    baseX: p.x,
    baseY: p.y,
    dx: 0,
    dy: 0,
  }));
  Object.assign(w.players[0], { x: 1080, y: 400, support: "floor2" });
  Object.assign(w.players[1], { x: 500, y: 670, support: "floor0" });
  advance(w, 3.5);
  assert.ok(w.players[1].x > 900);
  assert.ok(
    w.players[0].hp < 100,
    "AI must reach and punch the opponent above",
  );
});
test("AI moves out of a warning zone before a hazard activates", () => {
  const w = fight();
  w.hazards = [
    {
      id: 1,
      type: "geyser",
      x: 1030,
      y: 565,
      w: 140,
      h: 200,
      warning: 1.2,
      active: false,
      cooldown: 0,
      bodyX: 1030,
      age: 0,
      duration: 0.55,
      bodyY: 0,
      vy: 0,
      dir: 1,
      done: false,
      hitIds: [],
    },
  ];
  advance(w, 1);
  assert.ok(w.players[1].x < 920);
  assert.equal(w.players[1].hp, 100);
});
test("human controls are never replaced by AI after a hot join", () => {
  const w = fight();
  w.replacePlayer(1, false);
  advance(w, 1, { 1: { right: true } });
  assert.ok(w.players[1].x > 1170);
  assert.equal(w.players[1].weapon, null);
  assert.equal(w.players[1].bot, false);
});
test("four AI fighters fight and complete rounds across all 24 arenas", () => {
  for (let arena = 0; arena < ARENAS.length; arena++) {
    let seed = 4781 + arena;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const w = new World({
      players: [0, 1, 2, 3],
      bots: [0, 1, 2, 3],
      arena,
      shuffle: false,
      random,
    });
    let combat = false;
    for (let n = 0; n < 120 * 150 && w.round === 1; n++) {
      w.step(STEP);
      if (n % 120 === 0) {
        assert.ok(validSnapshot(w.snapshot()), ARENAS[arena].name);
        combat ||= w.events.some(
          (e) => e.type === "shoot" || e.type === "swing",
        );
      }
    }
    assert.ok(combat, ARENAS[arena].name + " must have AI combat");
    assert.ok(w.round > 1, ARENAS[arena].name + " must keep playing");
  }
});
