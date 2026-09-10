import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS, cleanInput, ARENAS } from "../src/engine.js";
import { combatFloor } from "./helpers.js";
import { updateFields, impactSpecial } from "../src/specials.js";
import { blackholeField, wreckCorners, wreckTiles } from "../src/blackhole.js";
import { validSnapshot } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { makeRig } from "../src/puppet.js";
import { nuclearField } from "../src/nuclear.js";
import { navigation, navigationSteps } from "../src/navigation.js";
const wire = new RenderSnapshots();
function fixture() {
  const w = new World({
    players: [0, 1, 2, 3],
    shuffle: false,
    random: () => 0.4,
  });
  combatFloor(w);
  w.phase = "fight";
  w.players.forEach((p, i) => {
    Object.assign(p, {
      x: 500 + i * 300,
      y: 535,
      vx: 0,
      vy: 0,
      ground: true,
      support: "floor0",
      aimAngle: i ? Math.PI : 0,
    });
    p.rig = makeRig(p);
  });
  return w;
}
function shoot(w, type, hp = 100) {
  const p = w.players[0],
    q = w.players[1];
  Object.assign(p, { weapon: type, ammo: WEAPONS[type].ammo, aimAngle: 0 });
  q.hp = hp;
  w.attack(p);
  for (let n = 0; n < 70 && q.hp === hp; n++) w.updateProjectiles(STEP);
  return q;
}
function fields(w, seconds) {
  for (let n = 0; n < seconds / STEP; n++) {
    w.time += STEP;
    updateFields(w, STEP);
    w.updateRagdolls(STEP);
  }
}

test("saws and railguns split a full-health rushing fighter in one unblocked hit, and keep piercing", () => {
  for (const type of ["saw", "railgun"]) {
    const w = fixture(),
      q = w.players[1];
    q.rush = 0.2;
    q.weapon = null;
    const r = w.players[2];
    r.x = 930;
    shoot(w, type);
    for (let n = 0; n < 30; n++) w.updateProjectiles(STEP);
    assert.equal(q.alive, false, type);
    assert.equal(r.alive, false, type);
    assert.ok(
      w.ragdolls.every((r) => r.effect === "slice" && r.points.length === 13),
    );
    const rag = w.ragdolls[0];
    for (let n = 0; n < 30; n++) w.updateRagdolls(STEP);
    assert.ok(
      Math.hypot(
        rag.points[11].x - rag.points[12].x,
        rag.points[11].y - rag.points[12].y,
      ) > 30,
    );
    assert.ok(validSnapshot(wire.make(w.snapshot())));
  }
});

test("a timed empty-handed parry still reflects a lethal cutting shot", () => {
  for (const type of ["saw", "railgun"]) {
    const w = fixture(),
      q = w.players[1];
    Object.assign(q, { block: true, blockTime: 0, aimAngle: Math.PI });
    shoot(w, type);
    assert.equal(q.hp, 100);
    assert.equal(q.alive, true);
    assert.ok(w.events.some((e) => e.type === "parry"));
  }
});

test("plasma and Tesla reveal living skeletons; lethal hits and Tesla chains leave energy skeletons", () => {
  for (const type of ["plasma", "tesla"]) {
    const w = fixture(),
      q = shoot(w, type);
    assert.ok(q.alive);
    assert.ok(q.xray > 0);
    assert.equal(q.xrayType, type);
    const next = fixture();
    shoot(next, type, 15);
    assert.equal(next.players[1].alive, false);
    assert.equal(next.ragdolls[0].effect, type);
    assert.equal(next.ragdolls[0].ash, true);
    assert.ok(validSnapshot(wire.make(next.snapshot())));
  }
  const w = fixture();
  w.players[2].x = 970;
  w.players[2].hp = 10;
  shoot(w, "tesla", 10);
  assert.equal(w.players[2].alive, false);
  assert.ok(w.ragdolls.every((r) => r.effect === "tesla"));
});

test("freeze ray locks movement, jumping, ducking, firing and pose, then thaws without a permanent lock", () => {
  const w = fixture(),
    q = shoot(w, "frost");
  assert.ok(q.freeze > 1);
  Object.assign(q, { vx: 0, vy: 0, weapon: "blaster", ammo: 14 });
  const x = q.x;
  for (let n = 0; n < 60; n++)
    w.move(
      q,
      cleanInput({ right: true, jump: true, duck: true, attack: true }),
      STEP,
    );
  assert.equal(q.prone, false);
  assert.ok(Math.abs(q.x - x) < 1);
  assert.equal(q.jumps, 0);
  const bullets = w.projectiles.length;
  w.attack(q);
  assert.equal(w.projectiles.length, bullets);
  impactSpecial(w, { chill: 1.4, kind: "frost" }, q, true);
  assert.ok(
    q.freeze < 0.7,
    "rapid hits do not extend the existing freeze indefinitely",
  );
  for (let n = 0; n < 190; n++) w.move(q, cleanInput({ right: true }), STEP);
  assert.equal(q.freeze, 0);
  assert.ok(q.vx > 230);
  assert.ok(validSnapshot(wire.make(w.snapshot())));
});

