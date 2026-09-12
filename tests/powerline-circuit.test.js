import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP } from "../src/engine.js";
import { updateHazards } from "../src/hazards.js";
import { powerlineCircuit, poweredWirePieces } from "../src/powerline-circuit.js";
import { TOWER_LEVELS, TOWER_MOUNTS } from "../src/cable-layout.js";
import { carveExplosion } from "../src/terrain.js";
import { addWater, updateReactions } from "../src/reactions.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { interpolateStates } from "../src/render-state.js";
import { blackholeField, updateBlackhole } from "../src/blackhole.js";
import { updateCables } from "../src/heavy-cables.js";

const make = () => {
  const w=new World({arena:ARENAS.findIndex(a=>a.transmission),shuffle:false,players:[0,1,2,3],random:()=>.4});
  w.phase="fight";w.botIds.clear();return w;
};
const advance=(w,seconds)=>{for(let i=0;i<Math.round(seconds/STEP);i++)updateHazards(w,STEP);};
const touch = w => {
  const upper=w.cables[0].points[12],lower=w.cables[1].points[12];
  Object.assign(upper,{x:lower.x,y:lower.y,px:lower.x,py:lower.y});
};

test("eight water jugs occupy every pylon arm and the four centre weapon ledges are absent",()=>{
  const w=make(),jugs=w.cover.filter(b=>b.kind==="waterTank");
  assert.equal(jugs.length,8);
  for(const y of TOWER_LEVELS)for(const [left,right] of [[50,480],[820,990],[1570,1740],[2080,2510]]) {
    const j=jugs.find(b=>b.x>=left&&b.x+b.w<=right&&b.y+b.h===y);
    assert.ok(j,`jug on arm ${left},${y}`);assert.equal(j.waterLeft,210);assert.ok(j.mass>0);
  }
  for(const y of [590,1050,1070])assert.ok(!w.platforms.some(p=>p.y===y&&p.x+p.w>790&&p.x<1770));
  for(const d of w.drops)assert.ok(w.platforms.some(p=>d.x>=p.x&&d.x<=p.x+p.w&&Math.abs(p.y-d.y)<65));
  jugs[0].waterLeft=0;w.startRound();assert.equal(w.cover.filter(b=>b.kind==="waterTank"&&b.waterLeft===210).length,8);
});

for(const end of [0,1])test(`losing mount ${end} preserves the seven-second clock until the other mount is lost`,()=>{
  const w=make();advance(w,3);
  const a=TOWER_MOUNTS[0][end],b=TOWER_MOUNTS[0][1-end];
  carveExplosion(w,{x:a.x,y:a.supportY,radius:28});
  advance(w,4);assert.ok(w.hazards.every(h=>h.active));
  advance(w,7);assert.ok(w.hazards.every(h=>!h.active));
  advance(w,7);assert.ok(w.hazards.every(h=>h.active));
  carveExplosion(w,{x:b.x,y:b.supportY,radius:28});updateHazards(w,STEP);
  assert.equal(w.hazards[0].active,false);assert.equal(w.hazards[0].warning,0);
  assert.equal(w.hazards[1].active,true);assert.ok(validSnapshot(w.snapshot()));
  advance(w,28);assert.equal(w.hazards[0].active,false);
});

test("a loose middle fragment has no timed power while both attached tails keep cycling",()=>{
  const w=make(),c=w.cables[0];c.links[5]=c.links[18]=false;advance(w,7);
  const runs=powerlineCircuit(w).runs.filter(r=>r.cable==="tower0");
  assert.deepEqual(runs.map(r=>r.powered),[true,false,true]);
  const p=w.players[0];Object.assign(p,{x:c.points[12].x,y:c.points[12].y-20});updateHazards(w,STEP);
  assert.equal(p.hp,100);
});

test("a black hole cannot remove the circuit controller while a wire mount survives",()=>{
  const w=make(),h=w.hazards[0],f=blackholeField(w,{x:1280,y:300,owner:0});
  f.radius=150;updateBlackhole(w,f,.5);advance(w,7);
  assert.ok(w.hazards.includes(h));assert.equal(h.active,true);
  assert.ok(!w.wreckage.some(p=>p.sourceType==="powerline"));
});

