import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS } from "../src/engine.js";
import { HAZARD_TYPES, spawnHazard, updateHazards } from "../src/hazards.js";
import { THEMED_ARENAS, COVER_KINDS } from "../src/maps.js";
import { CITY_FLOORS } from "../src/skyscrapers.js";
import { validSnapshot } from "../src/network.js";
import { combatFloor } from "./helpers.js";
function lab(type) {
  const w = new World({ random: () => 0.5, shuffle: false });
  combatFloor(w);
  w.phase = "fight";
  w.arena = { ...w.arena, hazards: [type] };
  const h = spawnHazard(w);
  Object.assign(w.players[0], {
    x: h.x,
    y: h.y - 30,
    vx: 0,
    vy: 0,
    ground: true,
  });
  Object.assign(w.players[1], {
    x: h.x + 500,
    y: h.y - 30,
    vx: 0,
    vy: 0,
    ground: true,
  });
  return { w, h, p: w.players[0] };
}
const advance = (w, time) => {
  for (let i = 0; i < Math.ceil(time / STEP); i++) updateHazards(w, STEP);
};
for (const type of HAZARD_TYPES)
  test(`${type} warns without damage, activates, then expires`, () => {
    const { w, h, p } = lab(type);
    advance(w, 1.95);
    assert.equal(p.hp, 100);
    assert.equal(p.vx, 0);
    assert.equal(p.vy, 0);
    advance(w, 1.1);
    if (type === "gust") {
      assert.equal(p.hp, 100);
      assert.ok(Math.abs(p.vx) > 100);
    } else assert.ok(p.hp < 100, type);
    if (type === "steam" || type === "lava") assert.ok(p.vy < -500);
    assert.equal(w.players[1].hp, 100);
    assert.ok(validSnapshot(JSON.parse(JSON.stringify(w.snapshot()))));
    advance(w, 7);
    assert.equal(w.hazards.length, 0);
  });
