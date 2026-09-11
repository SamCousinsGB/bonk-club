import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateHazards } from "../src/hazards.js";
import { releaseCargo, CARGO_LIMIT } from "../src/cargo.js";
import { survivalControls } from "../src/survival-ai.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { carveExplosion } from "../src/terrain.js";
const modes = ["cargo", "press", "sweep"];
function world(kind, bots = []) {
  return new World({arena:ARENAS.findIndex(a=>a.survival?.kind===kind),players:[0,1,2,3],bots,shuffle:false,random:()=>.45});
}
function advance(w, seconds, input = {}) { for(let n=0;n<seconds/STEP;n++)w.step(STEP,input); }
function machinery(w, seconds) { for(let n=0;n<seconds/STEP;n++){w.time+=STEP;updateHazards(w,STEP);} }

test("survival arenas start equally unarmed on clear floors and keep weapons scarce",()=>{
  for(const kind of modes){
    const w=world(kind);assert.equal(w.drops.length,0);assert.equal(w.cover.length,0);
    advance(w,2.5);assert.ok(w.players.every(p=>p.hp===100&&p.ground),kind);
    assert.equal(w.drops.length,0);assert.ok(w.weaponTimer>11);
    w.players.forEach((p,i)=>p.x=150+i*45);w.spawnWeapon();assert.equal(w.drops.length,1,kind);
    for(let n=0;n<10;n++)w.spawnWeapon();assert.equal(w.drops.length,1);
    w.players[0].weapon=w.drops[0].type;w.drops=[];w.spawnWeapon();assert.equal(w.drops.length,0);
    assert.ok(validSnapshot(w.snapshot()),kind);
  }
});

test("the cargo outlet warns, releases weighted boxes from the right and respects backed-up cargo",()=>{
  const w=world("cargo");w.phase="fight";machinery(w,4);
  const outlet=w.hazards.find(h=>h.type==="loader");assert.ok(outlet.warning>0);assert.equal(w.cover.length,0);
  machinery(w,.6);assert.equal(w.cover.length,1);const b=w.cover[0];
  assert.ok(b.x>2200&&b.vx<0&&b.mass>0);
  assert.equal(releaseCargo(w,outlet),false);
  const x=b.x;advance(w,1);assert.ok(b.x<x-150);
  const oldId=b.id;w.damageCover(b,999);assert.ok(w.chunks.length>=8);
  releaseCargo(w,outlet);assert.ok(w.cover.every(c=>c.id!==oldId));assert.ok(w.chunks.length>=8);
});

test("cargo admission is bounded without deleting living boxes or persistent fragments",()=>{
  const w=world("cargo"),h=w.hazards.at(-1);
  for(let n=0;n<CARGO_LIMIT;n++){assert.ok(releaseCargo(w,h));w.cover.at(-1).x=120+n*110;}
  const ids=w.cover.map(b=>b.id);assert.equal(releaseCargo(w,h),false);assert.deepEqual(w.cover.map(b=>b.id),ids);
  assert.ok(validSnapshot(w.snapshot()));
});

test("belt drift is counterable with normal running controls",()=>{
  const idle=world("cargo"),run=world("cargo");
  for(const w of [idle,run]){w.phase="fight";w.hazards=w.hazards.filter(h=>h.type==="conveyor");w.players=w.players.slice(0,2);w.players[1].x=2200;}
  advance(idle,2);advance(run,2,{0:{right:true}});
  assert.ok(idle.players[0].x<480);assert.ok(run.players[0].x>650);
});

test("presses alternate warned lanes, kill on contact and leave safe gaps",()=>{
  const w=world("press");w.phase="fight";
  Object.assign(w.players[0],{x:430,y:1090,ground:true});
  Object.assign(w.players[1],{x:600,y:1090,ground:true});
  machinery(w,3.3);assert.ok(w.hazards[0].warning>1);assert.equal(w.players[0].hp,100);
  machinery(w,1.5);assert.equal(w.players[0].alive,false);assert.equal(w.players[1].hp,100);
  assert.ok(w.hazards[0].active&&!w.hazards[1].active);
  machinery(w,3.2);assert.ok(!w.hazards[0].active&&w.hazards[1].active);
});

test("a bot uses normal movement to escape a warned press without jumping into it",()=>{
  const w=world("press");w.phase="fight";w.players=w.players.slice(0,2);
  const p=w.players[0];Object.assign(p,{x:430,y:1090,ground:true});w.players[1].x=2300;
  machinery(w,3.15);const b={};let jumped=false;
  for(let n=0;n<180;n++){
    const i=cleanInput({});survivalControls(w,p,b,i,w.solids());jumped ||= i.jump;
    w.move(p,i,STEP);w.time+=STEP;updateHazards(w,STEP);
  }
  assert.equal(p.hp,100);assert.ok(Math.abs(p.x-430)>140);assert.equal(jumped,false);
});

