import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput, WEAPONS } from "../src/engine.js";
import { PARRY, NUCLEAR } from "../src/impact.js";
import { combatFloor } from "./helpers.js";
import { validSnapshot } from "../src/network.js";
import { RenderSnapshots } from "../src/render-state.js";

function fight() {
  const w = new World({players:[0,1],shuffle:false});
  combatFloor(w);w.phase="fight";
  Object.assign(w.players[0],{x:700,y:535,ground:true,aimAngle:0});
  Object.assign(w.players[1],{x:1900,y:535,ground:true,aimAngle:Math.PI});
  return w;
}
test("holding parry activates once; missing or connecting requires release and cooldown",()=>{
  const w=fight(),p=w.players[0];let activations=0,old=false;
  for(let i=0;i<240;i++){
    w.move(p,cleanInput({block:true}),STEP);
    if(p.block&&!old)activations++;old=p.block;
  }
  assert.equal(activations,1);assert.equal(p.block,false);assert.equal(p.parryCooldown,0);
  w.move(p,cleanInput({}),STEP);w.move(p,cleanInput({block:true}),STEP);
  assert.equal(p.block,true);assert.ok(p.parryCooldown>PARRY.cooldown-.02);
  w.move(p,cleanInput({}),STEP);w.move(p,cleanInput({block:true}),STEP);
  assert.ok(p.blockTime>0,"pressing during recovery does not start a new window");
});

test("a single parry reflects only one bullet in a burst and explosions cannot be parried",()=>{
  const w=fight(),p=w.players[0];
  w.move(p,cleanInput({block:true,aim:0}),STEP);
  w.projectiles=Array.from({length:2},()=>({x:p.x+19,y:p.y-10,vx:-500,vy:0,owner:1,kind:"bullet",damage:17,force:100,life:2,r:4,hitIds:[]}));
  w.updateProjectiles(STEP);
  assert.equal(w.projectiles.filter(b=>b.owner===0).length,1);
  assert.equal(p.hp,83);assert.equal(p.block,false);assert.ok(p.parryCooldown>0.6);
  p.block=true;p.blockTime=0;
  w.explode({x:p.x+50,y:p.y,damage:30,force:500});
  assert.ok(p.hp<83);assert.equal(p.block,false);
});

test("melee carries a stationary fighter forward in either direction without a movement key",()=>{
  for(const direction of [-1,1]){
    const w=fight(),p=w.players[0],from=p.x;
    p.aimAngle=direction>0?0:Math.PI;
    w.attack(p);
    for(let i=0;i<24;i++)w.move(p,cleanInput({aim:p.aimAngle}),STEP);
    assert.ok((p.x-from)*direction>45,`${direction}: ${p.x-from}`);
  }
});

test("grounded and prone fighters retain blast and horizontal shot knockback",()=>{
  for(const prone of [false,true])for(const blast of [false,true]){
    const w=fight(),p=w.players[0];p.prone=prone;p.y=prone?555:535;
    if(blast)w.explode({x:p.x-90,y:p.y-5,damage:30,force:1000,radius:200});
    else w.hit(p,{x:p.x-20,y:p.y},10,450,1,0,{projectile:true});
    const from=p.x;
    for(let i=0;i<24;i++)w.move(p,cleanInput({duck:prone,left:true}),STEP);
    assert.ok(p.x>from+55,`prone=${prone} blast=${blast}: ${p.x-from}`);
  }
});

test("downward minigun fire can sustain upward travel while deployed fire remains braced",()=>{
  const w=fight(),p=w.players[0];p.weapon="minigun";p.ammo=80;
  for(let i=0;i<120;i++)w.step(STEP,{0:{attack:true,aim:Math.PI/2}});
  assert.ok(p.y<400,`height ${p.y}`);assert.ok(p.vy<0);
  assert.ok(Math.abs(p.vy)<1200,"automatic recoil remains bounded");
  Object.assign(p,{weapon:"machinegun",ammo:100,ground:true,prone:true,y:555,vx:0,vy:0,aimAngle:Math.PI/2});
  w.attack(p);assert.equal(p.vy,0);
});

test("nuclear pressure crosses the map, collapses panels and completes before scoring",()=>{
  const w=fight(),p=w.players[0],q=w.players[1];
  Object.assign(p,{weapon:"nuke",ammo:1});
  w.attack(p);
  Object.assign(w.projectiles[0],{x:700,y:510,vx:0,vy:0,life:.001});
  w.platforms.push({id:"fragile",x:2050,y:360,w:150,h:20,baseX:2050,baseY:360,dx:0,dy:0,destructible:true,panel:"wood",hp:100,maxHp:100});
  w.updateProjectiles(STEP);
  assert.equal(p.alive,false);
  assert.equal(w.fields[0].radius,NUCLEAR.waveRadius);
  assert.equal(w.fields[0].strikes.length,6);
  const wire=new RenderSnapshots();
  for(let i=0;i<480;i++){
    w.step(STEP);
    if(i%30===0)assert.ok(validSnapshot(wire.make(w.snapshot())));
    assert.deepEqual(w.scores,[0,0,0,0],"no premature winner during the firestorm");
  }
  assert.equal(w.platforms.find(s=>s.id==="fragile").hp,0);
  assert.ok(q.hp<100);
  assert.equal(w.fields[0].nextStrike,6);
  for(let i=0;i<180;i++)w.step(STEP);
  assert.equal(w.phase,"result");assert.equal(w.fields.length,0);
});

test("large core destruction retains its nuclear sound/impact event and normal walls stay structural",()=>{
  const w=fight();
  for(let i=0;i<40;i++)w.cover.push({id:`crate${i}`,x:400+i*10,y:490,w:20,h:35,hp:10,maxHp:10,kind:"crate"});
  w.explode({x:700,y:500,damage:WEAPONS.nuke.damage,force:WEAPONS.nuke.force,radius:NUCLEAR.coreRadius,nuclear:true});
  assert.equal(w.events.at(-1).nuclear,true);
  assert.ok(w.platforms.every(p=>p.hp!==0));
  assert.ok(w.debris.length<=90);
});
