import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS, ARENAS, cleanInput } from "../src/engine.js";
import { firePhaser, carveBeam, beamTouches } from "../src/phaser.js";
import { updateFields } from "../src/specials.js";
import { blackholeField } from "../src/blackhole.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { makeRig } from "../src/puppet.js";
import { WeaponRotation } from "../src/arsenal.js";
import { combatFloor } from "./helpers.js";

const platform = (id, x, y, w, h) => ({ id, x, y, w, h, baseX: x, baseY: y, dx: 0, dy: 0 });
function fixture() {
  const w = new World({ players: [0, 1, 2, 3], shuffle: false, random: () => .4 });
  combatFloor(w); w.phase = "fight";
  w.arena = { ...w.arena, spikes: [] };
  w.players.forEach((p, i) => {
    Object.assign(p, { x: [350, 900, 1600, 180][i], y: 535, vx: 0, vy: 0,
      ground: true, support: "floor0", coyote: .09, aimAngle: 0 });
    p.rig = makeRig(p);
  });
  return w;
}
function shoot(w, angle = 0) {
  const p = w.players[0];
  Object.assign(p, { weapon: "phaser", ammo: 2, aimAngle: angle });
  w.attack(p); return w.fields.find(f => f.kind === "phaser");
}
const packed = w => new RenderSnapshots().make(w.snapshot());

test("PHASER hits every fighter in its forward corridor once, with survivable damage and a skeleton flash", () => {
  const w = fixture(), [p, q, r, behind] = w.players;
  r.hp = 38;
  const beam = shoot(w);
  assert.equal(q.hp, 62); assert.equal(q.alive, true);
  assert.ok(q.vx > 100 && q.vx < 200); assert.ok(q.stun < .05);
  assert.equal(q.xrayType, "phaser"); assert.equal(q.xray, .4);
  assert.equal(r.alive, false); assert.equal(w.ragdolls[0].effect, "phaser");
  assert.equal(w.ragdolls[0].ash, true);
  assert.equal(behind.hp, 100); assert.equal(p.hp, 100);
  assert.equal(p.ammo, 1); assert.equal(p.cooldown, 1.8);
  assert.equal(w.projectiles.length, 0); assert.equal(beam.radius, 72);
  for (let n = 0; n < 80; n++) updateFields(w, STEP);
  assert.equal(q.hp, 62); assert.equal(w.fields.length, 0);
});

test("a hit fighter can air-jump after the floor is deleted and land alive on a lower platform", () => {
  const w = fixture(), q = w.players[1];
  w.platforms.push(platform("landing", 750, 850, 500, 30));
  shoot(w); assert.equal(q.ground, false); assert.equal(q.support, null);
  let jumped = false, landed = false;
  for (let n = 0; n < 230; n++) {
    w.move(q, cleanInput({ jump: n >= 8 && n < 10 }), STEP);
    jumped ||= q.vy < -500;
    landed ||= q.ground && q.support === "landing";
  }
  assert.ok(jumped); assert.ok(landed); assert.equal(q.hp, 62); assert.ok(q.alive);
});

test("jumping above the beam avoids the hit, while prone and already airborne fighters remain hittable", () => {
  for (const pose of ["prone", "airborne", "above"]) {
    const w = fixture(), q = w.players[1];
    if (pose === "prone") Object.assign(q, { prone: true, y: 555 });
    else Object.assign(q, { ground: false, y: pose === "above" ? 390 : 510, vy: -200 });
    q.rig = makeRig(q); shoot(w);
    assert.equal(q.hp, pose === "above" ? 100 : 62, pose);
    assert.ok(q.alive); assert.equal(q.knockdown, 0);
  }
});

test("beam cuts structural terrain through the far edge, consuming props, traps and shots without explosions", () => {
  const w = fixture();
  w.platforms.push(platform("wall", 1100, 250, 40, 550), platform("far", 2400, 480, 100, 85),
    { ...platform("lift", 1800, 460, 200, 140), travel: 200, elevator: true });
  w.cover = [{ ...platform("prop", 700, 490, 45, 55), kind: "barrel", hp: 30, maxHp: 30 }];
  w.hazards = [{ x: 1400, y: 485, w: 60, h: 70, bodyX: 1430, bodyY: 525 }];
  w.projectiles = [{ x: 1000, y: 525, r: 12, nuclear: true, life: 2 }];
  w.drops = [{ x: 1300, y: 525, type: "nuke", life: 50 }];
  const beam = shoot(w);
  assert.ok(!w.platforms.some(p => p.id === "far"));
  assert.ok(w.platforms.some(p => p.sourceId === "wall" && p.y < 400));
  assert.ok(w.platforms.filter(p => p.sourceId === "lift").every(p => !p.travel && !p.elevator));
  for (let x = beam.x + beam.flare; x < 2500; x += 17)
    for (let y = beam.y - 70; y < beam.y + 70; y += 15)
      assert.ok(!w.solids().some(p => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h));
  assert.equal(w.cover.length, 0); assert.equal(w.hazards.length, 0);
  assert.equal(w.projectiles.length, 0); assert.equal(w.drops.length, 0);
  assert.equal(w.craters.length, 0); assert.ok(w.terrainVersion > 0);
  assert.ok(validSnapshot(packed(w)));
});

