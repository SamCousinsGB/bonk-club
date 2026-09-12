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
import { updateCables } from "../src/heavy-cables.js";
import { TOWER_LEVELS } from "../src/cable-layout.js";

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
for(const circuit of [0,1])for(const direction of [-1,1])test(`a fighter walks wire ${circuit} and jumps onto the far cross-arm (${direction})`,()=>{
  const w=arena(),p=w.players[0],h=w.hazards[circuit],y=TOWER_LEVELS[circuit];
  Object.assign(p,{x:direction>0?930:1630,y:y-30,vx:0,vy:0,ground:true,rig:null});
  let jumped=false,wireSteps=0;
  for(let i=0;i<3.2/STEP;i++) {
    w.time+=STEP;updateCables(w,STEP);
    const jump=!jumped&&(direction>0?p.x>1500:p.x<1060);if(jump)jumped=true;
    w.move(p,cleanInput({left:direction<0,right:direction>0,jump}),STEP);updateHazards(w,STEP);
    if(p.support?.startsWith(`tower${circuit}:wire`))wireSteps++;
  }
  assert.ok(direction>0?p.x>1640:p.x<920,`${p.x},${p.y}`);
  assert.ok(wireSteps>100,"cross using the wire, without extra jumps or a hidden bridge");
  assert.equal(p.hp,100);assert.equal(p.y,y-30);assert.equal(h.active,false);
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
test("severed wires keep cycling and shocking on their surviving tails, then restore next round",()=>{
  const w=arena(),h=w.hazards[0];advance(w,7);
  const point = w.cables[0].points[9];
  carveExplosion(w,{x:point.x,y:point.y,radius:65});updateHazards(w,STEP);
  assert.ok(!h.done&&h.active);assert.ok(wirePieces(w,h).length>0);
  assert.equal(intactPowerline(w,h),false);
  assert.ok(!w.solids().some(s=>s.id.startsWith("tower0:wire")));
  for(let i=0;i<3/STEP;i++){w.time+=STEP;updateCables(w,STEP);updateHazards(w,STEP);}
  const tail=wirePieces(w,h)[4],p=w.players[0];
  Object.assign(p,{x:(tail.a.x+tail.b.x)/2,y:(tail.a.y+tail.b.y)/2,hp:100});
  updateHazards(w,STEP);assert.equal(p.hp,30,"a hanging severed tail remains hazardous");p.x=400;
  advance(w,4);assert.ok(!h.done&&!h.active);advance(w,7);assert.ok(!h.done&&h.active);
  assert.ok(validSnapshot(w.snapshot()));w.startRound();
  assert.ok(w.hazards.every(h=>!h.done&&!h.active&&intactPowerline(w,h)));
});
test("nukes consume affected tower and wire sections while surviving conductors stay live",()=>{
  const w=arena(),h=w.hazards[0],before=w.platforms.length;advance(w,7);
  const f=nuclearField(w,{x:960,y:360,owner:0});
  for(let i=0;i<120;i++){w.time+=STEP;updateNuclear(w,f,STEP);updateHazards(w,STEP);}
  assert.ok(!h.done&&h.active&&w.hazards.includes(h));assert.equal(intactPowerline(w,h),false);
  assert.ok(w.platforms.length!==before);assert.ok(!w.platforms.some(p=>p.x<1000&&p.x+p.w>900&&p.y===350));
  assert.ok(w.platforms.some(p=>p.x>=1570&&p.y===350));assert.ok(validSnapshot(w.snapshot()));
});
test("hot join and interpolation retain circuit timing and destroyed wire geometry; malformed fields reject",()=>{
  const w=arena();advance(w,7);const point=w.cables[0].points[9];carveExplosion(w,{x:point.x,y:point.y,radius:65});updateHazards(w,STEP);
  const state=JSON.parse(JSON.stringify(w.snapshot()));
  assert.ok(validSnapshot(state));
  const received=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(state))),validSnapshot);
  assert.deepEqual(received.platforms,state.platforms);assert.deepEqual(received.hazards,state.hazards);
  const next=structuredClone(state);next.time+=.1;
  const view=interpolateStates(received,next,.5);
  assert.equal(view.hazards[0].done,false);assert.equal(view.hazards[0].active,true);assert.equal(view.hazards[1].active,true);
  assert.ok(view.cables[0].links.some(v=>!v));
  for(const patch of [{circuit:2},{circuit:"0"},{w:1101},{duration:7.1},{active:"yes"}]) {
    const s=structuredClone(state);Object.assign(s.hazards[0],patch);assert.equal(validSnapshot(s),false);
  }
  const s=structuredClone(state);s.cables[0].id="tower9";assert.equal(validSnapshot(s),false);
});
