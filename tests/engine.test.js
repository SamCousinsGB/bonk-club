import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS, WEAPONS, cleanInput } from "../src/engine.js";
const advance = (w, seconds, inputs = {}) => {
  for (let n = 0; n < Math.ceil(seconds / STEP); n++) w.step(STEP, inputs);
};
function fight() {
  const w = new World({ arena: 0, shuffle: false, random: () => 0.4 });
  w.phase = "fight";
  const [a, b] = w.players;
  Object.assign(a, { x: 600, y: 535, ground: true, facing: 1 });
  Object.assign(b, { x: 650, y: 535, ground: true, facing: -1 });
  return w;
}
test("no single player or duplicate slots can start a match", () => {
  assert.throws(() => new World({ players: [0] }));
  assert.throws(() => new World({ players: [0, 0] }));
  assert.throws(() => new World({ players: [0, 1, 2, 3, 4] }));
});
test("network input only accepts literal booleans, never player position or damage", () => {
  assert.deepEqual(
    cleanInput({ attack: true, left: 1, block: "yes", x: 700, hp: 500 }),
    {
      left: false,
      right: false,
      jump: false,
      attack: true,
      block: false,
      pickup: false,
      duck: false,
      aim: null,
    },
  );
});
for (let arena = 0; arena < ARENAS.length; arena++)
  test(`all four spawns are safe: ${ARENAS[arena].name}`, () => {
    const w = new World({ players: [0, 1, 2, 3], arena, shuffle: false });
    advance(w, 2.5);
    assert.equal(w.phase, "fight");
    assert.equal(w.players.filter((p) => p.alive).length, 4);
    for (const p of w.players) assert.ok(Number.isFinite(p.x) && p.y < 720);
  });
