import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP } from "../src/engine.js";
import { prepareProp } from "../src/props.js";
import { addSpill, updateReactions, reactionContacts, contactReaction } from "../src/reactions.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, GuestFrames } from "../src/render-state.js";

const floor = {id:"floor",x:0,y:1100,w:2560,h:30,baseX:0,baseY:1100,dx:0,dy:0};
function lab() {
  const w = new World({players:[0,1],shuffle:false,random:()=>.43});
  Object.assign(w,{phase:"fight",platforms:[{...floor}],cover:[],chunks:[],water:[],gas:[],spills:[],
    hazards:[],drops:[],projectiles:[],weaponTimer:999});
  w.arena={...w.arena,spikes:[]};
  for(const p of w.players)Object.assign(p,{x:1900+p.id*250,y:1070,vx:0,vy:0});
  return w;
}
const prop = kind => prepareProp({id:kind,kind,x:800,y:1030,w:54,h:70,hp:85,maxHp:85});
const gas = w => {const g={id:++w.reactionSerial,x:850,y:960,r:35,vx:0,vy:0,life:3.2,lit:0,owner:0};w.gas.push(g);return g;};
const advance = (w,t) => {for(let i=0;i<Math.ceil(t/.05);i++){w.time+=.05;updateReactions(w,.05);}};
function shot(w,kind="bullet",x=720,y=1060,vx=1200,vy=0,damage=10) {
  const b={kind,weapon:kind==="bullet"?"blaster":kind,owner:1,x,y,vx,vy,
    life:1,r:4,damage,force:100,bounces:0,hitIds:[]};
  w.projectiles.push(b);
  for(let i=0;i<20;i++)w.updateProjectiles(STEP);
  return b;
}

test("ordinary bullets, pellets, rail and ricochets can ignite gas and keep travelling",()=>{
  for(const kind of ["bullet","pellet","rail","ricochet"])for(const roll of [.1,.9]){
    const w=lab(),g=gas(w);w.random=()=>roll;
    const b=shot(w,kind,700,960);
    assert.equal(g.lit>0,roll<.3);assert.ok(b.life>0&&b.x>g.x+g.r);
    if(g.lit)assert.equal(g.owner,1);
  }
});

test("one bullet has one ignition chance per fuel parcel across multiple ticks",()=>{
  const w=lab(),g=gas(w);let rolls=0;w.random=()=>{rolls++;return .9;};
  shot(w,"bullet",825,960,50);assert.equal(rolls,1);assert.equal(g.lit,0);
  w.random=()=>.1;shot(w,"bullet",825,960,50);assert.ok(g.lit>0);
});

test("shooting a full gas, oil or tar container can ignite its first leak",()=>{
  for(const kind of ["canister","oilBarrel","tarBarrel"])for(const roll of [.1,.9]){
    const w=lab(),b=prop(kind);w.cover=[b];w.random=()=>roll;
    shot(w);assert.ok(b.leak);assert.equal(b.fire>0,roll<.3);advance(w,.05);
    assert.equal(kind==="canister"?w.gas.some(g=>g.lit>0):w.spills.some(q=>q.fire>0),roll<.3);
    assert.ok(validSnapshot(w.snapshot()));
  }
});

test("a lethal bullet releases burning tar once; glue and wet or frozen containers do not ignite",()=>{
  const w=lab(),b=prop("tarBarrel");w.cover=[b];w.random=()=>.1;
  shot(w,"bullet",720,1060,1200,0,200);
  assert.equal(b.hp,0);assert.equal(b.liquidLeft,0);assert.ok(w.spills.every(q=>q.fire>0));
  assert.equal(w.spills.reduce((v,q)=>v+q.w*q.h,0),96*32);
  for(const kind of ["glueBarrel","waterTank","crate","canister","oilBarrel","tarBarrel"]){
    const x=lab(),p=prop(kind);x.cover=[p];x.random=()=>.1;
    if(["canister","oilBarrel","tarBarrel"].includes(kind))p.cold=2;
    shot(x);assert.ok(!p.fire,kind);
  }
  const wet=lab(),p=prop("canister");p.soaked=2;wet.cover=[p];wet.random=()=>.1;shot(wet);assert.ok(!p.fire);
});

