import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS } from "../src/engine.js";
import { makeRig } from "../src/puppet.js";
import { combatFloor } from "./helpers.js";
import { prepareProp } from "../src/props.js";
import { traceTesla, updateTesla, TESLA_LINKS } from "../src/tesla.js";
import { addWater, updateReactions } from "../src/reactions.js";
import { RenderSnapshots, blend } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { GuestPrediction } from "../src/guest-prediction.js";
import { weaponMuzzle } from "../src/weapon-mount.js";

function fixture() {
  const w = new World({ players:[0,1,2,3], shuffle:false, random:()=>.4 });
  combatFloor(w); Object.assign(w,{phase:"fight",water:[],chunks:[],gas:[],spills:[]});
  for (const [i,p] of w.players.entries()) {
    Object.assign(p,{x:400+i*500,y:535,vx:0,vy:0,ground:true,support:"floor0",aimAngle:0});
    p.rig=makeRig(p);
  }
  Object.assign(w.players[0],{weapon:"tesla",ammo:WEAPONS.tesla.ammo});
  return w;
}
const prop=(id,x,y=495,kind="crate")=>prepareProp({id,kind,x,y,w:48,h:65,hp:100,maxHp:100});

test("held Tesla drains charge, keeps one continuous field and never fires projectiles",()=>{
  const w=fixture(),p=w.players[0];
  for(let n=0;n<90;n++){
    w.step(STEP,{0:{attack:true,aim:0}});
    assert.equal(w.fields.filter(f=>f.kind==="tesla").length,1);
    assert.equal(w.projectiles.length,0);
  }
  assert.ok(p.ammo>=92&&p.ammo<=94);
  assert.ok(w.players[1].hp<75&&w.players[1].hp>40);
  const ammo=p.ammo,hp=w.players[1].hp;
  w.step(STEP,{});assert.equal(w.fields.length,0);
  for(let n=0;n<25;n++)w.step(STEP,{});
  assert.equal(p.ammo,ammo);assert.equal(w.players[1].hp,hp);
});

test("arcs chain through fighters, wooden props and water without repeat hits",()=>{
  const w=fixture(),p=w.players[0];
  w.players[1].x=620;w.players[2].x=1110;
  w.cover=[prop("bridge",775)];
  addWater(w,970,550,20);for(const q of w.water){q.y=530;q.h=20;q.grounded=true;}
  const trace=traceTesla(w,p), kinds=trace.hits.map(h=>h.node.kind);
  assert.deepEqual(kinds.slice(0,4),["player","prop","water","player"]);
  w.attack(p);
  assert.ok(w.players[1].hp<100&&w.players[2].hp<100);
  assert.equal(p.hp,100);assert.ok(w.cover[0].hp<100);
  assert.ok(w.water.some(q=>q.spark>0));
  assert.equal(new Set(trace.hits.map(h=>h.node.body)).size,trace.hits.length);
  assert.ok(trace.links.length<=TESLA_LINKS);
});

test("water conducts across a connected pool and reaches a fighter beyond one hop",()=>{
  const w=fixture();w.players[1].x=1200;
  const p=w.players[0];p.aimAngle=0;
  for(let i=0;i<14;i++)w.water.push({id:i+1,x:640+i*32,y:540,w:32,h:20,vx:0,vy:0,grounded:true,frozen:0,spark:0});
  const trace=traceTesla(w,p);
  assert.ok(trace.hits.some(h=>h.node.body===w.players[1]));
  assert.ok(trace.hits.filter(h=>h.node.kind==="water").length===1);
  w.attack(p);updateReactions(w,.05);
  assert.ok(w.water.every(q=>q.charge===1));
});

test("walls block the primary ray and later chain jumps; frozen water cannot relay",()=>{
  const w=fixture();w.players[1].x=620;w.players[2].x=800;
  w.platforms.push({id:"wall",x:710,y:400,w:30,h:165,baseX:710,baseY:400,dx:0,dy:0});
  w.attack(w.players[0]);assert.equal(w.players[2].hp,100);
  w.platforms.at(-1).x=550;
  const hp=w.players[1].hp;w.attack(w.players[0]);assert.equal(w.players[1].hp,hp);
  assert.ok(w.fields[0].links[0].ex<=550.01);
  w.water=[{id:1,x:520,y:515,w:32,h:20,frozen:2}];
  assert.ok(traceTesla(w,w.players[0]).hits.every(h=>h.node.kind!=="water"));
});

test("cast starts at the physical muzzle and tracks reversed, vertical and prone aim",()=>{
  for(const [angle,prone] of [[0,false],[Math.PI,false],[-Math.PI/2,false],[.5,true]]){
    const w=fixture(),p=w.players[0];p.aimAngle=angle;p.prone=prone;p.y=450;p.rig=makeRig(p);
    const link=traceTesla(w,p).links[0],tip=weaponMuzzle(p,46);
    assert.ok(Math.hypot(link.x-tip.x,link.y-tip.y)<.001);
  }
});

