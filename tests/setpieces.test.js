import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateHazards, hazardZone } from "../src/hazards.js";
import { prepareProp } from "../src/props.js";
import { trainBox, trainIntersects, trainPose } from "../src/trains.js";
import { carveExplosion } from "../src/terrain.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { GuestPrediction } from "../src/guest-prediction.js";
import { navigation, routesFrom, surfaceAt } from "../src/navigation.js";
import { updateCables, cableSolids } from "../src/heavy-cables.js";

const fixture=(theme="railway")=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.theme===theme),players:[0,1,2,3],shuffle:false,random:()=>.4});
  w.phase="fight";w.weaponTimer=w.grenadeTimer=999;return w;
};
const place=(p,x,y,extra={})=>Object.assign(p,{x,y,vx:0,vy:0,ground:false,support:null,rig:null,prone:false,dropThrough:0,jumps:0,...extra});
const tick=w=>updateHazards(w,STEP);

test("train gives two seconds warning, crosses at speed and alternates directions",()=>{
  const w=fixture(),h=w.hazards[0];h.age=3;tick(w);assert.ok(h.warning>1.9&&!h.active);
  assert.deepEqual(hazardZone(h),{x:0,y:910,w:2560,h:150});
  h.age=5.5;tick(w);const x=h.bodyX;tick(w);assert.ok(Math.abs(h.bodyX-x-6400*STEP)<.001);
  h.age=16.5;tick(w);assert.equal(h.dir,-1);const right=h.bodyX;tick(w);assert.ok(h.bodyX<right);
  assert.ok(validSnapshot(w.snapshot()));
});

test("swept train contact kills prone and recovering fighters and moves severed bodies",()=>{
  for(const extra of [{},{prone:true},{knockdown:1},{freeze:1},{block:true}]){
    const w=fixture(),h=w.hazards[0],p=w.players[0];h.age=5.2;
    place(p,1210,1020,extra);tick(w);assert.equal(p.alive,false);assert.equal(w.lastDeathCause,"train");
    const rag=w.ragdolls[0];assert.equal(rag.effect,"blend");const before=structuredClone(rag.points);
    for(let i=0;i<20;i++){w.updateRagdolls(STEP);tick(w);}
    assert.ok(rag.points.some((q,i)=>Math.hypot(q.x-before[i].x,q.y-before[i].y)>30));
  }
});

test("warning is safe and a real timed double jump clears the train",()=>{
  const w=fixture(),h=w.hazards[0],p=w.players[0];place(p,1280,1030,{ground:true,support:w.platforms[8].id});
  h.age=4.8;tick(w);assert.equal(p.hp,100);
  h.age=4.85;let clear=false;
  for(let i=0;i<180;i++){
    w.move(p,cleanInput({jump:i===0||i===30}),STEP);tick(w);
    if(h.active&&h.bodyX+h.w/2>1280&&h.bodyX-h.w/2<1280){assert.ok(p.y+30<=910);clear=true;}
  }
  assert.ok(clear&&p.alive);assert.equal(p.hp,100);
});

test("train strikes props and loose weapons while the upper route stays safe",()=>{
  const w=fixture(),h=w.hazards[0];h.age=5.2;
  place(w.players[0],1000,750);Object.assign(w.cover[0],{x:1000,y:990});
  w.drops.push({x:1040,y:1030,vx:0,vy:0,type:"blaster",ammo:10,life:100});tick(w);
  assert.equal(w.players[0].hp,100);assert.equal(w.cover[0].hp,0);
  assert.ok(w.drops.at(-1).vx>1000);assert.ok(w.chunks.length>0);
});

test("destroyed approach remains disabled through hot join and resets next round",()=>{
  const w=fixture();carveExplosion(w,{x:25,y:1060,radius:90});tick(w);assert.ok(w.hazards[0].done);
  const s=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
  assert.ok(validSnapshot(s));assert.ok(s.hazards[0].done);assert.deepEqual(s.platforms.map(p=>p.id),w.platforms.map(p=>p.id));
  w.startRound();assert.ok(!w.hazards[0].done);assert.equal(w.hazards[0].age,0);
});

test("train validation rejects malformed geometry and interpolation never sweeps a dormant train",()=>{
  const w=fixture(),r=new RenderSnapshots();w.hazards[0].age=4.99;tick(w);const a=r.make(w.snapshot());
  w.hazards[0].age=5.04;tick(w);const b=r.make(w.snapshot());
  assert.equal(interpolateStates(a,b,.5).hazards[0].bodyX,b.hazards[0].bodyX);
  for(const [key,value] of [["w",3201],["y",900],["bodyX",Infinity],["h",151]]){
    const bad=structuredClone(b);bad.hazards[0][key]=value;assert.equal(validSnapshot(bad),false,key);
  }
  w.prediction=true;const age=w.hazards[0].age;tick(w);assert.equal(w.hazards[0].age,age);
});