test("shots through oil and tar can ignite them; glue, cold fuel and missed shots stay unlit",()=>{
  for(const kind of ["oil","tar","glue"])for(const roll of [.1,.9]){
    const w=lab();addSpill(w,kind,816,1099,24);advance(w,.1);w.random=()=>roll;
    shot(w,"bullet",816,1000,0,1200);
    assert.equal(w.spills.some(q=>q.fire>0),kind!=="glue"&&roll<.3);
  }
  const w=lab();addSpill(w,"tar",816,1099,24);w.spills.forEach(q=>q.cold=2);w.random=()=>.1;
  shot(w,"bullet",816,1000,0,1200);assert.ok(w.spills.every(q=>!q.fire));
  const miss=lab(),g=gas(miss);miss.random=()=>.1;shot(miss,"bullet",700,800);assert.equal(g.lit,0);
});

test("solid terrain and props stop a bullet before fuel behind them",()=>{
  for(const barrier of ["wall","crate"]){
    const w=lab(),g=gas(w);w.random=()=>.1;
    if(barrier==="wall")w.platforms.push({...floor,id:"wall",x:750,y:900,w:20,h:200});
    else w.cover=[prepareProp({...prop("crate"),x:750,y:930})];
    shot(w,"bullet",700,960);assert.equal(g.lit,0);
  }
});

test("a bullet can light gas and hit a solid target later in the same swept step",()=>{
  const w=lab(),g=gas(w);g.x=800;g.r=20;
  const b=prepareProp({...prop("crate"),x:870,y:930});w.cover=[b];w.random=()=>.1;
  shot(w,"bullet",750,960,18000);
  assert.ok(g.lit>0);assert.equal(b.hp,75);assert.equal(w.projectiles.length,0);
});

test("non-ballistic shots keep their elemental behavior without chance rolls",()=>{
  for(const kind of ["flame","spark","plasma","rocket","tesla"]){
    const w=lab(),g=gas(w);w.random=()=>{throw Error("elemental ignition must not roll");};
    const b={kind,r:4,owner:0},hit=reactionContacts(w,b,750,960,900,960).find(c=>c.gas);
    assert.ok(hit);contactReaction(w,b,hit);assert.ok(g.lit>0);
  }
  for(const kind of ["frost","bubble","boomerang","saw"]){
    const w=lab(),g=gas(w);w.random=()=>.1;shot(w,kind,700,960);assert.equal(g.lit,0);
  }
});

test("oil and tar spread into wider finite pools, with tar still slower",()=>{
  const spans={};
  for(const kind of ["oil","tar"]){
    const w=lab();addSpill(w,kind,1200,1099,96);advance(w,3);
    spans[kind]=Math.max(...w.spills.map(q=>q.x+q.w))-Math.min(...w.spills.map(q=>q.x));
    assert.ok(spans[kind]>=384,`${kind} spread ${spans[kind]}`);
    assert.ok(Math.abs(w.spills.reduce((v,q)=>v+q.w*q.h,0)-96*32)<1e-6);
    assert.ok(validSnapshot(w.snapshot()));
  }
  assert.ok(spans.oil>spans.tar,JSON.stringify(spans));
});

test("gas jets travel farther while keeping their bounded lifetime and snapshot limits",()=>{
  const w=lab(),b=prop("canister");b.angle=0;w.cover=[b];w.damageCover(b,5);advance(w,.05);
  const g=w.gas[0],x=g.x;w.cover=[];advance(w,2);
  assert.ok(g.x-x>140,`gas travelled ${g.x-x}`);assert.ok(validSnapshot(w.snapshot()));
  advance(w,1.3);assert.equal(w.gas.length,0);
});

test("bullet-lit fuel survives encoded guest and hot-join snapshots and clears next round",async()=>{
  const w=lab();addSpill(w,"tar",816,1099,96);advance(w,1);const g=gas(w);w.random=()=>.1;
  shot(w,"bullet",700,960);shot(w,"bullet",816,1000,0,1200);
  const state=new RenderSnapshots().make(w.snapshot()),copy=await decodeState(await encodeState(state));assert.ok(validSnapshot(copy));
  assert.deepEqual(copy.spills,state.spills);assert.equal(copy.gas[0].lit,g.lit);
  const guest=new GuestFrames();guest.push(copy,100);const rendered=guest.sample(110);
  assert.ok(rendered.spills.some(q=>q.fire>0));assert.ok(rendered.gas[0].lit>0);
  w.startRound();assert.equal(w.spills.length,0);assert.equal(w.gas.length,0);
});
