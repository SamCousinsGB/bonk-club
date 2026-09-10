import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { PARRY } from "../src/impact.js";
import { combatFloor } from "./helpers.js";

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
