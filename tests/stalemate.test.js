import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS } from "../src/engine.js";
import { segmentBox } from "../src/collision.js";

const advance = (w, seconds) => {
  for (let n = 0; n < seconds / STEP && w.phase === "fight"; n++) w.step(STEP);
};
function quarry(offset = 0, grenades = true) {
  const w = new World({
    players: [1, 2],
    bots: [1, 2],
    arena: ARENAS.findIndex((a) => a.name === "VOLCANIC QUARRY"),
    shuffle: false,
    random: () => 0.45,
  });
  w.phase = "fight";
  w.drops = [];
  w.weaponTimer = w.hazardTimer = 999;
  Object.assign(w.players[0], {
    x: 2340 + offset,
    y: 1030,
    hp: 51,
    ground: true,
  });
  Object.assign(w.players[1], {
    x: 250 + offset,
    y: 1250,
    ground: true,
    weapon: grenades ? "grenade" : null,
    ammo: grenades ? 3 : 0,
  });
  return w;
}

for (const offset of [0, 12, 30])
  test(`quarry survivors leave their ledges and fight without pickups or sudden death (offset ${offset})`, () => {
    const w = quarry(offset);
    advance(w, 3);
    assert.ok(
      Math.hypot(w.players[0].x - 2340 - offset, w.players[0].y - 1030) > 80,
      "the unarmed fighter must leave the narrow right ledge",
    );
    let combat = false;
    for (let n = 0; n < 45 / STEP && w.phase === "fight"; n++) {
      w.step(STEP);
      combat ||= w.players[0].hp < 51 || w.players[1].hp < 100;
    }
    assert.ok(
      combat,
      "the survivors must damage each other before sudden death",
    );
  });

test("unarmed quarry survivors can cross the lower platforms and enter melee", () => {
  const w = quarry(0, false);
  advance(w, 35);
  assert.ok(w.players[0].hp < 51 || w.players[1].hp < 100);
});

test("a planned drop stays active until the fighter actually leaves the starting platform", () => {
  const w = quarry();
  w.players[1].bot = false;
  Object.assign(w.players[1], { x: 2230, y: 1250, weapon: null, ammo: 0 });
  let steppedOff = false,
    landed = false;
  for (let n = 0; n < 3 / STEP; n++) {
    w.step(STEP);
    const p = w.players[0];
    steppedOff ||= !p.ground;
    landed ||= steppedOff && p.ground && p.y > 1100;
  }
  assert.ok(
    landed,
    "complete the drop beside the barrel instead of cancelling it while still grounded",
  );
});

test("grenade AI can bank a throw past an obstruction and damage the opponent", () => {
  const w = new World({
    players: [0, 1],
    bots: [1],
    shuffle: false,
    random: () => 0.45,
  });
  w.phase = "fight";
  w.platforms = [
    { id: "floor", x: 0, y: 1200, w: 2560, h: 30 },
    { id: "wall", x: 750, y: 1060, w: 70, h: 140 },
  ];
  w.cover = [];
  w.drops = [];
  w.weaponTimer = w.hazardTimer = 999;
  Object.assign(w.players[0], { x: 1800, y: 1170, ground: true });
  Object.assign(w.players[1], {
    x: 300,
    y: 1170,
    ground: true,
    weapon: "grenade",
    ammo: 4,
  });
  assert.ok(
    segmentBox(300, 1160, 1800, 1160, w.platforms[1]),
    "direct fire is obstructed",
  );
  advance(w, 3.2);
  assert.ok(
    w.players[0].hp < 100,
    "evaluate the actual fuse and bounces, not direct line of sight",
  );
});

test("grenade AI does not spend ammunition on an opponent sealed above an indestructible ceiling", () => {
  const w = new World({
    players: [0, 1],
    bots: [1],
    shuffle: false,
    random: () => 0.45,
  });
  w.phase = "fight";
  w.platforms = [
    { id: "floor", x: 0, y: 1200, w: 2560, h: 30 },
    { id: "ceiling", x: -200, y: 900, w: 2960, h: 40 },
  ];
  w.cover = [];
  w.drops = [];
  w.weaponTimer = w.hazardTimer = 999;
  Object.assign(w.players[0], { x: 1300, y: 870, ground: true });
  Object.assign(w.players[1], {
    x: 300,
    y: 1170,
    ground: true,
    weapon: "grenade",
    ammo: 4,
  });
  advance(w, 2);
  assert.equal(w.players[1].ammo, 4);
});
