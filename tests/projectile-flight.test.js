import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS } from "../src/engine.js";
import { RenderSnapshots } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { MAX_PROJECTILES } from "../src/projectile-flight.js";

function empty() {
  const w=new World({players:[0,1],shuffle:false,random:()=>.5});w.platforms=[];w.cover=[];w.chunks=[];w.hazards=[];w.drops=[];
  w.arena={...w.arena,spikes:[]};w.players.forEach(p=>{p.x=500;p.y=500;p.ground=true;p.prone=true;});return w;
}
test("every airborne weapon retains its projectile beyond its old timeout and outside the map",()=>{
  for(const [type,definition] of Object.entries(WEAPONS)) {
    if(["melee","grenade","phaser"].includes(definition.kind))continue;
    const w=empty(),p=w.players[0];p.weapon=type;p.ammo=definition.ammo;p.aimAngle=0;
    w.attack(p);const b=w.projectiles[0];assert.ok(b,type);
    // No owner to catch the boomerang and no target for homing shots.
    w.players.forEach(p=>p.alive=false);
    for(let t=0;t<12;t+=STEP)w.updateProjectiles(STEP);
    assert.ok(w.projectiles.includes(b),type);assert.ok(b.age>11.9,type);assert.ok(b.life>0,type);
    assert.ok(b.x>3000||b.y>1600,type);assert.equal(w.fields.length,0,type);
    assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())),type);
    w.startRound();assert.equal(w.projectiles.length,0);
  }
});
test("flame, repulsor, yarn and fireworks cross an arena and still hit instead of expiring",()=>{
  for(const type of ["flame","repulsor","tangle","firework","blackhole","crossbow"]) {
    const w=empty(),p=w.players[0],q=w.players[1];q.x=2350;q.y=500;
    p.weapon=type;p.ammo=WEAPONS[type].ammo;p.aimAngle=0;w.attack(p);
    for(let t=0;t<4;t+=STEP)w.updateProjectiles(STEP);
    assert.ok(q.hp<100||w.fields.some(f=>f.kind==="blackhole"),type);
  }
});
test("capacity rejects a new shot without spending ammo or deleting an existing shot",()=>{
  const w=empty(),p=w.players[0];p.weapon="blaster";p.ammo=14;p.aimAngle=0;w.attack(p);
  const first=w.projectiles[0];w.projectiles=Array.from({length:MAX_PROJECTILES},()=>({...first}));
  const refs=[...w.projectiles],ammo=p.ammo;w.attack(p);
  assert.equal(p.ammo,ammo);assert.deepEqual(w.projectiles,refs);
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
  w.players[1].y=1000;
  w.updateProjectiles(STEP);assert.equal(w.projectiles.length,MAX_PROJECTILES);
});
test("grenade fuses still detonate while far outside the previous boundary",()=>{
  const w=empty(),p=w.players[0];p.weapon="grenade";p.ammo=4;p.aimAngle=0;w.attack(p);
  const b=w.projectiles[0];b.x=2800;b.y=1800;w.updateProjectiles(STEP);
  assert.ok(w.projectiles.includes(b));assert.equal(w.events.filter(e=>e.type==="explosion").length,0);
  for(let t=0;t<3;t+=STEP)w.updateProjectiles(STEP);
  assert.equal(w.projectiles.length,0);assert.equal(w.events.filter(e=>e.type==="explosion").length,1);
});