test("release, throws, death, incapacity, ammo exhaustion and round reset end the cast",()=>{
  for(const mutation of [p=>p.alive=false,p=>p.freeze=1,p=>p.knockdown=1,p=>p.stun=.1,p=>p.carryId="crate",p=>p.weapon=null]){
    const w=fixture(),p=w.players[0];w.attack(p);mutation(p);updateTesla(w,{0:{attack:true}});assert.equal(w.fields.length,0);
  }
  const w=fixture(),p=w.players[0];p.ammo=1;
  for(let i=0;i<35;i++)w.step(STEP,{0:{attack:true,aim:0}});
  assert.equal(w.projectiles.length,0);assert.equal(w.fields.length,0);assert.equal(p.weapon,null);
  p.weapon="tesla";p.ammo=5;w.attack(p);updateTesla(w,{0:{attack:true,throw:true}});assert.equal(w.fields.length,0);
  w.attack(p);w.startRound();assert.equal(w.fields.length,0);
});

test("a parry stops one pulse; continuing the cast still damages after its window",()=>{
  const w=fixture(),q=w.players[1];Object.assign(q,{block:true,blockTime:0,aimAngle:Math.PI});
  w.attack(w.players[0]);assert.equal(q.hp,100);
  w.attack(w.players[0]);assert.ok(q.hp<100);
});

test("Tesla state survives snapshots and hot join, with bounded valid links and stable identity",()=>{
  const w=fixture(),encoder=new RenderSnapshots();w.attack(w.players[0]);
  const first=encoder.make(w.snapshot());assert.ok(validSnapshot(first));
  w.players[0].aimAngle=-.2;updateTesla(w,{0:{attack:true}});
  const next=encoder.make(w.snapshot());assert.ok(validSnapshot(next));
  assert.equal(first.fields[0].netId,next.fields[0].netId);
  assert.ok(validSnapshot(structuredClone(next)));
  assert.ok(blend(first.fields[0],next.fields[0],.5).links.length);
  for(const mutate of [f=>f.links.push(...Array(8).fill(f.links[0])),f=>f.links[0].ex=NaN,
    f=>f.owner=9,f=>f.links=[],f=>f.links[0].key={},f=>f.life=6]){
    const s=structuredClone(next);mutate(s.fields[0]);assert.equal(validSnapshot(s),false);
  }
});

test("guest hold and release render immediately without mutating authority or charging water",()=>{
  const w=fixture(),encoder=new RenderSnapshots(),prediction=new GuestPrediction();
  const state={...encoder.make(w.snapshot()),inputAcks:[0,0,0,0]},original=structuredClone(state);
  prediction.receive(state,0,1000);prediction.advance({attack:true,aim:0},1,1017);
  assert.equal(prediction.sample(state,1020).fields.filter(f=>f.kind==="tesla").length,1);
  assert.deepEqual(state,original);assert.equal(w.players[1].hp,100);assert.equal(w.projectiles.length,0);
  prediction.advance({attack:false,aim:0},2,1034);
  assert.equal(prediction.sample(state,1036).fields.length,0);
  prediction.advance({attack:true,aim:0},3,1051);
  assert.equal(prediction.sample(state,1400).fields.length,0);
});

test("Easy Tesla bots cast at range with reaction delay and firing breaks",()=>{
  const w=fixture();w.botIds.add(0);w.players[0].bot=true;w.players[1].x=900;
  for(let i=0;i<18;i++)w.step(STEP);
  assert.equal(w.players[0].ammo,WEAPONS.tesla.ammo);
  let arcs=0,breaks=0,started=false;
  for(let i=0;i<240;i++){
    w.step(STEP);const on=w.fields.some(f=>f.kind==="tesla");
    if(on){arcs++;started=true;}else if(started)breaks++;
  }
  assert.ok(arcs>5);assert.ok(breaks>5);assert.equal(w.projectiles.length,0);
});

test("long prop identities remain valid and a full field budget rejects an invisible cast",()=>{
  const w=fixture();w.players[1].x=2200;
  w.cover=[prop('a'.repeat(80),620),prop('b'.repeat(80),800)];
  w.attack(w.players[0]);assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
  const p=w.players[0],ammo=p.ammo;w.fields=Array.from({length:12},(_,id)=>({kind:'blackhole',id}));
  const fields=[...w.fields],hp=w.cover[0].hp;w.attack(p);
  assert.equal(p.ammo,ammo);assert.equal(w.cover[0].hp,hp);assert.deepEqual(w.fields,fields);
});
