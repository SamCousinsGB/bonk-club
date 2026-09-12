import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateHazards } from "../src/hazards.js";
import { updateCables, cableSolids, blastCables } from "../src/heavy-cables.js";
import { powerlineCircuit } from "../src/powerline-circuit.js";
import { carveExplosion } from "../src/terrain.js";
import { deathJoints } from "../src/death-effects.js";
import { navigation, routesFrom, surfaceAt } from "../src/navigation.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { RenderSnapshots } from "../src/render-state.js";
import { GuestPrediction } from "../src/guest-prediction.js";

function fixture() {
  const w = new World({ arena: ARENAS.findIndex(a => a.turbine), players: [0,1,2,3], shuffle: false, random: () => .4 });
  w.phase = "fight"; w.weaponTimer = w.grenadeTimer = 999; w.drops = [];
  return w;
}
const place = (p, x, y, extra = {}) => Object.assign(p, {x,y,vx:0,vy:0,rig:null,ground:false, ...extra});
const tick = w => updateHazards(w, STEP);

test("every bottom entry including the edges and rotor seams hits spinning blades", () => {
  for (let x=18; x<=2542; x+=31) {
    const w=fixture(),p=w.players[0];place(p,x,1100);
    for(let i=0;i<240 && p.alive;i++){w.move(p,cleanInput({}),STEP);tick(w);}
    assert.equal(p.alive,false,`gap at ${x}`);assert.equal(w.lastDeathCause,"turbine");
    assert.ok(p.y<1420);assert.equal(w.ragdolls[0].effect,"blend");
  }
});

test("blade contact separates six pieces, blood and motion; a nearby platform stays safe", () => {
  const w=fixture(),p=w.players[0];place(p,213,1158,{vy:1000});tick(w);
  const rag=w.ragdolls[0];assert.ok(rag);assert.equal(deathJoints(rag).length,5);assert.ok(w.blood.length>0);
  const before=structuredClone(rag.points);for(let i=0;i<30;i++){tick(w);w.updateRagdolls(STEP);}
  assert.ok(rag.points.some((p,i)=>Math.hypot(p.x-before[i].x,p.y-before[i].y)>15));
  assert.ok(rag.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.ok(w.players.slice(1).every(p=>p.hp===100));assert.ok(validSnapshot(w.snapshot()));
});

test("prone, frozen, parrying and knocked-down fighters have no turbine immunity", () => {
  for(const extra of [{prone:true},{freeze:1},{block:true},{knockdown:1}]){
    const w=fixture();place(w.players[0],213,1180,extra);tick(w);
    assert.equal(w.players[0].alive,false);assert.equal(w.lastDeathCause,"turbine");
  }
});

test("the casing corners outside the circular blade sweep do not kill", () => {
  const w=fixture();place(w.players[0],430,1140);tick(w);assert.equal(w.players[0].hp,100);
  place(w.players[0],430,1290);tick(w);assert.equal(w.players[0].alive,false);
});

test("an existing corpse is blended on entering the blades without a second score", () => {
  const w=fixture(),p=w.players[0];place(p,213,1190);w.kill(p,{cause:"bullet"});
  tick(w);assert.equal(w.ragdolls[0].effect,"blend");assert.equal(w.lastDeathCause,"bullet");
  assert.equal(w.ragdolls.length,1);assert.ok(validSnapshot(w.snapshot()));
});

test("destroying a rotor or its mounting is permanent; the sump still contains falls", () => {
  const w=fixture();carveExplosion(w,{x:213,y:1390,radius:130});tick(w);
  assert.ok(w.hazards[0].done);assert.ok(!w.hazards[1].done);
  const p=w.players[0];place(p,213,1190);
  for(let i=0;i<240;i++){w.move(p,cleanInput({}),STEP);tick(w);}
  assert.ok(p.alive&&p.ground);assert.ok(p.y<1428);assert.equal(w.lastDeathCause,null);
  assert.ok(w.solids().some(s=>s.id==="hall-bottom"));
  w.startRound();assert.ok(w.hazards.every(h=>!h.done));assert.ok(w.cables.every(c=>c.links.every(Boolean)));
});

test("side walls and bottom retain high-speed fighters even after every deck is removed", () => {
  const w=fixture();w.platforms=[];tick(w);
  for(const [x,vx] of [[20,-1600],[2540,1600]]){
    const p=w.players[0];place(p,x,1200,{vx,vy:1500});
    for(let i=0;i<240;i++)w.move(p,cleanInput({}),STEP);
    assert.ok(p.alive&&p.x>=0&&p.x<=2560&&p.y<1428,JSON.stringify([p.x,p.y]));
  }
});

test("narrow routes require double jumps and all four spawns can reach both pickups", () => {
  const w=fixture(),solids=w.solids(),graph=navigation(solids,{spikes:[]});
  for(const p of w.players){
    const paths=routesFrom(graph,solids,surfaceAt(solids,p),p.x,new Map(),0);
    for(const [x,y] of w.arena.weapons)assert.ok(paths.has(surfaceAt(solids,{x,y}).id));
    assert.ok([...paths.keys()].every(id=>!solids.find(s=>s.id===id).lethal));
  }
  assert.ok(w.platforms.filter(p=>p.y>800&&p.y<1100&&p.w<=145).length>=7);
  const from=w.platforms[6],to=w.platforms[7],edge=graph.get(from.id).find(e=>e.to===to.id&&e.jumps===2);
  assert.ok(edge);assert.ok(!graph.get(from.id).some(e=>e.to===to.id&&e.jumps===1));
  const p=w.players[0];place(p,edge.startX,from.y-30,{ground:true,support:from.id});
  let second=false,landed=false;
  for(let i=0;i<210;i++){
    const jump=i===0||(!second&&i*STEP>=edge.secondAt);
    if(i>0&&jump)second=true;
    w.move(p,cleanInput({right:true,jump}),STEP);
    if(p.ground&&p.support===to.id){landed=true;break;}
  }
  assert.ok(landed,`actual double jump missed: ${p.x},${p.y}`);
});

test("guest prediction uses the same solid hall boundaries without editing host state", () => {
  const w=fixture();w.platforms=[];tick(w);place(w.players[1],2538,1398,{ground:true,vx:240});
  const s={...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]},saved=structuredClone(s);
  const prediction=new GuestPrediction();prediction.receive(s,1,1000);
  for(let i=1;i<12;i++)prediction.advance(cleanInput({right:true}),i,1000+i*1000/60);
  assert.ok(prediction.player.x<=2546&&prediction.player.y<1428);
  assert.deepEqual(s,saved);
});

