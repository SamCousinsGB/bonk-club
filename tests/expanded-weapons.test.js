import test from "node:test";
import assert from "node:assert/strict";
import { World, WEAPONS, STEP, cleanInput } from "../src/engine.js";
import { EXPANDED_WEAPONS } from "../src/expanded-weapons.js";
import { WeaponRotation, chooseWeapon } from "../src/arsenal.js";
import { updateFields } from "../src/specials.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { makeRig, updateRig } from "../src/puppet.js";
import { updateMelee } from "../src/melee.js";
import { combatFloor } from "./helpers.js";

function fixture(bots = []) {
  const w = new World({ players: [0, 1, 2, 3], bots, shuffle: false, random: () => .5 });
  combatFloor(w); w.phase = "fight"; w.arena = { ...w.arena, spikes: [] };
  for (const p of w.players) {
    Object.assign(p, { x: [400, 700, 900, 2100][p.id], y: 535, vx: 0, vy: 0,
      ground: true, support: "floor0", aimAngle: 0 }); p.rig = makeRig(p);
    p.rig[6].x = p.x + 20; p.rig[6].y = p.y - 10;
  }
  return w;
}
function fire(w, type) {
  Object.assign(w.players[0], { weapon: type, ammo: WEAPONS[type].ammo });
  w.attack(w.players[0]); return w.projectiles[0];
}
function shots(w, seconds) { for (let t = 0; t < seconds; t += STEP) w.updateProjectiles(STEP); }
const wire = w => new RenderSnapshots().make(w.snapshot());

test("crossbow pierces multiple fighters once each without an instant-kill effect", () => {
  const w = fixture(), b = fire(w, "crossbow"); shots(w, .4);
  assert.equal(w.players[1].hp, 42); assert.equal(w.players[2].hp, 42);
  assert.deepEqual(b.hitIds, [1, 2]); assert.equal(w.players[0].ammo, 8);
  shots(w, .1); assert.equal(w.players[1].hp, 42);
});

for (const type of Object.keys(EXPANDED_WEAPONS)) {
  test(`Easy bots use ${type} through the regular controls and spend ammunition`, () => {
    const w = fixture([0]), p = w.players[0];
    Object.assign(p, {weapon:type,ammo:WEAPONS[type].ammo});
    if (type === "cryo") { w.players[1].x=1050; w.players[2].x=1450; }
    let fired=false;
    for(let t=0;t<5 && !fired;t+=STEP) {
      w.step(STEP);
      fired=w.events.some(e=>e.type==="shoot"&&e.weapon===type) ||
        (type==="hammer"&&p.weapon===type&&p.ammo<WEAPONS[type].ammo);
    }
    assert.ok(fired, "AI must fire or swing instead of discarding the unused weapon");
    assert.ok(p.ammo<WEAPONS[type].ammo);
  });
}

test("crossbow stops on structural cover and carries through a broken glass panel", () => {
  for (const glass of [false, true]) {
    const w = fixture();
    w.platforms.push({ id: "wall", x: 560, y: 400, w: 15, h: 160,
      ...(glass ? { destructible: true, panel: "glass", hp: 40, maxHp: 40 } : {}) });
    fire(w, "crossbow"); shots(w, .4);
    assert.equal(w.players[1].hp, glass ? 42 : 100);
  }
});

test("harpoon pulls toward the current owner and physical movement carries the impulse", () => {
  const w = fixture(), q = w.players[1]; fire(w, "harpoon"); shots(w, .3);
  assert.equal(q.hp, 72); assert.ok(q.vx < -1000); assert.ok(q.vy < 0);
  assert.equal(q.ground, false); assert.equal(w.fields[0].kind, "tether");
  const x = q.x; w.move(q, cleanInput({ right: true }), STEP);
  assert.ok(q.x < x - 6, "movement cannot erase the pull");
  assert.ok(validSnapshot(wire(w)));
});

test("a harpoon cannot pull through newly intervening cover or a dead owner", () => {
  for (const dead of [false, true]) {
    const w = fixture(), q = w.players[1], b = fire(w, "harpoon");
    b.x = 650;
    if (dead) w.kill(w.players[0]);
    else w.platforms.push({ id: "wall", x: 520, y: 400, w: 20, h: 160 });
    shots(w, .1); assert.equal(q.hp, 72); assert.equal(q.vx, 0);
    assert.equal(w.fields.length, 0);
  }
});