test("a physically falling upper cable shorts against the lower cable during the safe interval",()=>{
  const w=make();w.cover=[];
  carveExplosion(w,{x:960,y:350,radius:28});let short=false;
  for(let i=0;i<6/STEP;i++) {
    w.time+=STEP;updateCables(w,STEP);updateHazards(w,STEP);
    if(powerlineCircuit(w).arcs.length){short=true;assert.ok(w.hazards.every(h=>h.active));break;}
  }
  assert.ok(short,"gravity brings the upper wire into electrical contact before the timer activates");
});

test("touching upper and lower wires arc and shock throughout safe, live and warning phases",()=>{
  const w=make();touch(w);const p=w.players[0],point=w.cables[1].points[9];
  Object.assign(p,{x:point.x,y:point.y-20});updateHazards(w,STEP);
  assert.ok(w.hazards.every(h=>h.active&&h.warning===0));assert.equal(p.hp,30);
  p.x=100;
  for(const age of [2,6.5,7,13.99,14,20.5,21,28]) {
    for(const h of w.hazards)h.age=age;updateHazards(w,STEP);
    assert.ok(w.hazards.every(h=>h.active&&h.warning===0));
    const circuit=powerlineCircuit(w);assert.ok(circuit.arcs.length>0&&circuit.arcs.length<=8);
    assert.ok(circuit.runs.every(r=>r.shorted&&r.powered));assert.ok(validSnapshot(w.snapshot()));
  }
  w.cables[0].points[12].y=470;for(const h of w.hazards)h.age=3;updateHazards(w,STEP);
  assert.ok(w.hazards.every(h=>!h.active));assert.equal(powerlineCircuit(w).arcs.length,0);
});

test("a loose upper wire shorts through the attached lower wire, but two fully loose wires stay dead",()=>{
  const w=make();w.cables[0].attached=[false,false];touch(w);updateHazards(w,STEP);
  assert.ok(w.hazards.every(h=>h.active));
  w.cables[1].attached=[false,false];updateHazards(w,STEP);
  assert.ok(w.hazards.every(h=>!h.active));assert.equal(powerlineCircuit(w).arcs.length,0);
});

test("contacts use surviving segments, including crossings between distant nodes, and never span a cut",()=>{
  const w=make();for(const c of w.cables){c.links.fill(false);c.links[0]=true;}
  Object.assign(w.cables[0].points[0],{x:900,y:600});Object.assign(w.cables[0].points[1],{x:1500,y:1000});
  Object.assign(w.cables[1].points[0],{x:900,y:1000});Object.assign(w.cables[1].points[1],{x:1500,y:600});
  assert.ok(powerlineCircuit(w).runs.every(r=>r.shorted));
  w.cables[0].links[0]=false;assert.equal(powerlineCircuit(w).arcs.length,0);
});

test("touching wires electrify actual unfrozen water contacts and stop charging when separated",()=>{
  const w=make();w.cover=[];touch(w);updateHazards(w,STEP);
  const p=w.cables[1].points[12];addWater(w,p.x,p.y,32);
  updateReactions(w,.05);assert.ok(w.water.some(q=>q.charge));
  w.cables[0].points[12].y=470;updateHazards(w,STEP);updateReactions(w,.05);
  assert.ok(w.water.every(q=>!q.charge));
});

test("shorted cut cables and emptied jugs survive validated hot join and interpolation; reset clears the short",()=>{
  const w=make();w.cables[0].links[3]=false;touch(w);
  w.cover.find(b=>b.kind==="waterTank").waterLeft=37;updateHazards(w,STEP);
  const state=JSON.parse(JSON.stringify(w.snapshot()));assert.ok(validSnapshot(state));
  const received=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(state))),validSnapshot);
  const next=structuredClone(received);next.time+=.1;const view=interpolateStates(received,next,.5);
  assert.deepEqual(powerlineCircuit(view),powerlineCircuit(state));
  assert.ok(view.cover.some(b=>b.kind==="waterTank"&&b.waterLeft===37));
  w.prediction=true;const p=w.players[0],point=w.cables[1].points[9];Object.assign(p,{x:point.x,y:point.y-20});
  updateHazards(w,STEP);assert.equal(p.hp,100);
  w.prediction=false;w.startRound();assert.equal(powerlineCircuit(w).arcs.length,0);assert.equal(poweredWirePieces(w).length,0);
});
