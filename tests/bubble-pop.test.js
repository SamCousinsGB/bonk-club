import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { makeRig } from "../src/puppet.js";
import { impactSpecial } from "../src/specials.js";
import { liftBubble, popBubble, BUBBLE_TIME, BUBBLE_POP_DAMAGE } from "../src/weird-weapons.js";
import { deathJoints } from "../src/death-effects.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { blackholeField, updateBlackhole } from "../src/blackhole.js";
import { killCredit } from "../src/kill-credit.js";
import { combatFloor } from "./helpers.js";

function fixture() {
  const w = new World({ players: [0,1,2,3], shuffle: false, random: () => .5 });
  combatFloor(w); w.phase = "fight"; w.cover = []; w.hazards = []; w.drops = [];
  w.arena = { ...w.arena, spikes: [] }; w.weaponTimer = 999;
  w.players.forEach((p, i) => {
    Object.assign(p, { x: 500 + i * 450, y: 400, vx: 0, vy: 0, ground: false });
    p.rig = makeRig(p);
  });
  return w;
}
const lift = (w, p = w.players[1], owner = 0) => liftBubble(w, p, { kind: "bubble", owner });
const pops = w => w.events.filter(e => e.type === "hit" && e.effect === "bubble");

test("a real bubble shot deals contact damage, then exactly one timed pressure hit", () => {
  const w = fixture(), p = w.players[0], q = w.players[1];
  Object.assign(p, { weapon: "bubble", ammo: 8, aimAngle: 0 }); w.attack(p);
  for (let n = 0; n < 180 && !q.bubble; n++) w.updateProjectiles(STEP);
  assert.equal(q.bubble, BUBBLE_TIME); assert.equal(q.hp, 86);
  w.move(q, cleanInput({}), BUBBLE_TIME - STEP);
  assert.equal(q.hp, 86);
  w.move(q, cleanInput({}), STEP * 2);
  assert.equal(q.hp, 86 - BUBBLE_POP_DAMAGE); assert.equal(q.bubble, 0);
  assert.equal(pops(w).length, 1);
  popBubble(w, q); w.move(q, cleanInput({}), STEP);
  assert.equal(q.hp, 54); assert.equal(pops(w).length, 1);
});

test("small hits and repeat bubbles retain the timer; heavy hits add one pop", () => {
  const w = fixture(), q = w.players[1]; lift(w);
  w.move(q, cleanInput({}), .2); const time = q.bubble;
  lift(w, q, 2); assert.equal(q.bubble, time);
  w.hit(q, w.players[2], 12, 0, 1, 0, { projectile: true });
  assert.equal(q.bubble, time); assert.equal(pops(w).length, 0);
  w.hit(q, w.players[2], 24, 80, 1, 0, { projectile: true });
  assert.equal(q.hp, 32); assert.equal(q.bubble, 0); assert.equal(pops(w).length, 1);
});

test("a lethal pop scatters six parts, records bubble cause and credits the original occupant", () => {
  const w = fixture(), q = w.players[1], occupant = w.occupants[0];
  lift(w); lift(w, q, 2); w.occupants[0]++;
  let credit; w.onKill = ({ source }) => credit = killCredit(w, source);
  q.hp = BUBBLE_POP_DAMAGE + 24; q.weapon = "blaster"; q.ammo = 6;
  w.hit(q, w.players[2], 24, 80, 1, 0, { projectile: true });
  assert.equal(q.alive, false); assert.equal(q.hp, 0); assert.equal(q.bubble, 0);
  assert.equal(w.lastDeathCause, "bubble"); assert.deepEqual(credit, { id:0, occupant });
  const rag = w.ragdolls[0]; assert.equal(rag.effect, "bubble");
  assert.equal(deathJoints(rag).length, 5); assert.equal(rag.points.length, 11);
  assert.equal(w.drops[0].type, "blaster"); assert.equal(w.blood.length, 28);
  const before = structuredClone(rag.points);
  for (let n = 0; n < 24; n++) w.updateRagdolls(STEP);
  assert.ok(rag.points[0].y < before[0].y - 40);
  assert.ok(rag.points[3].x < before[3].x - 30);
  assert.ok(rag.points[5].x > before[5].x + 30);
  for (const [a,b,len] of deathJoints(rag))
    assert.ok(Math.abs(Math.hypot(rag.points[a].x-rag.points[b].x,rag.points[a].y-rag.points[b].y)-len)<1);
  assert.equal(w.events.filter(e=>e.type === "ko").length, 1);
});