for (const type of ["crossbow", "harpoon", "shrapnel"]) {
  test(`${type} parry reflects one projectile and transfers its ownership`, () => {
    const w = fixture(), q = w.players[1]; q.x = 620;
    Object.assign(q, { block: true, blockTime: 0, aimAngle: Math.PI });
    fire(w, type);
    for (let n = 0; n < 120 && !w.events.some(e => e.type === "parry"); n++) w.updateProjectiles(STEP);
    if (type === "shrapnel") assert.ok(q.hp < 100, "one parry cannot block a whole scatter shot");
    else assert.equal(q.hp, 100);
    assert.ok(w.projectiles.some(b => b.owner === q.id));
    assert.equal(q.freeze, 0); assert.equal(w.fields.some(f => f.kind === "tether"), false);
  });
}

test("shrapnel fans out, ricochets twice, uses one shell and propels a downward shooter", () => {
  const w = fixture(); w.players.forEach(p => { if (p.id) p.y = 100; });
  fire(w, "shrapnel"); assert.equal(w.projectiles.length, 8);
  assert.equal(new Set(w.projectiles.map(b => b.vy)).size, 8);
  assert.equal(w.players[0].ammo, 4);
  const b = w.projectiles[0]; Object.assign(b, {x: 550,y: 460,vx: 1000,vy: 0});
  w.platforms.push({id: "wall",x: 600,y: 300,w: 20,h: 260});
  shots(w, .07); assert.ok(b.vx < 0); assert.equal(b.bounces, 1);
  w.platforms.push({id: "back",x: 470,y: 300,w: 20,h: 260});
  shots(w, .12); assert.ok(b.vx > 0); assert.equal(b.bounces, 0);
  shots(w, .2); assert.ok(!w.projectiles.includes(b));
  const other = fixture(); other.players[0].aimAngle = Math.PI / 2;
  fire(other, "shrapnel"); assert.ok(other.players[0].vy < -400);
});

test("fireworks burst on impact into ten persistent damaging sparks and carve terrain once", () => {
  const w = fixture(), q = w.players[1]; q.x = 900; q.y = 495;
  const b = fire(w, "firework"); Object.assign(b, {x: 800,y: 551,vx: 0,vy: 1000});
  const before = JSON.stringify(w.platforms); shots(w, STEP);
  assert.equal(w.projectiles.length, 10); assert.ok(w.projectiles.every(b => b.kind === "spark"));
  assert.equal(w.events.filter(e => e.type === "explosion").length, 1);
  assert.notEqual(JSON.stringify(w.platforms), before);
  shots(w, .3); assert.ok(q.hp < 100, "radial sparks hit beyond the initial blast");
  shots(w, .8); updateFields(w, 1);
  assert.ok(w.projectiles.length > 0); assert.ok(w.projectiles.every(b=>b.kind === "spark"));
  assert.equal(w.fields.length, 0);
  assert.equal(w.events.filter(e => e.type === "explosion").length, 1);
});

test("cryo blast freezes exposed fighters including its owner, preserves terrain and respects cover", () => {
  const w = fixture(); w.players[0].x = 570; w.players[2].x = 780;
  w.platforms.push({id: "wall",x: 735,y: 350,w: 20,h: 210,baseX:735,baseY:350,dx:0,dy:0});
  const before = JSON.stringify(w.platforms);
  const b = fire(w, "cryo"); Object.assign(b, {x: 650,y: 520,vx: 0,vy: 0,life: STEP/2});
  shots(w, STEP);
  assert.equal(w.players[0].freeze, 1.15); assert.equal(w.players[1].freeze, 1.15);
  assert.equal(w.players[2].hp, 100); assert.equal(w.players[2].freeze, 0);
  assert.equal(JSON.stringify(w.platforms), before);
  assert.equal(w.players[1].hp, 78); assert.ok(validSnapshot(wire(w)));
  w.hit(w.players[1], w.players[0], 60, 400, 1, -.4, { projectile: true });
  assert.equal(w.players[1].alive, false); assert.equal(w.ragdolls.at(-1).effect, "ice");
  updateFields(w, 1); w.startRound(); assert.equal(w.fields.length, 0);
  assert.ok(w.players.every(p => p.freeze === 0));
});

