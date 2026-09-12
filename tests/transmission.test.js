import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateHazards } from "../src/hazards.js";
import { intactPowerline, wirePieces } from "../src/powerlines.js";
import { carveExplosion } from "../src/terrain.js";
import { nuclearField, updateNuclear } from "../src/nuclear.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { interpolateStates } from "../src/render-state.js";

function arena() {
  const w=new World({arena:ARENAS.findIndex(a=>a.transmission),shuffle:false,players:[0,1,2,3],random:()=>.4});
  w.phase="fight";w.botIds.clear();w.weaponTimer=999;
  w.cover=[];w.chunks=[];w.water=[];w.spills=[];w.gas=[];w.drops=[];
  return w;
}
const advance=(w,seconds)=>{for(let i=0;i<Math.round(seconds/STEP);i++)updateHazards(w,STEP);};
test("two wire circuits start safe and switch together every seven seconds with a safe warning",()=>{
  const w=arena();assert.equal(w.hazards.length,2);
  assert.ok(w.hazards.every(h=>intactPowerline(w,h)));
  advance(w,6);assert.ok(w.hazards.every(h=>!h.active&&h.warning>0));
  advance(w,1);assert.ok(w.hazards.every(h=>h.active&&h.warning===0));
  advance(w,6.9);assert.ok(w.hazards.every(h=>h.active));
  advance(w,.1);assert.ok(w.hazards.every(h=>!h.active));
  advance(w,7);assert.ok(w.hazards.every(h=>h.active));
});
for(const direction of [-1,1])test(`a fighter crosses the maintenance walkway in both directions (${direction})`,()=>{
  const w=arena(),p=w.players[0],h=w.hazards[0];
  Object.assign(p,{x:direction>0?800:1760,y:410,vx:0,vy:0,ground:true,rig:null});
  for(let i=0;i<5.2/STEP;i++) {
    w.move(p,cleanInput({left:direction<0,right:direction>0}),STEP);
    updateHazards(w,STEP);
  }
  assert.ok(direction>0?p.x>1780:p.x<780,`${p.x},${p.y}`);
  assert.equal(p.hp,100);assert.ok(p.y<480);assert.equal(h.active,false);
});
test("live contact shocks only the actual wire, with bounded repeat hits and electrical deaths",()=>{
  const w=arena(),h=w.hazards[0],p=w.players[0],q=w.players[1];
  const point = w.cables[0].points[12];
  h.age=7;Object.assign(p,{x:point.x,y:point.y-20,hp:100});Object.assign(q,{x:1280,y:410,hp:100});
  updateHazards(w,STEP);assert.equal(p.hp,30);assert.equal(q.hp,100);
  advance(w,.4);assert.equal(p.hp,30);
  advance(w,.5);assert.equal(p.alive,false);assert.equal(w.ragdolls[0].effect,"tesla");
});
test("prediction never applies wire damage and countdown/results do not advance circuits",()=>{
  const w=arena(),h=w.hazards[0],p=w.players[0];w.prediction=true;
  h.age=7;Object.assign(p,{x:w.cables[0].points[12].x,y:w.cables[0].points[12].y-20});advance(w,.1);assert.equal(p.hp,100);
  for(const phase of ["countdown","result"]){w.phase=phase;const age=h.age;advance(w,20);assert.equal(h.age,age);}
});
test("explosions sever a circuit permanently, retain the surviving background wire and reset next round",()=>{
  const w=arena(),h=w.hazards[0];advance(w,7);
  const point = w.cables[0].points[9];
  carveExplosion(w,{x:point.x,y:point.y,radius:65});updateHazards(w,STEP);
  assert.ok(h.done&&!h.active);assert.ok(wirePieces(w,h).length>0);
  assert.ok(w.hazards[1].active);advance(w,30);assert.ok(h.done&&!h.active);
  assert.ok(validSnapshot(w.snapshot()));w.startRound();
  assert.ok(w.hazards.every(h=>!h.done&&!h.active&&intactPowerline(w,h)));
});
test("nukes consume affected tower/wire terrain and disable the cut circuit",()=>{
  const w=arena(),h=w.hazards[0],before=w.platforms.length;advance(w,7);
  const f=nuclearField(w,{x:790,y:450,owner:0});
  for(let i=0;i<120;i++){w.time+=STEP;updateNuclear(w,f,STEP);updateHazards(w,STEP);}
  assert.ok(h.done||!w.hazards.includes(h));
  assert.ok(w.platforms.length!==before);assert.ok(!w.platforms.some(p=>p.x<900&&p.x+p.w>700&&p.y===440));
  assert.ok(w.platforms.some(p=>p.x>1600&&p.y===440));assert.ok(validSnapshot(w.snapshot()));
});
test("hot join and interpolation retain circuit timing and destroyed wire geometry; malformed fields reject",()=>{
  const w=arena();advance(w,7);const point=w.cables[0].points[9];carveExplosion(w,{x:point.x,y:point.y,radius:65});updateHazards(w,STEP);
  const state=JSON.parse(JSON.stringify(w.snapshot()));
  assert.ok(validSnapshot(state));
  const received=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(state))),validSnapshot);
  assert.deepEqual(received.platforms,state.platforms);assert.deepEqual(received.hazards,state.hazards);
  const next=structuredClone(state);next.time+=.1;
  const view=interpolateStates(received,next,.5);
  assert.equal(view.hazards[0].done,true);assert.equal(view.hazards[1].active,true);
  for(const patch of [{circuit:2},{circuit:"0"},{w:1101},{duration:7.1},{active:"yes"}]) {
    const s=structuredClone(state);Object.assign(s.hazards[0],patch);assert.equal(validSnapshot(s),false);
  }
  const s=structuredClone(state);s.cables[0].id="tower9";assert.equal(validSnapshot(s),false);
});