test("cables sag under gravity, never form walking bridges and severed tails fall", () => {
  const w=fixture(),c=w.cables[0];assert.equal(cableSolids(w).length,0);
  assert.ok(c.points[12].y>c.points[0].y+150);
  blastCables(w,{...c.points[12],radius:45});const before=structuredClone(c.points);
  for(let i=0;i<120;i++)updateCables(w,STEP);
  assert.ok(c.links.some(v=>!v));assert.ok(c.attached.every(Boolean));
  assert.ok(c.points.some((p,i)=>p.y>before[i].y+30));assert.ok(validSnapshot(w.snapshot()));
});

test("mounted cable runs retain seven-second supply and detached runs lose it", () => {
  const w=fixture(),h=w.hazards[6],c=w.cables[0];
  h.age=6.2;tick(w);assert.ok(h.warning>0&&!h.active);
  h.age=7;tick(w);assert.ok(h.active);
  const q=c.points[12];place(w.players[0],q.x,q.y);tick(w);assert.equal(w.players[0].hp,30);
  blastCables(w,{...c.points[12],radius:30});h.age=8;tick(w);
  assert.ok(powerlineCircuit(w).runs.filter(r=>r.cable===c.id).every(r=>r.powered));
  carveExplosion(w,{x:390,y:340,radius:65});carveExplosion(w,{x:1060,y:340,radius:65});tick(w);
  assert.ok(c.attached.every(v=>!v));assert.ok(powerlineCircuit(w).runs.filter(r=>r.cable===c.id).every(r=>!r.powered));
});

test("prediction, countdown and results cannot kill or advance turbines", () => {
  for(const phase of ["countdown","result"]){const w=fixture();w.phase=phase;place(w.players[0],213,1200);tick(w);assert.equal(w.players[0].hp,100);assert.equal(w.hazards[0].age,0);}
  const w=fixture();w.prediction=true;place(w.players[0],213,1200);tick(w);assert.equal(w.players[0].hp,100);assert.equal(w.hazards[0].age,0);
});

test("changed-map transport and hot join preserve blade deaths, rotor cuts and cable geometry", () => {
  const w=fixture();place(w.players[0],213,1170);tick(w);
  carveExplosion(w,{x:1493,y:1390,radius:180});blastCables(w,{...w.cables[0].points[12],radius:45});updateCables(w,STEP);tick(w);
  const s=new RenderSnapshots().make(w.snapshot()),out=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(s))),validSnapshot);
  assert.deepEqual(out.cables,s.cables);assert.deepEqual(out.hazards,s.hazards);assert.equal(out.ragdolls[0].effect,"blend");
  assert.ok(validSnapshot(out));
  for(const change of [s=>s.cables[0].id="tower0",s=>s.cables[0].points[3].x=Infinity,s=>s.hazards[0].w=900,s=>s.ragdolls[0].effect="invalid"]){
    const bad=structuredClone(s);change(bad);assert.equal(validSnapshot(bad),false);
  }
});