test("cryo toss retains the controllable grenade speed and fuse and bounces before freezing", () => {
  const w = fixture(), b = fire(w, "cryo");
  assert.equal(b.vx, 450); assert.equal(b.vy, -580); assert.equal(b.life, 2.8);
  Object.assign(b, {x: 800, y: 540, vx: 30, vy: 300}); shots(w, .1);
  assert.ok(b.vy < 0); assert.ok(b.life > 2.6); assert.equal(w.fields.length, 0);
});

test("sledgehammer has a visible wind-up, one heavy hit and a complete final swing", () => {
  const w = fixture(), p = w.players[0], q = w.players[1];
  Object.assign(p, {weapon:"hammer",ammo:1,ground:false,airLunge:true});
  q.x = p.x + 65; q.y = p.y - 30;
  for (let n = 0; n < 60; n++) updateRig(p, STEP, [], 0);
  w.attack(p); assert.equal(p.weapon, "hammer"); assert.equal(p.ammo, 0);
  const advance = seconds => { for (let t = 0; t < seconds; t += STEP) {
    p.swing = Math.max(0, p.swing - STEP); updateRig(p, STEP, [], t); updateMelee(w, p);
  }};
  advance(.1); assert.equal(q.hp, 100);
  advance(.5); assert.equal(q.hp, 32); assert.ok(q.vx > 1200); assert.ok(q.stun >= .65);
  advance(.3); assert.equal(q.hp, 32);
  w.move(p, cleanInput({}), STEP); assert.equal(p.weapon, null);
});

test("all six weapons spawn, preserve ammo when thrown, and round-reset with valid interpolated state", () => {
  const rotation = new WeaponRotation(() => .5);
  const bag = new Set(Array.from({length: Object.keys(WEAPONS).length}, () => rotation.next()));
  for (const [type, definition] of Object.entries(EXPANDED_WEAPONS)) {
    assert.ok(chooseWeapon(() => .8, new Set(Object.keys(WEAPONS).filter(k => k !== type))) === type);
    if (definition.rarity === "rare") assert.ok(bag.has(type));
    const w = fixture(); fire(w, type);
    const a = wire(w); shots(w, .02); const b = wire(w);
    assert.ok(validSnapshot(JSON.parse(JSON.stringify(b))), type);
    assert.ok(validSnapshot(interpolateStates(a, b, .5)), type);
    const ammo = w.players[0].ammo; w.throwWeapon(w.players[0]);
    assert.equal(w.drops.at(-1).ammo, ammo);
    w.startRound(); assert.equal(w.projectiles.length, 0); assert.equal(w.fields.length, 0);
  }
});

test("new projectile and field validation rejects mismatched weapons and malformed state", () => {
  for (const type of ["crossbow", "harpoon", "shrapnel", "firework", "cryo"]) {
    const w = fixture(); fire(w, type); const state = wire(w);
    for (const mutate of [b => b.weapon = "blaster", b => b.owner = 4, b => b.r = 80,
      b => b.life = 100, b => b.hitIds = [0,0], b => b.vx = Infinity]) {
      const bad = structuredClone(state); mutate(bad.projectiles[0]);
      // Existing kinds cannot infer a foreign weapon's provenance; new kinds can.
      if (bad.projectiles[0].weapon === "blaster" && !["crossbow", "harpoon"].includes(type)) continue;
      assert.equal(validSnapshot(bad), false, type);
    }
  }
  const w = fixture(); const b = fire(w, "cryo"); Object.assign(b,{life:0}); w.explode(b);
  const state = wire(w); state.projectiles = [];
  for (const patch of [{radius:400}, {life:2}, {owner:-1}, {ex:NaN}]) {
    const bad = structuredClone(state); Object.assign(bad.fields[0],patch);
    assert.equal(validSnapshot(bad),false);
  }
});