test("moving outside the marked zone avoids a hazard", () => {
  const { w, h, p } = lab("lightning");
  p.x = h.x + h.w / 2 + 35;
  advance(w, 3);
  assert.equal(p.hp, 100);
});
test("lying down reduces wind displacement", () => {
  const a = lab("gust"),
    b = lab("gust");
  b.p.prone = true;
  advance(a.w, 3);
  advance(b.w, 3);
  assert.ok(Math.abs(b.p.vx) < Math.abs(a.p.vx) * 0.25);
});
test("floors above and below an active gas leak protect other storeys", () => {
  const { w, h, p } = lab("gas");
  w.players[1].x = h.x;
  w.players[1].y = h.y - h.h - 40;
  advance(w, 3);
  assert.ok(p.hp < 100);
  assert.equal(w.players[1].hp, 100);
  w.players[1].y = h.y + 70;
  advance(w, 0.3);
  assert.equal(w.players[1].hp, 100);
});
test("a falling object stops at cover and breaks it before reaching a player below", () => {
  const { w, h, p } = lab("rockfall");
  const cover = {
    id: "cover0",
    x: h.x - 55,
    y: h.y - 130,
    w: 110,
    h: 45,
    hp: 75,
    maxHp: 75,
    kind: "crate",
  };
  w.cover = [cover];
  advance(w, 3);
  assert.equal(cover.hp, 0);
  assert.ok(w.debris.length > 0);
  assert.equal(p.hp, 100);
  assert.ok(h.done);
});
test("hazards stop during countdown, results and match end, and reset on a new round", () => {
  const { w, h, p } = lab("gas");
  for (const phase of ["countdown", "result", "match"]) {
    w.phase = phase;
    advance(w, 9);
    assert.equal(h.warning, 2);
    assert.equal(p.hp, 100);
  }
  w.startRound();
  assert.equal(w.hazards.length, 0);
  assert.ok(w.hazardTimer >= 8);
});
test("random hazards repeat at bounded intervals and never exceed three active zones", () => {
  const { w } = lab("steam");
  w.hazards = [];
  w.hazardTimer = 0.01;
  advance(w, 0.1);
  assert.equal(w.hazards.length, 1);
  assert.ok(w.hazardTimer >= 7 && w.hazardTimer <= 14);
  for (let i = 0; i < 10; i++) spawnHazard(w);
  assert.equal(w.hazards.length, 3);
  assert.ok(validSnapshot(w.snapshot()));
});
test("hazard snapshots reject unknown types, nonfinite positions, injected IDs and oversized zones", () => {
  const { w } = lab("gas");
  const original = w.snapshot();
  assert.ok(validSnapshot(original));
  for (const patch of [
    { type: "<img>" },
    { x: Infinity },
    { w: 10000 },
    { warning: -1 },
    { hitIds: [9] },
    { done: "yes" },
  ]) {
    const s = structuredClone(original);
    Object.assign(s.hazards[0], patch);
    assert.equal(validSnapshot(s), false);
  }
});
test("twelve themes have distinct terrain layouts, themed hazards and physical cover", () => {
  assert.equal(THEMED_ARENAS.length, 12);
  assert.equal(
    new Set(THEMED_ARENAS.map((a) => JSON.stringify(a.platforms))).size,
    12,
  );
  assert.equal(new Set(THEMED_ARENAS.map((a) => a.theme)).size, 12);
  for (const a of THEMED_ARENAS) {
    assert.ok(
      a.hazards.length >= 2 && a.hazards.every((h) => HAZARD_TYPES.includes(h)),
    );
    assert.ok(a.cover.every((c) => COVER_KINDS.includes(c.kind)));
    assert.ok(
      a.cover.every((c) =>
        a.platforms.some(
          (p) =>
            c.x >= p.x &&
            c.x + c.w <= p.x + p.w &&
            Math.abs(c.y + c.h - p.y) < 1,
        ),
      ),
    );
    assert.ok(a.platforms.every((p) => p.x >= 0 && p.x + p.w <= 2560));
  }
  const arctic = THEMED_ARENAS.find((a) => a.theme === "arctic");
  assert.ok(arctic.platforms.every((p) => p.ice));
  for (let i = 1; i < CITY_FLOORS.length; i++)
    assert.ok(CITY_FLOORS[i - 1] - CITY_FLOORS[i] >= 320);
});
test("railgun rounds break every new cover type", () => {
  for (const kind of COVER_KINDS.filter((k) => k !== "table")) {
    const { w, p } = lab("gas");
    w.hazards = [];
    const c = {
      id: "cover0",
      kind,
      x: p.x + 40,
      y: 515,
      w: 70,
      h: 50,
      hp: 75,
      maxHp: 75,
    };
    w.cover = [c];
    p.weapon = "railgun";
    p.ammo = 3;
    p.aimAngle = 0;
    w.attack(p);
    for (let i = 0; i < 8; i++) w.updateProjectiles(STEP);
    assert.equal(c.hp, 0, kind);
  }
});
for (let arena = 12; arena < ARENAS.length; arena++)
  test(`hazard placements stay on solid ground inside a room: ${ARENAS[arena].name}`, () => {
    let seed = 11;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const w = new World({ arena, random });
    w.phase = "fight";
    for (let i = 0; i < 60; i++) {
      w.hazards = [];
      const h = spawnHazard(w);
      if (!h) continue;
      assert.ok(
        w.platforms.some(
          (p) =>
            p.y === h.y && p.x <= h.x - h.w / 2 && p.x + p.w >= h.x + h.w / 2,
        ),
      );
      assert.ok(validSnapshot(w.snapshot()));
      for (const p of w.platforms)
        if (p.y < h.y - 40 && p.x < h.x + h.w / 2 && p.x + p.w > h.x - h.w / 2)
          assert.ok(h.y - h.h >= p.y + p.h);
    }
  });

test("the full map rotation visits every map once before repeating", () => {
  const w = new World({ arena: 0, shuffle: true, random: () => 0.37 });
  const seen = [w.arenaIndex];
  for (let i = 1; i < ARENAS.length * 2; i++) {
    w.phase = "result";
    w.phaseTime = 0;
    w.step(STEP);
    seen.push(w.arenaIndex);
  }
  assert.equal(new Set(seen.slice(0, ARENAS.length)).size, ARENAS.length);
  assert.equal(new Set(seen.slice(ARENAS.length)).size, ARENAS.length);
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1]);
});
test("throwing a weapon and exploding near furniture both damage every cover type", () => {
  for (const kind of COVER_KINDS)
    for (const action of ["throw", "blast"]) {
      const { w, p } = lab("gas");
      w.hazards = [];
      const c = {
        id: "cover0",
        kind,
        x: p.x + 45,
        y: 515,
        w: 70,
        h: 50,
        hp: 75,
        maxHp: 75,
      };
      w.cover = [c];
      if (action === "throw") {
        p.weapon = "blaster";
        p.ammo = 3;
        p.aimAngle = 0;
        w.throwWeapon(p);
        for (let i = 0; i < 30; i++) w.updateDrops(STEP);
      } else
        w.explode({ x: c.x - 10, y: 535, damage: 58, force: 900, radius: 150 });
      assert.ok(c.hp < 75, kind + " " + action);
    }
});