test("a lethal triggering weapon keeps its own death effect and never double-kills", () => {
  const w = fixture(), q = w.players[1]; lift(w); q.hp = 20;
  w.hit(q, w.players[2], 30, 80, 1, 0, { effect: "gib", projectile: true });
  assert.equal(w.ragdolls.length, 1); assert.equal(w.ragdolls[0].effect, "gib");
  assert.equal(q.bubble, 0); assert.equal(pops(w).length, 0);
});

test("expiry during knockdown kills immediately and bypasses parry and frozen-hit modifiers", () => {
  for (const status of [{knockdown:1}, {block:true,blockTime:0}, {freeze:1}]) {
    const w = fixture(), q = w.players[1]; lift(w);
    Object.assign(q, status, {hp:32,bubble:STEP/2});
    w.move(q, cleanInput({}), STEP);
    assert.equal(q.alive,false); assert.equal(w.ragdolls[0].effect,"bubble");
    assert.equal(pops(w)[0].damage,32);
  }
});

test("transformation and black-hole capture burst an active bubble once", () => {
  for (const hp of [100, 32]) {
    const w = fixture(), q = w.players[1]; lift(w); q.hp = hp;
    impactSpecial(w, {kind:"jelly",weapon:"jelly",owner:2}, q, true);
    assert.equal(q.hp,hp-32); assert.equal(q.bubble,0);
    assert.equal(q.alive,hp>32); assert.equal(pops(w).length,1);
    if (!q.alive) assert.equal(w.ragdolls[0].effect,"bubble");
    const b = fixture(), p = b.players[1]; lift(b); p.hp = hp;
    const f = blackholeField(b,{x:p.x+100,y:p.y,owner:2}); b.fields=[f]; f.age=.5;
    updateBlackhole(b,f,STEP);
    assert.equal(p.hp,hp-32); assert.equal(p.bubble,0); assert.equal(pops(b).length,1);
    assert.equal(p.alive,hp>32);
    assert.equal(!!p.capturedBy,hp>32);
  }
});

test("guest movement expiry cannot apply damage, deaths or pop events", () => {
  const w = fixture(), q = w.players[1]; lift(w); q.hp = 1; q.bubble = STEP/2; w.prediction = true;
  w.move(q, cleanInput({}), STEP);
  assert.equal(q.hp,1); assert.equal(q.alive,true); assert.equal(pops(w).length,0);
});

test("the round waits for the last fighter's bubble and records a draw if it kills them", () => {
  for (const hp of [32, 100]) {
    const w=fixture(), p=w.players[0]; lift(w,p,1); p.hp=hp;
    for (const q of w.players.slice(1)) w.kill(q);
    w.step(STEP, new Map());
    assert.equal(w.phase,"fight"); assert.deepEqual(w.scores,[0,0,0,0]);
    p.bubble=STEP/2; w.hitstop=0; w.step(STEP,new Map());
    assert.equal(w.phase,"result"); assert.equal(w.winner,hp===32?null:0);
    assert.equal(w.scores[0],hp===32?0:1);
  }
});

test("scattered remains collide, interpolate and hot join, reject invalid wire data and reset", () => {
  const w = fixture(), q = w.players[1]; q.x=500; q.vx=650; q.rig=makeRig(q); q.hp=32;
  lift(w); popBubble(w,q);
  w.platforms=[{id:"floor",x:0,y:600,w:1800,h:10,baseX:0,baseY:600,dx:0,dy:0},
    {id:"wall",x:650,y:0,w:10,h:900,baseX:650,baseY:0,dx:0,dy:0}];
  const snapshots = new RenderSnapshots(), a = snapshots.make(w.snapshot());
  for (let n=0;n<180;n++) { w.time+=STEP; w.updateRagdolls(STEP); }
  const rag=w.ragdolls[0]; assert.ok(rag.points.every(p=>p.x<=647.01&&p.y<=597.01));
  assert.ok(rag.points.some(p=>p.y>580));
  const b=snapshots.make(w.snapshot()), hot=JSON.parse(JSON.stringify(b));
  assert.equal(hot.ragdolls[0].netId,a.ragdolls[0].netId);
  assert.ok(validSnapshot(hot)); assert.ok(validSnapshot(interpolateStates(a,b,.5)));
  for (const mutate of [s=>s.ragdolls[0].effect="fake-pop",s=>s.ragdolls[0].points.pop(),
    s=>s.ragdolls[0].points[0].x=NaN,s=>s.ragdolls[0].deathAge=99]) {
    const bad=structuredClone(hot); mutate(bad); assert.equal(validSnapshot(bad),false);
  }
  w.startRound(); assert.equal(w.ragdolls.length,0); assert.equal(w.blood.length,0);
  assert.ok(w.players.every(p=>p.bubble===0));
});
