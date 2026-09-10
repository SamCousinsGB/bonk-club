import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, W, WEAPONS, cleanInput } from "../src/engine.js";
import { secondaryAction } from "../src/arsenal.js";
import { validSnapshot } from "../src/network.js";
import { combatFloor } from "./helpers.js";

function fixture() {
  const w = new World({
    players: [0, 1, 2, 3],
    shuffle: false,
    random: () => 0.4,
  });
  combatFloor(w);
  w.phase = "fight";
  w.players.forEach((p, n) =>
    Object.assign(p, {
      x: 700 + n * 400,
      y: 535,
      ground: true,
      support: "floor0",
      aimAngle: 0,
    }),
  );
  return w;
}
function equip(p, type) {
  p.weapon = type;
  p.ammo = WEAPONS[type].ammo;
}
test("every weapon, including bat and sword, disables guard without draining stamina or slowing movement", () => {
  for (const type of Object.keys(WEAPONS)) {
    const w = fixture(),
      p = w.players[0];
    equip(p, type);
    for (let n = 0; n < 60; n++)
      w.move(p, cleanInput({ block: true, right: true }), STEP);
    assert.equal(p.block, false, type);
    assert.equal(p.stamina, 100, type);
    assert.ok(p.vx > 235, type);
  }
});
test("stale armed guard cannot block melee, blast damage or reflect bullets", () => {
  for (const type of ["bat", "sword", "railgun", "shotgun"]) {
    const w = fixture(),
      [p, q] = w.players;
    equip(q, type);
    Object.assign(q, { x: 750, facing: -1, block: true, blockTime: 0 });
    w.attack(p);
    assert.equal(q.hp, 75, type);
    q.hp = 100;
    q.block = true;
    w.projectiles.push({
      x: 710,
      y: 525,
      vx: 1900,
      vy: 0,
      r: 4,
      life: 2,
      kind: "bullet",
      owner: 0,
      damage: 17,
      force: 100,
    });
    for (let n = 0; n < 4; n++) w.updateProjectiles(STEP);
    assert.equal(q.hp, 83, type);
    assert.equal(w.projectiles.length, 0, type);
    q.hp = 100;
    q.block = true;
    w.explode({ x: 720, y: 525, damage: 50, force: 400, radius: 150 });
    assert.ok(q.hp < 100, type);
  }
});
test("picking up a weapon ends a guard immediately; throwing it restores fist blocking", () => {
  const w = fixture(),
    p = w.players[0];
  p.block = true;
  w.drops.push({
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    type: "bat",
    ammo: 8,
    life: 30,
  });
  w.pickup(p);
  assert.equal(p.block, false);
  assert.equal(secondaryAction(p), null);
  w.throwWeapon(p);
  w.move(p, cleanInput({ block: true }), STEP);
  assert.equal(p.block, true);
  assert.equal(secondaryAction(p).label, "PARRY");
});
test("right-click activates alternate shots with shared cooldown and exact ammo cost, never a guard", () => {
  for (const type of ["shotgun", "plasma"]) {
    const w = fixture(),
      p = w.players[0];
    equip(p, type);
    p.ammo = 5;
    w.step(STEP, { 0: { block: true, attack: true } });
    assert.equal(p.block, false);
    assert.equal(p.ammo, 3);
    assert.equal(w.projectiles.length, type === "shotgun" ? 10 : 1);
    assert.ok(w.projectiles.every((b) => b.alternate));
    if (type === "plasma") {
      assert.equal(w.projectiles[0].damage, 110);
      assert.equal(w.projectiles[0].radius, 205);
    }
    w.step(STEP, { 0: { attack: true } });
    assert.equal(p.ammo, 3);
    p.cooldown = 0;
    p.ammo = 1;
    w.step(STEP, { 0: { block: true } });
    assert.equal(p.ammo, 1);
    assert.ok(validSnapshot(w.snapshot()));
  }
});
test("weapons without alternate fire ignore the secondary input and can still fire normally", () => {
  const w = fixture(),
    p = w.players[0];
  equip(p, "blaster");
  w.step(STEP, { 0: { block: true } });
  assert.equal(p.ammo, WEAPONS.blaster.ammo);
  w.step(STEP, { 0: { block: true, attack: true } });
  assert.equal(p.ammo, WEAPONS.blaster.ammo - 1);
  assert.equal(p.block, false);
  assert.equal(secondaryAction(p), null);
});
test("armed AI reacts to incoming fire without trying to guard or accidentally triggering alternate fire", () => {
  const w = fixture();
  w.botIds.add(1);
  const p = w.players[1];
  p.bot = true;
  equip(p, "shotgun");
  w.projectiles.push({
    x: p.x - 170,
    y: p.y - 10,
    vx: 1200,
    vy: 0,
    r: 4,
    life: 1,
    kind: "bullet",
    owner: 0,
    damage: 17,
    force: 100,
  });
  for (let n = 0; n < 30; n++) {
    const inputs = w.ai.inputs(w, STEP);
    assert.equal(inputs[1].block, false);
    w.step(STEP);
    assert.equal(p.block, false);
  }
});
test("heavy recoil carries the shooter on the ground even against held movement, and in the air", () => {
  for (const type of [
    "rocket",
    "railgun",
    "barrage",
    "plasma",
    "homing",
    "cluster",
    "repulsor",
    "blackhole",
  ]) {
    for (const grounded of [true, false]) {
      const w = fixture(),
        p = w.players[0];
      equip(p, type);
      p.x = 1200;
      p.ground = grounded;
      p.y = grounded ? 535 : 300;
      w.attack(p);
      assert.ok(p.vx <= -250, type);
      const from = p.x;
      for (let n = 0; n < 20; n++) w.move(p, cleanInput({ right: true }), STEP);
      assert.ok(
        p.x < from - 24,
        `${type} grounded=${grounded} moved ${p.x - from}`,
      );
      assert.ok(validSnapshot(w.snapshot()));
    }
  }
});
test("downward heavy fire launches the shooter, while deployed heavy machine gun stays braced", () => {
  const w = fixture(),
    p = w.players[0];
  equip(p, "railgun");
  p.aimAngle = Math.PI / 2;
  w.attack(p);
  assert.ok(p.vy < -500);
  w.move(p, cleanInput({}), STEP);
  assert.ok(p.y < 532);
  Object.assign(p, {
    x: 700,
    y: 555,
    ground: true,
    prone: true,
    vx: 0,
    vy: 0,
    recoilTime: 0,
    aimAngle: 0,
  });
  equip(p, "machinegun");
  const x = p.x;
  for (let n = 0; n < 30; n++) {
    w.attack(p);
    w.move(p, cleanInput({ duck: true }), STEP);
  }
  assert.equal(p.x, x);
  assert.equal(p.recoilTime, 0);
  assert.equal(p.vx, 0);
  equip(p, "rocket");
  w.attack(p);
  assert.ok(p.vx < -300, "lying down alone does not brace a rocket launcher");
});
test("normal and nuclear grenades travel at a readable speed and stay within half the arena", () => {
  for (const type of ["grenade", "nuke"])
    for (const y of [100, 700, 1370]) {
      let longest = 0;
      for (let n = 0; n <= 24; n++) {
        const w = fixture(),
          p = w.players[0];
        w.platforms = [{ id: "floor", x: 0, y: 1400, w: W, h: 30 }];
        // Exercise both directions and downward, flat and upward throws.
        const right = n % 2 === 0;
        p.x = right ? 100 : W - 100;
        p.y = y;
        const elevation = -Math.PI / 2 + (n * Math.PI) / 24;
        p.aimAngle = Math.atan2(
          Math.sin(elevation),
          (right ? 1 : -1) * Math.cos(elevation),
        );
        equip(p, type);
        w.attack(p);
        const b = w.projectiles[0];
        let farthest = 0;
        for (let tick = 0; tick < 350 && w.projectiles.includes(b); tick++) {
          w.updateProjectiles(STEP);
          farthest = Math.max(farthest, Math.abs(b.x - p.x));
          if (tick === 59)
            assert.ok(
              farthest <= 250,
              "half a second leaves time to see the throw",
            );
        }
        longest = Math.max(longest, farthest);
        assert.ok(
          farthest <= W / 2,
          `${type} from ${y} at ${elevation}: ${farthest}`,
        );
        assert.equal(w.projectiles.includes(b), false, "the fuse expires");
        assert.ok(
          w.events.some((e) => e.type === "explosion"),
          "the throw still detonates",
        );
      }
      assert.ok(
        longest >= W * 0.38,
        `${type} from ${y} retains a useful long throw: ${longest}`,
      );
    }
});
test("nuclear pickup is single use and launches a live grenade through attack or throw", () => {
  for (const input of [{ attack: true }, { throw: true }]) {
    const w = fixture(),
      p = w.players[0];
    w.drops.push({
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      type: "nuke",
      ammo: 1,
      life: 30,
    });
    w.pickup(p);
    w.step(STEP, { 0: input });
    assert.equal(p.weapon, null);
    assert.equal(p.ammo, 0);
    assert.equal(w.projectiles.length, 1);
    assert.equal(w.projectiles[0].nuclear, true);
    assert.equal(w.drops.length, 0);
    assert.equal(WEAPONS.nuke.rarity, "exotic");
  }
});