test("a punch removes health and produces knockback and hitstop", () => {
  const w = fight();
  w.attack(w.players[0]);
  assert.equal(w.players[1].hp, 75);
  assert.ok(w.players[1].vx > 480);
  assert.ok(w.players[1].vy < 0);
  assert.ok(w.hitstop > 0);
});
test("a front-facing timed parry launches the attacker and preserves health", () => {
  const w = fight(),
    [a, b] = w.players;
  b.block = true;
  b.blockTime = 0.1;
  w.attack(a);
  assert.equal(b.hp, 100);
  assert.ok(a.vx < -700);
  assert.ok(a.stun > 0);
  assert.ok(w.events.some((e) => e.type === "parry"));
});
test("holding guard reduces knockback and consumes stamina", () => {
  const w = fight(),
    [a, b] = w.players;
  b.block = true;
  b.blockTime = 0.8;
  w.attack(a);
  assert.equal(b.hp, 100);
  assert.equal(b.stamina, 77);
  assert.ok(b.vx > 0 && b.vx < 200);
  assert.ok(a.vx < 0);
});
test("a block facing away does not prevent damage", () => {
  const w = fight(),
    [a, b] = w.players;
  b.facing = 1;
  b.block = true;
  b.blockTime = 0.01;
  w.attack(a);
  assert.equal(b.hp, 75);
});
test("defence is resolved for every player before either attacks", () => {
  for (const attackId of [0, 1]) {
    const w = fight(),
      defenceId = 1 - attackId;
    w.step(STEP, {
      [attackId]: { attack: true },
      [defenceId]: { block: true },
    });
    assert.equal(w.players[defenceId].hp, 100);
    assert.ok(w.players[attackId].stun > 0);
  }
});
test("jump has a rising edge and allows exactly one extra air jump", () => {
  const w = fight(),
    p = w.players[0];
  w.players[1].x = 950;
  w.step(STEP, { 0: { jump: true } });
  assert.equal(p.jumps, 1);
  advance(w, 0.04, { 0: { jump: true } });
  assert.equal(p.jumps, 1);
  w.step(STEP, { 0: { jump: false } });
  w.step(STEP, { 0: { jump: true } });
  assert.equal(p.jumps, 2);
  w.step(STEP, { 0: { jump: false } });
  w.step(STEP, { 0: { jump: true } });
  assert.equal(p.jumps, 2);
});
test("weapon pickup swaps equipment and empty ammo returns to fists", () => {
  const w = fight(),
    p = w.players[0];
  w.drops = [
    { type: "rocket", x: p.x, y: p.y, ammo: 1, life: 5, vx: 0, vy: 0 },
  ];
  w.pickup(p);
  assert.equal(p.weapon, "rocket");
  w.attack(p);
  assert.equal(p.weapon, null);
  assert.equal(w.projectiles[0].kind, "rocket");
});
test("all six weapons have a working attack and consume ammunition", () => {
  for (const type of Object.keys(WEAPONS)) {
    const w = fight(),
      p = w.players[0];
    p.weapon = type;
    p.ammo = 4;
    w.attack(p);
    assert.equal(p.ammo, 3);
    assert.ok(w.players[1].hp < 100 || w.projectiles.length > 0);
  }
});
test("explosives hurt the shooter too", () => {
  const w = fight();
  w.explode({ x: 600, y: 535, damage: 58, force: 1050 });
  assert.ok(w.players[0].hp < 100);
  assert.ok(w.players[1].hp < 100);
});
test("bullets reflect from a timed parry", () => {
  const w = fight(),
    p = w.players[1];
  p.block = true;
  p.blockTime = 0.1;
  w.projectiles = [
    {
      x: 648,
      y: 530,
      vx: 100,
      vy: 0,
      owner: 0,
      kind: "bullet",
      damage: 17,
      force: 350,
      life: 2,
      r: 4,
    },
  ];
  w.updateProjectiles(STEP);
  assert.equal(w.projectiles.length, 1);
  assert.equal(w.projectiles[0].owner, 1);
  assert.ok(w.projectiles[0].vx < 0);
  assert.equal(p.hp, 100);
});
test("a ring-out awards exactly one point then advances to a fresh round", () => {
  const w = fight();
  w.players[1].y = 900;
  w.step(STEP);
  assert.equal(w.phase, "result");
  assert.equal(w.scores[0], 1);
  advance(w, 2.9);
  assert.equal(w.round, 2);
  assert.equal(w.scores[0], 1);
  assert.equal(w.phase, "countdown");
});
test("reaching the target ends the match", () => {
  const w = fight();
  w.target = 1;
  w.players[1].y = 900;
  w.step(STEP);
  advance(w, 2.9);
  assert.equal(w.phase, "match");
  assert.equal(w.winner, 0);
});
test("simultaneous ring-outs produce a draw without awarding a point", () => {
  const w = fight();
  for (const p of w.players) p.y = 900;
  w.step(STEP);
  assert.equal(w.phase, "result");
  assert.equal(w.winner, null);
  assert.deepEqual(w.scores, [0, 0, 0, 0]);
});
test("spikes eliminate on contact", () => {
  const w = new World({ arena: 2 });
  w.phase = "fight";
  Object.assign(w.players[0], { x: 620, y: 530 });
  w.step(STEP);
  assert.equal(w.players[0].alive, false);
});
test("sudden death prevents indefinite rounds", () => {
  const w = fight();
  w.players[1].x = 950;
  w.elapsed = 45;
  advance(w, 14);
  assert.equal(w.phase, "result");
});
test("ragdoll joints remain finite and approximately constrained", () => {
  const w = fight();
  w.kill(w.players[1]);
  for (let i = 0; i < 200; i++) w.updateRagdolls(STEP);
  const points = w.ragdolls[0].points;
  for (const p of points)
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.ok(
    Math.abs(
      Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) - 20,
    ) < 5,
  );
});
test("seeded four-player combat stays finite across every arena", () => {
  for (let arena = 0; arena < ARENAS.length; arena++) {
    let seed = 7;
    const rand = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const w = new World({
      players: [0, 1, 2, 3],
      arena,
      random: rand,
      shuffle: false,
      target: 10,
    });
    let inputs = {};
    for (let n = 0; n < 7200; n++) {
      if (n % 24 === 0)
        inputs = Object.fromEntries(
          w.ids.map((id) => [
            id,
            {
              left: rand() < 0.45,
              right: rand() < 0.45,
              attack: rand() < 0.8,
              block: rand() < 0.25,
              jump: rand() < 0.5,
              pickup: rand() < 0.5,
            },
          ]),
        );
      w.step(STEP, inputs);
      for (const p of w.players)
        assert.ok([p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite));
      assert.ok(w.drops.length < 15);
      assert.ok(w.projectiles.length < 100);
    }
  }
});
