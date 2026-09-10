import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS, cleanInput } from "../src/engine.js";
import { makeRig, JOINTS } from "../src/puppet.js";
import { impale, updateBlood, BLOOD_LIMIT, bloodBurst } from "../src/gore.js";
import { knockDown } from "../src/knockdown.js";
import { nuclearField } from "../src/nuclear.js";
import { falloutOpacity } from "../src/nuclear-art.js";
import { blackholeField, wreckTiles } from "../src/blackhole.js";
import { ribbonOutline } from "../src/orbit.js";
import { updateFields } from "../src/specials.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
function fixture() {
  const w = new World({
    players: [0, 1, 2, 3],
    shuffle: false,
    random: () => 0.4,
  });
  w.phase = "fight";
  w.weaponTimer = 999;
  w.hazards = [];
  w.cover = [];
  w.drops = [];
  w.arena = { ...w.arena, spikes: [] };
  w.platforms = [
    {
      id: "floor",
      x: 0,
      y: 1000,
      w: 2560,
      h: 20,
      baseX: 0,
      baseY: 1000,
      dx: 0,
      dy: 0,
    },
  ];
  w.players.forEach((p, i) => {
    Object.assign(p, {
      x: 400 + i * 500,
      y: 970,
      vx: 0,
      vy: 0,
      ground: true,
      support: "floor",
    });
    p.rig = makeRig(p);
  });
  return w;
}
const wire = new RenderSnapshots();
const advance = (w, seconds) => {
  for (let n = 0; n < seconds / STEP; n++) w.step(STEP);
};
test("solid spikes pin the body at contact, emit bounded blood and release when the spike is destroyed", () => {
  const w = fixture(),
    p = w.players[0],
    s = { x: 350, y: 990, w: 200 };
  w.arena = { ...w.arena, spikes: [s] };
  p.y = 958;
  p.rig = makeRig(p);
  assert.ok(w.solids().some((s) => s.spike));
  impale(w, p, s);
  assert.equal(p.alive, false);
  const rag = w.ragdolls[0];
  assert.equal(rag.effect, "impale");
  advance(w, 1);
  assert.deepEqual(
    [rag.points[rag.anchor.point].x, rag.points[rag.anchor.point].y],
    [rag.anchor.x, rag.anchor.y],
  );
  assert.ok(w.blood.length > 20 && w.blood.length <= BLOOD_LIMIT);
  assert.ok(validSnapshot(wire.make(w.snapshot())));
  w.arena = { ...w.arena, spikes: [] };
  advance(w, 0.03);
  assert.equal(rag.anchor, undefined);
  assert.notEqual(rag.effect, "impale");
});
test("heavy bullets and pellets dismember on a kill, bleed on impact, and preserve energy death identities", () => {
  for (const type of ["minigun", "machinegun", "shotgun"]) {
    const w = fixture(),
      p = w.players[0],
      q = w.players[1];
    p.weapon = type;
    p.ammo = 10;
    p.aimAngle = 0;
    p.prone = type === "machinegun";
    p.ground = true;
    q.hp = 5;
    w.attack(p);
    for (let n = 0; n < 100 && q.alive; n++) w.updateProjectiles(STEP);
    assert.equal(q.alive, false, type);
    assert.equal(w.ragdolls[0].effect, "gib");
    assert.equal(w.ragdolls[0].severed.length, 2);
    assert.ok(w.blood.length > 0);
    assert.ok(validSnapshot(wire.make(w.snapshot())));
  }
});
test("thrown weapons cause recoverable passive-body knockdown, with more force and time for heavier weapons", () => {
  const result = [];
  for (const type of ["blaster", "machinegun"]) {
    const w = fixture(),
      p = w.players[0],
      q = w.players[1];
    q.x = p.x + 100;
    q.rig = makeRig(q);
    p.weapon = type;
    p.ammo = 3;
    p.aimAngle = 0;
    w.throwWeapon(p);
    for (let n = 0; n < 50 && !q.knockdown; n++) w.updateDrops(STEP);
    assert.ok(q.alive && q.knockdown > 0);
    result.push([q.vx, q.knockdown]);
    const before = structuredClone(q.rig);
    const x = q.x;
    for (let n = 0; n < 35; n++)
      w.move(
        q,
        cleanInput({ attack: true, block: true, right: true, jump: true }),
        STEP,
      );
    assert.notDeepEqual(q.rig, before);
    assert.ok(q.x > x + 20);
    assert.equal(q.block, false);
    q.weapon = "blaster";
    q.ammo = 5;
    const shots = w.projectiles.length;
    w.attack(q);
    assert.equal(w.projectiles.length, shots);
    for (let n = 0; n < 420; n++) {
      w.move(q, cleanInput({ right: true }), STEP);
      if (!q.knockdown) break;
    }
    assert.equal(q.knockdown, 0);
    assert.equal(q.stun, 0);
    assert.ok(q.alive);
    assert.ok(validSnapshot(wire.make(w.snapshot())));
  }
  assert.ok(result[1][0] > result[0][0] * 1.5);
  assert.ok(result[1][1] > result[0][1] * 1.5);
});
test("knocked fighters collide with walls and recover without clipping through a floor corner", () => {
  const w = fixture(),
    p = w.players[0];
  w.platforms.push({
    id: "wall",
    x: 650,
    y: 500,
    w: 25,
    h: 500,
    baseX: 650,
    baseY: 500,
    dx: 0,
    dy: 0,
  });
  Object.assign(p, { x: 530, vx: 950, vy: -150 });
  p.rig = makeRig(p);
  knockDown(p, "machinegun");
  for (let n = 0; n < 260; n++) {
    w.move(p, cleanInput({ right: true }), STEP);
    assert.ok(
      p.rig.every((q) => q.x < 651),
      "body stays on incoming side of solid wall",
    );
    if (!p.knockdown) break;
  }
  assert.equal(p.knockdown, 0);
});
test("knockdown recovers beneath a low ceiling and on a moving platform", () => {
  for (const moving of [false, true]) {
    const w = fixture(),
      p = w.players[0],
      floor = w.platforms[0];
    if (!moving) {
      w.platforms.push({
        id: "ceiling",
        x: 250,
        y: 915,
        w: 400,
        h: 40,
        baseX: 250,
        baseY: 915,
        dx: 0,
        dy: 0,
      });
      Object.assign(p, { prone: true, y: 990 });
    }
    p.rig = makeRig(p);
    if (!moving)
      p.rig = p.rig.map((q) => {
        const x = p.x - (q.y - p.y),
          y = p.y + (q.x - p.x) * 0.25;
        return { x, y, px: x, py: y };
      });
    knockDown(p, "machinegun");
    for (let n = 0; n < 280 && p.knockdown; n++) {
      if (moving) {
        floor.dx = 0.2;
        floor.dy = -0.3;
        floor.x += floor.dx;
        floor.y += floor.dy;
      }
      w.move(p, cleanInput(), STEP);
    }
    assert.equal(p.knockdown, 0);
    assert.ok(p.alive && p.prone);
    assert.equal(p.support, "floor");
    assert.ok(Math.abs(p.y + 10 - floor.y) < 1);
    if (!moving) assert.ok(p.y - 9 >= 955);
  }
});
test("overlapping black holes remain within the wire budget and consumed pieces stop changing navigation", () => {
  for (let arena = 0; arena < ARENAS.length; arena++) {
    const w = new World({
      players: [0, 1, 2, 3],
      arena,
      shuffle: false,
      random: () => 0.4,
    });
    w.phase = "fight";
    w.fields = [
      blackholeField(w, { x: 750, y: 850, owner: 0 }),
      blackholeField(w, { x: 1700, y: 750, owner: 1 }),
    ];
    for (let n = 0; n < 60; n++) {
      w.time += STEP;
      updateFields(w, STEP);
    }
    assert.ok(w.wreckage.length <= 60);
    assert.ok(w.platforms.length <= 1536);
    assert.ok(validSnapshot(wire.make(w.snapshot())), w.arena.name);
    for (const piece of w.wreckage) piece.hp = 0;
    const revision = w.terrainVersion;
    for (let n = 0; n < 4; n++) updateFields(w, STEP);
    assert.equal(w.terrainVersion, revision);
  }
});
test("blood particles collide, stain surfaces, expire, and reset without unbounded accumulation", () => {
  const w = fixture();
  for (let n = 0; n < 20; n++) bloodBurst(w, 400, 980, 100, 120, 30);
  assert.equal(w.blood.length, BLOOD_LIMIT);
  for (let n = 0; n < 120; n++) updateBlood(w, STEP);
  assert.ok(w.blood.some((b) => b.landed));
  for (let n = 0; n < 850; n++) updateBlood(w, STEP);
  assert.equal(w.blood.length, 0);
  bloodBurst(w, 400, 980);
  w.startRound();
  assert.equal(w.blood.length, 0);
});
test("mushroom-cloud aftermath dissipates completely while the smaller crater and missing platforms remain", () => {
  const w = fixture();
  const f = nuclearField(w, { x: 900, y: 900, owner: 0 });
  w.fields = [f];
  for (let n = 0; n < 1600; n++) {
    w.time += STEP;
    updateFields(w, STEP);
  }
  assert.equal(f.radius, 480);
  assert.equal(w.craters[0].radius, 480);
  assert.equal(falloutOpacity(0), 1);
  assert.ok(falloutOpacity(8) < 0.5);
  assert.equal(falloutOpacity(12), 0);
  assert.equal(falloutOpacity(300), 0);
  assert.ok(!w.platforms.some((p) => p.x < 900 && p.x + p.w > 900));
});
test("a nuke consumes stretched wreckage touching the circle even when its center is outside", () => {
  const w = fixture(),
    piece = {
      id: 1,
      x: 1900,
      y: 900,
      w: 100,
      h: 24,
      hp: 120,
      angle: 0,
      kind: "platform",
      spine: Array.from({ length: 6 }, (_, i) => ({
        x: 1400 + i * 200,
        y: 900,
      })),
    };
  piece.outline = ribbonOutline(piece.spine, piece.h);
  w.wreckage = [piece];
  w.platforms.push(...wreckTiles(piece));
  w.fields = [nuclearField(w, { x: 1000, y: 900, owner: 0 })];
  for (let n = 0; n < 100; n++) {
    w.time += STEP;
    updateFields(w, STEP);
  }
  assert.equal(w.wreckage.length, 0);
  assert.ok(!w.platforms.some((p) => p.wreckId));
  assert.ok(validSnapshot(wire.make(w.snapshot())));
});
test("black-hole bodies form curved simulated strands; ribbon debris orbits inward and snapshots preserve both", () => {
  const w = fixture(),
    p = w.players[0];
  Object.assign(p, { x: 980, y: 750 });
  p.rig = makeRig(p);
  w.kill(p, { effect: "singularity", sourceX: 1100, sourceY: 750 });
  w.fields = [blackholeField(w, { x: 1100, y: 750, owner: 0 })];
  for (let n = 0; n < 90; n++) {
    w.time += STEP;
    updateFields(w, STEP);
    w.updateRagdolls(STEP);
  }
  const a = wire.make(w.snapshot()),
    rag = w.ragdolls[0];
  assert.equal(rag.strands.length, JOINTS.length);
  assert.ok(
    rag.strands.some((s) => {
      const [a, b, c] = s.points;
      return (
        Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 0.03
      );
    }),
  );
  const debris = w.wreckage.find((d) => d.hp > 0),
    initialDistance = Math.hypot(debris.x - 1100, debris.y - 750),
    old = structuredClone(debris.spine);
  for (let n = 0; n < 300; n++) {
    w.time += STEP;
    updateFields(w, STEP);
    w.updateRagdolls(STEP);
  }
  assert.notDeepEqual(debris.spine, old);
  assert.ok(Math.hypot(debris.x - 1100, debris.y - 750) < initialDistance);
  assert.ok(debris.outline.length === 12);
  const b = wire.make(w.snapshot());
  assert.ok(validSnapshot(b));
  assert.ok(interpolateStates(a, b, 0.5).wreckage.some((p) => p.spine));
  for (const corrupt of [
    (s) => (s.players[0].knockdown = 999),
    (s) =>
      s.blood.push({ x: 0, y: 0, vx: 0, vy: 0, r: 50, life: 8, landed: false }),
    (s) => (s.wreckage[0].spine[0].x = Infinity),
  ]) {
    const bad = structuredClone(b);
    corrupt(bad);
    assert.equal(validSnapshot(bad), false);
  }
});