test("directional carving works at diagonal, vertical and reversed angles without leaving beam collision or cutting behind the muzzle", () => {
  for (const angle of [0, .16, .8, Math.PI / 2, 2.5, Math.PI, -Math.PI / 2, -.9]) {
    const beam = { x: 500, y: 500, ex: 500 + Math.cos(angle) * 1000, ey: 500 + Math.sin(angle) * 1000, radius: 72 };
    const s = platform("slab", 200, 200, 600, 600);
    let id = 0; const pieces = carveBeam(s, beam, () => `piece${++id}`);
    assert.ok(pieces.length < 30);
    for (let d = 10; d <= 280; d += 10) {
      const x = 500 + Math.cos(angle) * d, y = 500 + Math.sin(angle) * d;
      assert.ok(!pieces.some(p => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h), String(angle));
    }
    const behind = { x: 500 - Math.cos(angle) * 180 - 5, y: 500 - Math.sin(angle) * 180 - 5, w: 10, h: 10 };
    assert.equal(beamTouches(behind, beam), false);
    assert.equal(carveBeam(behind, beam, () => "bad")[0], behind);
  }
});

test("spikes keep their original height on either side of a vertical cut and restore on round reset", () => {
  const w = fixture(); w.arena = { ...w.arena, spikes: [{ x: 100, y: 1100, w: 2000 }] };
  shoot(w, Math.PI / 2);
  assert.equal(w.spikes().length, 2);
  assert.ok(w.spikes().every(s => s.y === 1100));
  assert.ok(!w.spikes().some(s => s.x < 350 && s.x + s.w > 350));
  assert.ok(validSnapshot(packed(w)));
  w.startRound(); assert.equal(w.spikeTerrain, null); assert.equal(w.fields.length, 0);
  assert.equal(w.terrainSerial, 0);
});

test("hot-join and interpolated snapshots retain beam geometry, identities, survivors and permanent destruction", () => {
  const w = fixture(), wire = new RenderSnapshots(), a = wire.make(w.snapshot());
  shoot(w); const b = wire.make(w.snapshot());
  const guest = JSON.parse(JSON.stringify(b)), mid = interpolateStates(a, b, .5);
  assert.ok(validSnapshot(guest)); assert.deepEqual(mid.platforms, b.platforms);
  assert.equal(guest.players[1].hp, 62); assert.equal(guest.fields[0].kind, "phaser");
  for (const mutate of [s => s.fields[0].radius = 800, s => s.fields[0].ex = Infinity,
    s => s.fields[0].ex += 100, s => s.fields[0].owner = 4, s => s.fields[0].life = 3,
    s => s.spikes = [{ x: 2, y: 5, w: -1 }]]) {
    const bad = structuredClone(guest); mutate(bad); assert.equal(validSnapshot(bad), false);
  }
  for (let n = 0; n < 80; n++) updateFields(w, STEP);
  const late = wire.make(w.snapshot());
  assert.ok(validSnapshot(late)); assert.equal(late.fields.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(late.platforms)), guest.platforms);
});

test("PHASER occurs in the featured rotation and repeated shots stay within terrain and wire limits on every arena", () => {
  const rotation = new WeaponRotation(() => .4);
  assert.ok(Array.from({ length: 16 }, () => rotation.next()).includes("phaser"));
  for (let arena = 0; arena < ARENAS.length; arena++) {
    const w = new World({ players: [0, 1, 2, 3], arena, shuffle: false, random: () => .4 });
    w.phase = "fight";
    for (let n = 0; n < 18; n++) {
      const p = w.players[0], angle = n * 2.39996;
      Object.assign(p, { x: 250 + n * 113, y: 250 + (n * 197) % 950 });
      firePhaser(w, p, Math.cos(angle), Math.sin(angle));
      assert.ok(w.platforms.length <= 1536, `${arena}: ${w.platforms.length}`);
      assert.ok(validSnapshot(packed(w)), `${arena}: shot ${n}`);
    }
  }
});

test("destroyed black-hole wreckage cannot recreate its collision on a later field update", () => {
  const w = fixture();
  w.fields = [blackholeField(w, { x: 1100, y: 525, owner: 0 })];
  for (let n = 0; n < 90; n++) updateFields(w, STEP);
  assert.ok(w.wreckage.length > 0);
  const old = new Set(w.wreckage.map(p => p.id)); shoot(w);
  const removed = [...old].filter(id => !w.wreckage.some(p => p.id === id));
  assert.ok(removed.length > 0);
  for (let n = 0; n < 10; n++) updateFields(w, STEP);
  assert.ok(!w.platforms.some(p => removed.includes(p.wreckId)));
  assert.ok(validSnapshot(packed(w)));
});