test("a bot in a safe press gap does not lunge back into the warned lane",()=>{
  const w=world("press");w.phase="fight";machinery(w,3.2);
  const p=w.players[0];Object.assign(p,{x:276,y:1090,vx:0,ground:true,weapon:null});
  const input=cleanInput({attack:true,aim:0});survivalControls(w,p,{},input,w.solids());
  assert.equal(input.attack,false);assert.equal(input.right,false);
});

test("facing bots on the same side of a press choose the same nearest exit",()=>{
  const w=world("press");w.phase="fight";machinery(w,3.2);
  for(const [id,x,aim] of [[0,363,0],[1,393,Math.PI]]){
    const p=w.players[id];Object.assign(p,{x,y:1090,vx:0,ground:true,weapon:null});
    const input=cleanInput({attack:true,aim});survivalControls(w,p,{},input,w.solids());
    assert.equal(input.left,true);assert.equal(input.right,false);assert.equal(input.attack,false);
  }
});

test("a wide press hits only when its visible plate reaches the fighter",()=>{
  const w=world("press");w.phase="fight";w.hazards=w.hazards.slice(0,1);
  const p=w.players[0];Object.assign(p,{x:430,y:1090,ground:true});
  Object.assign(w.hazards[0],{age:4.5,active:true,bodyY:1000});
  machinery(w,STEP);assert.equal(p.hp,100);
  machinery(w,.08);assert.equal(p.alive,false);
});

test("bot cargo dodge clears a moving box with real jump physics",()=>{
  const w=world("cargo");w.phase="fight";w.players=w.players.slice(0,2);
  const p=w.players[0];Object.assign(p,{x:1200,y:1050,ground:true});w.players[1].x=200;
  releaseCargo(w,w.hazards.at(-1));const cargo=w.cover[0];cargo.x=1450;cargo.y=1080-cargo.h;
  w.hazards=w.hazards.filter(h=>h.type==="conveyor");const b={};let jumped=false;
  for(let n=0;n<160;n++){
    const i=cleanInput({});survivalControls(w,p,b,i,w.solids());jumped ||= i.jump;
    w.time+=STEP;w.updateCover(STEP);w.move(p,i,STEP);updateHazards(w,STEP);
  }
  assert.ok(jumped);assert.equal(p.hp,100);assert.ok(p.x>cargo.x+cargo.w);
});

test("new machinery, cargo, fragments and destruction survive hot-join snapshots and reset",()=>{
  for(const kind of modes){
    const w=world(kind);w.phase="fight";
    if(kind==="cargo"){releaseCargo(w,w.hazards.at(-1));w.damageCover(w.cover[0],999);releaseCargo(w,w.hazards.at(-1));}
    carveExplosion(w,{x:1280,y:w.platforms[0].y,radius:150});machinery(w,5);
    const snapshot=JSON.parse(JSON.stringify(w.snapshot()));assert.ok(validSnapshot(snapshot),kind);
    const guest=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(snapshot))),validSnapshot);
    for(const field of ["platforms","cover","chunks","hazards"])assert.deepEqual(guest[field],snapshot[field]);
    w.startRound();assert.equal(w.chunks.length,0);assert.equal(w.cover.length,0);assert.equal(w.cargoSerial,0);
    assert.equal(w.platforms.length,1);assert.ok(w.hazards.every(h=>!h.done));
  }
});

test("bots time ordinary jumps over repeated saw passes on real ice",()=>{
  for(const x of [460,900,1580,2050]){
    const w=world("sweep");w.phase="fight";w.players=w.players.slice(0,1);
    const p=w.players[0];Object.assign(p,{x,y:1090,ground:true});const b={};let jumps=0;
    for(let n=0;n<120*24&&p.alive;n++){
      const input=cleanInput({});survivalControls(w,p,b,input,w.solids());jumps+=input.jump;
      w.time+=STEP;w.move(p,input,STEP);updateHazards(w,STEP);
    }
    assert.ok(jumps>=3,`${x}: ${jumps} jumps`);assert.equal(p.hp,100,`${x}: must clear successive passes`);
  }
});

test("destroying the loader mount stops future cargo and invalid motion settings are rejected",()=>{
  const w=world("cargo");w.phase="fight";carveExplosion(w,{x:2390,y:1080,radius:170});machinery(w,20);
  assert.ok(!w.hazards.some(h=>h.type==="loader"&&!h.done));assert.equal(w.cover.length,0);
  for(const [kind,patch] of [["cargo",{beltSpeed:Infinity}],["cargo",{beltForce:-1}],["sweep",{motionSpeed:999}],["sweep",{motionPhase:NaN}],["sweep",{w:9999}]]){
    const s=world(kind).snapshot();Object.assign(s.hazards[0],patch);assert.equal(validSnapshot(s),false);
  }
});