test("frozen bodies shatter on a lethal follow-up; flame and explosive kills have distinct remains", () => {
  const w = fixture(),
    q = shoot(w, "frost");
  q.hp = 30;
  w.hit(q, { x: q.x - 30, y: q.y, vx: 0, vy: 0 }, 22, 100, 1, 0, {
    projectile: true,
  });
  assert.equal(q.alive, false);
  assert.equal(w.ragdolls[0].effect, "ice");
  const fire = fixture(),
    p = fire.players[1];
  p.hp = 0.01;
  p.burn = 1;
  fire.move(p, cleanInput({}), STEP);
  assert.equal(fire.ragdolls[0].effect, "burn");
  const blast = fixture();
  shoot(blast, "rocket", 10);
  assert.equal(blast.ragdolls[0].effect, "blast");
});

test("black hole captures grounded fighters through torn cover and compresses them only when it closes", () => {
  const w = fixture(),
    f = blackholeField(w, { x: 1000, y: 400, owner: 0 });
  w.fields = [f];
  const p = w.players[0];
  Object.assign(p, { x: 650, y: 500, vx: 0, vy: 0, ground: true });
  w.platforms.push({
    id: "wall",
    x: 800,
    y: 200,
    w: 25,
    h: 350,
    baseX: 800,
    baseY: 200,
    dx: 0,
    dy: 0,
  });
  fields(w, 0.55);
  assert.ok(p.knockdown > 0 && p.strands);
  assert.equal(p.ground, false);
  const q = w.players[1];
  Object.assign(q, { x: 970, y: 390, hp: 100, alive: true });
  q.rig = makeRig(q);
  fields(w, 0.025);
  assert.equal(q.alive, true);
  assert.ok(q.strands);
  assert.ok(validSnapshot(wire.make(w.snapshot())));
  fields(w, 5.1);
  assert.equal(q.alive,false);
  assert.ok(w.wreckage.some(w=>w.kind === "matter" && w.totals[3]>=1));
});

test("black hole twists structural platforms and traps into lasting, breakable collision geometry", () => {
  const w = new World({
    players: [0, 1, 2, 3],
    arena: 18,
    shuffle: false,
    random: () => 0.4,
  });
  w.phase = "fight";
  const original = structuredClone(w.platforms),
    traps = w.hazards.length;
  w.fields = [blackholeField(w, { x: 1300, y: 750, owner: 0 })];
  fields(w, 0.5);
  assert.ok(w.wreckage.length > 5);
  assert.ok(w.hazards.length < traps);
  assert.ok(w.wreckage.some((w) => w.kind === "trap"));
  const first = structuredClone(w.wreckage);
  fields(w, 3);
  assert.ok(
    w.wreckage.some(
      (p, i) =>
        Math.abs(p.angle - first[i].angle) > 1 &&
        Math.hypot(p.x - first[i].x, p.y - first[i].y) > 40,
    ),
  );
  assert.ok(w.platforms.some((p) => p.wreckId));
  assert.ok(validSnapshot(wire.make(w.snapshot())));
  fields(w, 2.5);
  assert.equal(w.fields.length, 0);
  assert.notDeepEqual(w.platforms, original);
  const settled = structuredClone(w.wreckage);
  fields(w, 0.5);
  assert.deepEqual(w.wreckage, settled);
  const piece = w.wreckage.find((w) => w.hp > 0),
    tile = w.platforms.find((p) => p.wreckId === piece.id);
  w.damageCover(tile, 200);
  fields(w, 0.02);
  assert.ok(!w.platforms.some((p) => p.wreckId === piece.id));
  w.startRound();
  assert.equal(w.wreckage.length, 0);
  assert.equal(w.rifts.length, 0);
});