test("both new arenas connect all spawn positions to their contested weapons",()=>{
  for(const theme of ["railway","foundry"]){
    const w=fixture(theme),solids=w.solids(),graph=navigation(solids,{spikes:[]});
    for(const p of w.players){
      const paths=routesFrom(graph,solids,surfaceAt(solids,p),p.x,new Map(),0);
      for(const [x,y] of w.arena.weapons)assert.ok(paths.has(surfaceAt(solids,{x,y}).id),`${theme} spawn ${p.id} -> ${x}`);
    }
    assert.ok(validSnapshot(w.snapshot()),theme);
  }
});

test("foundry molten pits kill and destroyed machinery stays absent until reset",()=>{
  const w=fixture("foundry");place(w.players[0],790,1250);tick(w);assert.equal(w.players[0].alive,false);assert.equal(w.lastDeathCause,"burn");
  const press=w.hazards.find(h=>h.type==="crusher");carveExplosion(w,{x:press.bodyX,y:press.bodyY,radius:75});tick(w);
  assert.ok(press.done);const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  w.startRound();assert.ok(w.hazards.every(h=>!h.done));
});

test("ladles warn before pouring, kill only in the stream and stop after a mounting cut",()=>{
  const w=fixture("foundry"),h=w.hazards.find(h=>h.type==="ladle"),p=w.players[0];
  place(p,790,960);h.age=4.5;tick(w);assert.ok(h.warning>0&&!h.active);assert.equal(p.hp,100);
  h.age=6.5;place(w.players[1],880,960);tick(w);
  assert.equal(p.alive,false);assert.equal(w.players[1].hp,100);assert.equal(w.ragdolls[0].effect,"burn");
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
  carveExplosion(w,{x:790,y:570,radius:75});tick(w);assert.ok(h.done&&!h.active);
  const s=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);assert.ok(s.hazards.find(q=>q.id===h.id).done);
  const bad=structuredClone(s);bad.hazards.find(q=>q.id===h.id).h=900;assert.equal(validSnapshot(bad),false);
  w.startRound();assert.ok(w.hazards.every(h=>!h.done));
});

test("fast shots collide with the passing train and cannot shoot through it",()=>{
  const w=fixture(),h=w.hazards[0];h.age=5.45;tick(w);
  w.projectiles.push({kind:"bullet",x:h.bodyX-h.w/2-70,y:990,vx:30000,vy:0,r:3,life:Infinity,damage:20,force:200,owner:0,weapon:"blaster"});
  w.updateProjectiles(1/30);assert.equal(w.projectiles.length,0);
});

test("thin decks land from above, pass upwards and drop onto solid floors",()=>{
  const w=fixture(),p=w.players[0],deck=w.platforms.find(s=>s.oneWay&&s.x===900);
  w.cover=[];place(p,1030,deck.y-100,{vy:100});
  for(let i=0;i<60;i++)w.move(p,cleanInput({}),STEP);
  assert.equal(p.support,deck.id);const y=p.y;
  for(let i=0;i<80;i++)w.move(p,cleanInput({duck:true}),STEP);
  assert.ok(p.y>y+200&&p.ground);assert.equal(p.y,1050);assert.equal(p.prone,true);
  // A solid floor always supports prone fighters, even while S is held.
  for(let i=0;i<60;i++)w.move(p,cleanInput({duck:true}),STEP);assert.equal(p.y,1050);
  place(p,1030,850,{vy:-700});
  for(let i=0;i<28;i++)w.move(p,cleanInput({}),STEP);assert.ok(p.y<deck.y-30);
});

test("brief drop input cannot reattach and guest prediction replays the same drop",()=>{
  const w=fixture(),p=w.players[1],deck=w.platforms.find(s=>s.oneWay&&s.x===900);
  place(p,1030,deck.y-30,{ground:true,support:deck.id});
  const encoder=new RenderSnapshots(),prediction=new GuestPrediction(),s={...encoder.make(w.snapshot()),inputAcks:[0,0,0,0]};
  prediction.receive(s,1,1000);prediction.advance(cleanInput({duck:true}),1,1017);
  for(let i=0;i<2;i++)w.move(p,cleanInput({duck:true}),STEP);
  assert.ok(prediction.player.y>deck.y-30);assert.equal(prediction.player.support,null);
  for(let i=0;i<24;i++)w.move(p,cleanInput({}),STEP);assert.ok(p.y>deck.y);
  const next=encoder.make(w.snapshot());assert.ok(validSnapshot(next));
  next.players[1].motion.dropThrough=-1;assert.equal(validSnapshot(next),false);
});

