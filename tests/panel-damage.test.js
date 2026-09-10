import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, WEAPONS, STEP } from "../src/engine.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { updateWreckage } from "../src/blackhole.js";

function fixture(material = "wood") {
  const w = new World({ players: [0, 1], shuffle: false, random: () => .5 });
  w.phase = "fight"; w.cover = []; w.hazards = []; w.drops = []; w.weaponTimer = 999;
  w.arena = { ...w.arena, spikes: [] };
  const hp = material === "glass" ? 65 : 100;
  const panel = { id: "panel", x: 600, y: 500, w: 190, h: 28,
    baseX: 600, baseY: 500, dx: 0, dy: 0,
    destructible: true, panel: material, hp, maxHp: hp };
  w.platforms = [panel];
  w.players.forEach(p => Object.assign(p, { x: 2200, y: 900 }));
  return { w, panel };
}

function shot(w, target, angle = Math.PI / 2, weapon = "blaster") {
  const p = w.players[0];
  Object.assign(p, { x: target.x - Math.cos(angle) * 70,
    y: target.y - Math.sin(angle) * 70 + 10, aimAngle: angle,
    weapon, ammo: WEAPONS[weapon].ammo, prone: weapon === "machinegun", ground: true });
  w.projectiles = [];
  w.attack(p);
  assert.ok(w.projectiles.length > 0, `${weapon} fired`);
  w.updateProjectiles(.1);
}

for (const material of ["wood", "glass"]) {
  for (const [side, angle] of [["above", Math.PI / 2], ["below", -Math.PI / 2], ["left", 0], ["right", Math.PI]]) {
    test(`pistol shots damage and destroy ${material} panels from ${side}`, () => {
      const { w, panel } = fixture(material), target = { x: panel.x + panel.w / 2, y: panel.y + panel.h / 2 };
      // Side shots must begin outside the panel, beyond its wider half extent.
      if (side === "left") target.x = panel.x;
      if (side === "right") target.x = panel.x + panel.w;
      const damage = WEAPONS.blaster.damage, shots = Math.ceil(panel.maxHp / damage);
      for (let n = 1; n <= shots; n++) {
        shot(w, target, angle);
        assert.equal(panel.hp, Math.max(0, panel.maxHp - damage * n));
        assert.equal(w.solids().includes(panel), n < shots);
        assert.equal(w.terrainVersion, n < shots ? 0 : 1);
      }
      assert.equal(w.events.filter(e => e.type === "break").length, 1);
      assert.ok(w.debris.length > 0);
      shot(w, target, angle);
      assert.ok(w.projectiles.length > 0, "later shots pass through the opening");
      assert.equal(w.terrainVersion, 1);
    });
  }
}

test("ordinary guns, rail shots, saws and elemental projectiles retain panel damage", () => {
  for (const weapon of ["smg", "shotgun", "minigun", "machinegun", "burst", "railgun", "saw", "flame", "frost", "ricochet", "repulsor"]) {
    const { w, panel } = fixture();
    shot(w, { x: 695, y: 514 }, Math.PI / 2, weapon);
    assert.ok(panel.hp < panel.maxHp, weapon);
  }
});

test("shooting out a panel drops its fighter, furniture and loose weapon", () => {
  const { w, panel } = fixture();
  w.platforms.push({ id: "bottom", x: 100, y: 900, w: 1800, h: 30 });
  Object.assign(w.players[1], { x: 640, y: 472, ground: true, support: panel.id });
  w.cover = [{ id: "crate", kind: "crate", x: 710, y: 450, w: 50, h: 50, hp: 75, maxHp: 75 }];
  w.drops = [{ x: 680, y: 493, vx: 0, vy: 0, type: "rocket", ammo: 3, life: 60, support: panel.id, lock: 5 }];
  for (let n = 0; n < 5; n++) shot(w, { x: 620, y: 514 }, -Math.PI / 2);
  assert.equal(panel.hp, 0);
  for (let n = 0; n < .35 / STEP; n++) w.step(STEP);
  assert.ok(w.players[1].y > 540);
  assert.ok(w.cover[0].y > 500);
  assert.ok(w.drops[0].y > 540);
});

test("bullets destroy remaining panel fragments after an explosion without touching structural fragments", () => {
  const { w, panel } = fixture();
  const wall = { id: "wall", x: 300, y: 700, w: 1000, h: 28 };
  w.platforms.push(wall);
  w.explode({ x: panel.x, y: panel.y, radius: 60, damage: 0, force: 0 });
  const remains = w.platforms.filter(p => p.sourceId === panel.id);
  assert.ok(remains.length > 0);
  const before = w.terrainVersion;
  for (const piece of remains) {
    shot(w, { x: piece.x + piece.w / 2, y: piece.y + piece.h / 2 }, Math.PI / 2, "railgun");
    assert.equal(piece.hp, 0);
  }
  assert.ok(w.terrainVersion > before);
  assert.ok(w.solids().includes(wall));
  assert.equal(wall.hp, undefined);
});

test("bullet damage to warped collision strips destroys their shared wreck and cannot regenerate", () => {
  const { w, panel } = fixture();
  panel.wreckId = 1;
  w.wreckage = [{ id: 1, x: 695, y: 514, w: 100, h: 28, angle: 0, hp: 100, kind: "platform" }];
  shot(w, { x: 695, y: 514 }, Math.PI / 2, "railgun");
  assert.equal(w.wreckage[0].hp, 0);
  updateWreckage(w, STEP);
  assert.ok(!w.solids().some(p => p.wreckId === 1));
});

test("bullet-destroyed panels persist through guest transport and interpolation, then reset in every arena", async () => {
  for (let arena = 0; arena < ARENAS.length; arena++) {
    const w = new World({ arena, players: [0, 1], shuffle: false, random: () => .5 });
    w.cover = []; w.hazards = []; w.players[1].x = 2500;
    const wire = new RenderSnapshots(), before = wire.make(w.snapshot());
    const panels = w.platforms.filter(p => p.destructible);
    for (const panel of panels) {
      shot(w, { x: panel.x + panel.w / 2, y: panel.y }, Math.PI / 2, "railgun");
      assert.equal(panel.hp, 0, `${ARENAS[arena].name} ${panel.id}`);
    }
    const state = wire.make(w.snapshot());
    assert.ok(validSnapshot(state), ARENAS[arena].name);
    const guest = await decodeState(await encodeState(state));
    assert.deepEqual(guest.platforms, JSON.parse(JSON.stringify(state.platforms)));
    assert.ok(interpolateStates(before, state, .5).platforms.filter(p => p.destructible).every(p => p.hp === 0));
    w.startRound();
    assert.ok(w.platforms.filter(p => p.destructible).every(p => p.hp === p.maxHp));
  }
});
