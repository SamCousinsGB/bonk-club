import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP } from "../src/engine.js";
import { HAZARD_TYPES, createHazards, dangerous, updateHazards } from "../src/hazards.js";
import { HazardBreaks, HAZARD_BREAK_LIFE, hazardArtBounds, hazardShardMesh } from "../src/hazard-break-art.js";
import { drawHazards } from "../src/trap-art.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { combatFloor } from "./helpers.js";
import { carveExplosion } from "../src/terrain.js";

function lab(type = "crusher") {
  const w = new World({random: () => .5, shuffle: false}); combatFloor(w); w.phase = "fight";
  w.arena = {...w.arena, traps: [{type, x: 650, y: 565, w: 220, h: 230, dir: 1}]};
  w.hazards = createHazards(w);
  return {w, h: w.hazards[0]};
}
const tick = (w, tracker, dt = STEP) => { w.time += dt; updateHazards(w, dt); return tracker.update(w.snapshot()); };

test("every fixture breaks once after losing its mounting, stops harming players and restores next round", () => {
  for (const type of HAZARD_TYPES) {
    const {w, h} = lab(type), tracker = new HazardBreaks(); h.active = true; h.warning = .5;
    tracker.update(w.snapshot()); w.platforms[0].hp = 0;
    assert.equal(tick(w, tracker).length, 1, type);
    assert.equal(dangerous(h), false); assert.equal(h.active, false); assert.equal(h.warning, 0);
    assert.equal(validSnapshot(w.snapshot()), true, type);
    const hp = w.players.map(p => p.hp);
    for (let i = 0; i < 150; i++) tick(w, tracker);
    assert.deepEqual(w.players.map(p => p.hp), hp); assert.equal(tracker.bursts.length, 0);
    assert.equal(tracker.update(w.snapshot()).length, 0, "a repeated snapshot cannot replay the break");
    w.round++; w.startRound(); tracker.update(w.snapshot());
    assert.ok(w.hazards.every(h => !h.done)); assert.equal(tracker.bursts.length, 0);
  }
});

test("destroyed fixture casing issues no drawing commands, even with stale active/warning flags", () => {
  const c = new Proxy({}, {get: (_, key) => () => assert.fail(`destroyed casing called ${String(key)}`)});
  for (const type of HAZARD_TYPES) drawHazards(c, [{...lab(type).h, done: true, active: true, warning: 1}], 4, "factory");
});

test("a direct blast breaks the moving mechanism with its floor intact and cannot trigger it twice", () => {
  const {w, h} = lab("pendulum"), tracker = new HazardBreaks(); h.bodyY = 400; h.active = true;
  tracker.update(w.snapshot());
  carveExplosion(w, {x: h.bodyX, y: h.bodyY, radius: 45});
  assert.equal(h.done, true); assert.equal(dangerous(h), false);
  assert.ok(w.platforms.some(p => p.hp !== 0 && p.x <= h.x && p.x+p.w >= h.x && p.y === h.y));
  assert.equal(tick(w, tracker).length, 1); assert.equal(validSnapshot(w.snapshot()), true);
  const version = w.terrainVersion;
  carveExplosion(w, {x: h.bodyX, y: h.bodyY, radius: 45});
  assert.equal(w.terrainVersion, version); assert.equal(tick(w, tracker).length, 1);
});

test("host and interpolated guest observe a single break at the moving head; hot join shows empty space", () => {
  const {w, h} = lab("pendulum"), snapshots = new RenderSnapshots(); h.bodyX = 810; h.bodyY = 450;
  const host = new HazardBreaks(), guest = new HazardBreaks();
  const before = snapshots.make(w.snapshot()); host.update(before); guest.update(before);
  w.platforms[0].hp = 0; tick(w, host);
  const after = snapshots.make(w.snapshot()), rendered = interpolateStates(before, after, .5);
  assert.equal(validSnapshot(after), true);
  assert.equal(guest.update(rendered).length, 1);
  assert.deepEqual(hazardShardMesh(guest.bursts[0].h), hazardShardMesh(host.bursts[0].h));
  assert.equal(guest.bursts[0].h.bodyX, 810); assert.equal(guest.bursts[0].h.bodyY, 450);
  assert.equal(guest.update(rendered).length, 1);
  assert.equal(new HazardBreaks().update(after).length, 0);
});

test("burst state clears on round/arena/menu changes, rewinds and background gaps", () => {
  for (const change of [s => ({...s, round: s.round+1}), s => ({...s, arenaIndex: s.arenaIndex+1}),
    s => ({...s, time: s.time-1}), s => ({...s, time: s.time+2}), () => null]) {
    const {w} = lab(), tracker = new HazardBreaks(); tracker.update(w.snapshot());
    w.platforms[0].hp = 0; tick(w, tracker); assert.equal(tracker.bursts.length, 1);
    assert.equal(tracker.update(change(w.snapshot())).length, 0);
  }
});

test("captured or vaporised fixtures keep their existing weapon effects without duplicate shards", () => {
  const {w} = lab(), tracker = new HazardBreaks(); tracker.update(w.snapshot());
  w.hazards = []; w.time += STEP;
  assert.equal(tracker.update(w.snapshot()).length, 0);
});

test("all eight simultaneous breaks clear fully within the bounded lifetime", () => {
  const {w, h} = lab(), tracker = new HazardBreaks();
  w.hazards = Array.from({length: 8}, (_, i) => ({...h, id: i+1})); tracker.update(w.snapshot());
  w.platforms[0].hp = 0; tick(w, tracker); assert.equal(tracker.bursts.length, 8);
  for (let i = 0; i < 4; i++) tick(w, tracker, HAZARD_BREAK_LIFE/4+.001);
  assert.equal(tracker.bursts.length, 0);
});

test("jagged meshes cover the original artwork without gaps and stay within 48 shards per fixture", () => {
  for (const type of HAZARD_TYPES) for (let id = 1; id <= 8; id++) {
    const h = {...lab(type).h, id, bodyX: 810, bodyY: 400}, {bounds, shards} = hazardShardMesh(h);
    assert.ok(shards.length <= 48);
    let area = 0;
    for (const poly of shards) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i+1)%4], c = poly[(i+2)%4];
        assert.ok((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x) > 0, `${type} convex clip`);
        assert.ok(a.x >= 0 && a.x <= bounds.w && a.y >= 0 && a.y <= bounds.h);
        area += (a.x*b.y-b.x*a.y)/2;
      }
    }
    assert.ok(Math.abs(area-bounds.w*bounds.h) < .0001, type);
    if (["pendulum", "saw"].includes(type)) {
      const b = hazardArtBounds(h);
      assert.ok(h.bodyX-36 >= b.x && h.bodyX+36 <= b.x+b.w);
      assert.ok(h.bodyY-36 >= b.y && h.bodyY+36 <= b.y+b.h);
    }
  }
});