test("rotated wreck collision follows its visible polygon and does not span its empty bounding corners", () => {
  for (const angle of [0.3, 0.8, 1.5, 2.4]) {
    const w = { id: 1, x: 500, y: 500, w: 110, h: 20, angle, hp: 120 },
      tiles = wreckTiles(w),
      points = wreckCorners(w);
    assert.ok(tiles.length <= 12);
    for (const p of points)
      assert.ok(
        tiles.some(
          (s) =>
            p.x >= s.x - 0.01 &&
            p.x <= s.x + s.w + 0.01 &&
            p.y >= s.y - 0.01 &&
            p.y <= s.y + s.h + 0.01,
        ),
      );
    const xs = [
        Math.min(...points.map((p) => p.x)) + 1,
        Math.max(...points.map((p) => p.x)) - 1,
      ],
      ys = [
        Math.min(...points.map((p) => p.y)) + 1,
        Math.max(...points.map((p) => p.y)) - 1,
      ];
    for (const x of xs)
      for (const y of ys) {
        const dx = x - w.x,
          dy = y - w.y,
          lx = dx * Math.cos(angle) + dy * Math.sin(angle),
          ly = -dx * Math.sin(angle) + dy * Math.cos(angle);
        if (Math.abs(lx) < w.w / 2 + 16 && Math.abs(ly) < w.h / 2 + 16)
          continue;
        assert.ok(
          !tiles.some(
            (s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h,
          ),
        );
      }
  }
});

test("nuke vaporizes warped machinery without rebuilding invisible wreck colliders", () => {
  const w = fixture();
  w.fields = [blackholeField(w, { x: 1000, y: 500, owner: 0 })];
  fields(w, 5.6);
  assert.ok(w.wreckage.length > 0);
  const n = nuclearField(w, { x: 1000, y: 500, owner: 1 });
  w.fields = [n];
  fields(w, 0.4);
  assert.ok(w.wreckage.every(piece=>Math.hypot(piece.x-n.x,piece.y-n.y)>n.radius));
  assert.ok(w.platforms.filter(p=>p.wreckId).every(p=>w.wreckage.some(piece=>piece.id===p.wreckId)));
  assert.ok(validSnapshot(wire.make(w.snapshot())));
});

test("late-join snapshots retain warped ruins and interpolate identities without moving platforms across gaps", () => {
  const w = fixture();
  w.fields = [blackholeField(w, { x: 1000, y: 500, owner: 0 })];
  fields(w, 1);
  const a = wire.make(w.snapshot());
  fields(w, 0.1);
  const b = wire.make(w.snapshot());
  const mid = interpolateStates(a, b, 0.5);
  assert.equal(mid.wreckage.length, b.wreckage.length);
  assert.ok(mid.wreckage.some((p, i) => p.x !== b.wreckage[i].x));
  fields(w, 5);
  const guest = JSON.parse(JSON.stringify(wire.make(w.snapshot())));
  assert.ok(validSnapshot(guest));
  assert.ok(guest.wreckage.length > 0 && guest.rifts.length > 0);
  for (const mutate of [
    (s) => (s.wreckage[0].angle = Infinity),
    (s) => (s.players[0].freeze = 900),
    (s) => (s.rifts[0].radius = 900),
  ]) {
    const bad = structuredClone(guest);
    mutate(bad);
    assert.equal(validSnapshot(bad), false);
  }
});

test("all arenas produce bounded, valid ruined terrain after a black hole", () => {
  for (let arena = 0; arena < ARENAS.length; arena++) {
    const w = new World({
      players: [0, 1, 2, 3],
      arena,
      shuffle: false,
      random: () => 0.4,
    });
    w.phase = "fight";
    w.fields = [blackholeField(w, { x: 1280, y: 900, owner: 0 })];
    fields(w, 0.45);
    assert.ok(w.wreckage.length <= 60);
    assert.ok(w.platforms.length < 750);
    assert.ok(validSnapshot(wire.make(w.snapshot())), w.arena.name);
  }
});

test("fragmented route planning yields between flight batches without dropping routes", () => {
  const solids = [
    { id: "a", x: 100, y: 800, w: 300, h: 20 },
    { id: "b", x: 500, y: 620, w: 160, h: 20 },
    { id: "c", x: 700, y: 800, w: 250, h: 20 },
  ];
  const steps = [...navigationSteps(solids, { batchSize: 8 })];
  assert.ok(steps.filter((s) => s === null).length > 20);
  assert.deepEqual(new Map(steps.filter(Boolean)), navigation(solids));
});

test("the final sword swing still cuts if contact occurs after its ammo is spent", () => {
  const w = fixture(),
    p = w.players[0],
    q = w.players[1];
  p.weapon = "sword";
  p.ammo = 1;
  q.hp = 10;
  w.attack(p);
  assert.equal(p.weapon, "sword");
  assert.equal(p.ammo, 0);
  q.x = p.x + 45;
  q.rig = makeRig(q);
  for (let n = 0; n < 35 && q.alive; n++) w.step(STEP);
  assert.equal(q.alive, false);
  assert.equal(w.ragdolls[0].effect, "slice");
  for (let n = 0; n < 70; n++) w.step(STEP);
  assert.equal(p.weapon, null);
});

test("a launched singularity must resolve before the last survivor scores", () => {
  const w = fixture(),
    p = w.players[0];
  w.players.slice(1).forEach((q) => {
    q.alive = false;
    q.hp = 0;
  });
  p.weapon = "blackhole";
  p.ammo = 2;
  w.attack(p);
  w.step(STEP);
  assert.equal(w.phase, "fight");
  assert.equal(w.scores[0], 0);
});

test("a nuke consumes an earlier split or frozen death without retaining its old pose", () => {
  for (const effect of ["slice", "ice", "singularity"]) {
    const w = fixture(),
      q = w.players[1];
    w.kill(q, { effect, sourceX: 900, sourceY: 500 });
    w.fields = [nuclearField(w, { x: q.x, y: q.y, owner: 0 })];
    fields(w, 0.05);
    const rag = w.ragdolls[0];
    assert.equal(rag.ash, true);
    assert.equal(rag.effect, undefined);
    assert.equal(rag.points.length, 11);
    assert.ok(validSnapshot(wire.make(w.snapshot())));
  }
});