test("holding S descends through the actual transmission cable tiles",()=>{
  const w=fixture("transmission");for(let i=0;i<40;i++)updateCables(w,STEP);
  const tile=cableSolids(w).find(s=>s.x>1150),p=w.players[0];assert.ok(tile);
  place(p,tile.x+tile.w/2,tile.y-30,{ground:true,support:tile.id});const start=p.y;
  for(let i=0;i<20;i++)w.move(p,cleanInput({duck:true}),STEP);
  assert.ok(p.y>start+55&&!p.ground);assert.ok(p.prone);
});

test("destruction preserves the thin surface flag and invalid wire flags are rejected",()=>{
  const w=fixture();carveExplosion(w,{x:1030,y:780,radius:40});
  assert.ok(w.platforms.filter(p=>p.y===780).every(p=>p.oneWay));
  const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  s.platforms[0].oneWay="true";assert.equal(validSnapshot(s),false);
});


test("train impacts keep fresh and existing debris within snapshot motion limits",()=>{
  const w=fixture(),h=w.hazards[0];h.age=5.2;
  w.cover=[prepareProp({id:'track-crate',kind:'crate',x:1200,y:1000,w:50,h:60,hp:75,maxHp:75})];
  tick(w);assert.ok(w.chunks.length>0);
  assert.ok(w.chunks.every(b=>Math.abs(b.vx)<=1500));assert.ok(validSnapshot(w.snapshot()));
  tick(w);assert.ok(w.chunks.every(b=>Math.abs(b.vx)<=1500));assert.ok(validSnapshot(w.snapshot()));
});

test("a passing train derails into a physical fall when a wheel reaches missing track",()=>{
  const w=fixture(),h=w.hazards[0];
  carveExplosion(w,{x:1280,y:1060,radius:85});
  assert.ok(w.platforms.some(p=>p.y===1060&&p.x<1280&&p.x+p.w<1280));
  h.age=5.35;
  for(let i=0;i<30&&!h.derailed;i++)tick(w);
  assert.ok(h.derailed);assert.ok(h.active);assert.ok(Math.abs(h.vx)>1000);
  const start={y:h.bodyY,angle:h.angle};
  for(let i=0;i<30;i++)tick(w);
  assert.ok(h.bodyY>start.y);assert.ok(Math.abs(h.angle-start.angle)>.02);
  assert.ok(validSnapshot(w.snapshot()));
});

test("the derailed train has rotated collision, destroys platforms and wipes out matter in its path",()=>{
  const w=fixture(),h=w.hazards[0],p=w.players[0];
  carveExplosion(w,{x:1120,y:1060,radius:90});h.age=5.25;
  for(let i=0;i<20&&!h.derailed;i++)tick(w);
  assert.ok(h.derailed);
  Object.assign(h,{bodyX:1280,bodyY:825,vx:900,vy:500,angle:.42,spin:1.1,crashCooldown:0});
  place(p,1280,825);w.drops.push({x:1420,y:890,vx:0,vy:0,type:"blaster",ammo:10,life:100});
  const before=w.platforms.length,box=trainBox(h);
  assert.ok(box.h>h.h*5);assert.ok(trainIntersects(h,playerBoxForTest(p)));
  for(let i=0;i<4;i++)tick(w);
  assert.equal(p.alive,false);assert.equal(w.lastDeathCause,"train");
  assert.ok(w.platforms.length!==before||w.platforms.some(q=>q.id?.startsWith("cut")));
  assert.ok(Math.abs(w.drops.at(-1).vx)>100);
});

test("derail state survives compact hot join, rejects malformed motion and resets next round",()=>{
  const w=fixture(),h=w.hazards[0];carveExplosion(w,{x:1280,y:1060,radius:85});h.age=5.35;
  for(let i=0;i<30&&!h.derailed;i++)tick(w);
  const s=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
  const train=s.hazards[0];assert.ok(train.derailed);assert.ok(Math.abs(train.angle-h.angle)<.01);assert.ok(Math.abs(train.vx-h.vx)<.01);
  for(const [key,value] of [["angle",Math.PI+1],["vx",7000],["spin",8],["derailed","yes"]]){
    const bad=structuredClone(s);bad.hazards[0][key]=value;assert.equal(validSnapshot(bad),false,key);
  }
  w.startRound();assert.equal(w.hazards[0].derailed,false);assert.equal(w.hazards[0].angle,0);
});

function playerBoxForTest(p){return{x:p.x-18,y:p.y-28,w:36,h:56};}
