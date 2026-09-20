import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateHazards } from "../src/hazards.js";
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
  tick(w);w.updateRagdolls(STEP);assert.equal(w.ragdolls[0].effect,"blend");assert.equal(w.lastDeathCause,"bullet");
  assert.equal(w.ragdolls.length,1);assert.ok(validSnapshot(w.snapshot()));
});

test("already sliced bodies become valid separate pieces on entering a rotor", () => {
  const w=fixture();place(w.players[0],213,1190);w.kill(w.players[0],{effect:"slice",cause:"rail"});
  assert.equal(w.ragdolls[0].points.length,13);w.updateRagdolls(STEP);
  assert.equal(w.ragdolls[0].effect,"blend");assert.equal(w.ragdolls[0].points.length,11);
  assert.ok(validSnapshot(w.snapshot()));assert.equal(w.lastDeathCause,"rail");
});

test("destroying a rotor or its mounting is permanent; its opening has no floor", () => {
  const w=fixture();carveExplosion(w,{x:213,y:1430,radius:130});tick(w);
  assert.ok(w.hazards[0].done);assert.ok(!w.hazards[1].done);
  const p=w.players[0];place(p,213,1190);
  for(let i=0;i<240&&p.alive;i++)w.step(STEP,{});
  assert.equal(p.alive,false);assert.equal(p.ground,false);assert.equal(w.lastDeathCause,"turbine");
  assert.ok(!w.solids().some(s=>s.boundary&&s.w>80));
  w.startRound();assert.ok(w.hazards.every(h=>!h.done));assert.ok(w.cables.every(c=>c.links.every(Boolean)));
});

test("side walls retain horizontal impacts without adding a bottom floor", () => {
  const w=fixture();w.platforms=[];tick(w);
  for(const [x,vx] of [[20,-1600],[2540,1600]]){
    const p=w.players[0];place(p,x,300,{vx,vy:0});
    for(let i=0;i<30;i++)w.move(p,cleanInput({}),STEP);
    assert.ok(p.alive&&p.x>=0&&p.x<=2560,JSON.stringify([p.x,p.y]));
  }
  assert.deepEqual(w.solids().filter(s=>s.boundary).map(s=>s.id).sort(),["hall-left","hall-right"]);
});

test("narrow routes require double jumps and all four spawns can reach both pickups", () => {
  const w=fixture(),solids=w.solids(),graph=navigation(solids,{spikes:[]});
  for(const p of w.players){
    const paths=routesFrom(graph,solids,surfaceAt(solids,p),p.x,new Map(),0);
    for(const [x,y] of w.arena.weapons)assert.ok(paths.has(surfaceAt(solids,{x,y}).id));
    assert.ok([...paths.keys()].every(id=>!solids.find(s=>s.id===id).lethal));
  }
  assert.ok(w.platforms.some(p=>p.move));
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
  const w=fixture();w.platforms=[];tick(w);place(w.players[1],2538,1250,{ground:true,vx:240});
  const s={...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]},saved=structuredClone(s);
  const prediction=new GuestPrediction();prediction.receive(s,1,1000);
  for(let i=1;i<12;i++)prediction.advance(cleanInput({right:true}),i,1000+i*1000/60);
  assert.ok(prediction.player.x<=2546&&prediction.player.y<1428);
  assert.deepEqual(s,saved);
});

test("the turbine row has no floor and the wires are removed", () => {
  const w=fixture();assert.equal(w.cables.length,0);assert.equal(w.hazards.length,6);
  assert.ok(w.hazards.every(h=>h.type==="turbine"));
  assert.deepEqual(w.solids().filter(s=>s.boundary).map(s=>s.id).sort(),["hall-left","hall-right"]);
  assert.ok(!w.platforms.some(p=>p.y>1200));
});

test("remains keep jumbling through a long fight and the result with bounded valid physics", () => {
  const w=fixture();place(w.players[0],213,1170);tick(w);const rag=w.ragdolls[0];
  const advance=n=>{for(let i=0;i<n;i++){w.time+=STEP;w.updateRagdolls(STEP);}};
  advance(1200);assert.ok(w.ragdolls.includes(rag));
  w.phase="result";
  const ranges=rag.points.map(p=>({min:p.y,max:p.y}));
  for(let frame=0;frame<240;frame++){
    advance(1);rag.points.forEach((p,i)=>{ranges[i].min=Math.min(ranges[i].min,p.y);ranges[i].max=Math.max(ranges[i].max,p.y);});
  }
  assert.ok(ranges.every(r=>r.max-r.min>25),"every piece must lift and tumble through the rotor row");
  assert.ok(rag.points.every(p=>Number.isFinite(p.x)&&p.y<1600&&p.x>=0&&p.x<=2560));
  assert.ok(validSnapshot(w.snapshot()));assert.equal(w.lastDeathCause,"turbine");
  w.startRound();assert.equal(w.ragdolls.length,0);
});

test("destroyed rotors stop driving remains and consumed ash is never revived", () => {
  const w=fixture();place(w.players[0],213,1170);tick(w);const rag=w.ragdolls[0];
  w.hazards.forEach(h=>h.done=true);rag.life=.1;
  for(let i=0;i<20;i++){w.time+=STEP;w.updateRagdolls(STEP);}assert.equal(w.ragdolls.length,0);
  place(w.players[1],213,1190);w.kill(w.players[1],{effect:"nuclear",cause:"nuclear"});
  const ash=w.ragdolls[0];ash.ash=true;w.hazards.forEach(h=>h.done=false);
  w.updateRagdolls(STEP);assert.notEqual(ash.effect,"blend");
});

test("prediction, countdown and results cannot kill or advance turbines", () => {
  for(const phase of ["countdown","result"]){const w=fixture();w.phase=phase;place(w.players[0],213,1200);tick(w);assert.equal(w.players[0].hp,100);assert.equal(w.hazards[0].age,0);}
  const w=fixture();w.prediction=true;place(w.players[0],213,1200);tick(w);assert.equal(w.players[0].hp,100);assert.equal(w.hazards[0].age,0);
});

test("changed-map transport and hot join preserve tumbling remains, rotor cuts and the cable-free map", () => {
  const w=fixture();place(w.players[0],213,1170);tick(w);
  carveExplosion(w,{x:1493,y:1390,radius:180});tick(w);
  for(let i=0;i<900;i++){w.time+=STEP;w.updateRagdolls(STEP);}
  const s=new RenderSnapshots().make(w.snapshot()),out=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(s))),validSnapshot);
  assert.deepEqual(out.cables,s.cables);assert.deepEqual(out.hazards,s.hazards);assert.equal(out.ragdolls[0].effect,"blend");
  assert.ok(validSnapshot(out));
  for(const change of [s=>s.cables.push({id:"turbine0"}),s=>s.ragdolls[0].points[3].x=Infinity,s=>s.hazards[0].w=900,s=>s.ragdolls[0].effect="invalid"]){
    const bad=structuredClone(s);change(bad);assert.equal(validSnapshot(bad),false);
  }
});
