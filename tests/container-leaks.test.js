import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP } from "../src/engine.js";
import { prepareProp } from "../src/props.js";
import { LEAK_LIMIT, leakOutlets, punctureContainer } from "../src/container-leaks.js";
import { updateReactions, surfaceReaction } from "../src/reactions.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";

function lab(kind="canister", angle=0, roll=.9) {
  const w=new World({players:[0,1],shuffle:false,random:()=>roll});
  const b=prepareProp({id:"test-container",kind,x:800,y:700,w:44,h:72,hp:85,maxHp:85,angle,
    ...(kind==="waterTank"?{waterLeft:210}:{})});
  Object.assign(w,{phase:"fight",cover:[b],platforms:[{id:"floor",x:0,y:1200,w:2560,h:30,baseX:0,baseY:1200,dx:0,dy:0}],chunks:[],hazards:[],drops:[],water:[],spills:[],gas:[],projectiles:[]});
  w.arena={...w.arena,spikes:[]};
  for(const p of w.players)Object.assign(p,{x:1900+p.id*150,y:1100});
  return {w,b};
}
function shoot(w,x,y,vx,vy) {
  w.projectiles.push({kind:"bullet",weapon:"blaster",owner:1,x,y,vx,vy,r:3,damage:8,force:20,life:1,bounces:0,hitIds:[]});
  for(let n=0;n<20;n++)w.updateProjectiles(STEP);
}
function step(w,dt=STEP) {w.time+=dt;updateReactions(w,dt);}

test("real bullets puncture the entry side at the hit height, including ignition on the first hit",()=>{
  for(const kind of ["canister","oilBarrel","glueBarrel","tarBarrel","waterTank"])
    for(const side of [-1,1])for(const roll of [.1,.9]) {
      const {w,b}=lab(kind,0,roll),y=b.y+31;
      shoot(w,b.x+b.w/2+side*100,y,-side*1200,0);
      assert.equal(b.leaks.length,1);assert.equal(b.leaks[0].nx,side);
      assert.ok(Math.abs(b.leaks[0].y*b.h-(y-b.y-b.h/2))<.01);
      step(w,.05);
      if(kind==="canister") {
        assert.ok(w.gas.length);assert.ok((w.gas[0].x-b.x-b.w/2)*side>b.w/2);
        assert.ok(w.gas[0].vx*side>0);assert.ok(b.vx*side<0);
        assert.ok(w.gas[0].r<5,"gas starts at the small puncture, then expands");
      } else {
        const q=(kind==="waterTank"?w.water:w.spills)[0];assert.ok(q);
        assert.ok((q.x+q.w/2-b.x-b.w/2)*side>0);
      }
    }
});

test("top, bottom and rotated casing contacts keep the correct outward direction",()=>{
  for(const [angle,vx,vy,nx,ny] of [[0,0,1200,0,-1],[0,0,-1200,0,1],
    [Math.PI/2,1200,0,0,1],[Math.PI/2,-1200,0,0,-1]]) {
    const {w,b}=lab("canister",angle);
    shoot(w,b.x+b.w/2-vx/12,b.y+b.h/2-vy/12,vx,vy);
    assert.equal(b.leaks.length,1);assert.equal(b.leaks[0].nx,nx);assert.equal(b.leaks[0].ny,ny);
    const p=leakOutlets(b)[0];assert.ok(p.nx*vx+p.ny*vy<-1199);
  }
});

test("punctures stay attached while a cylinder translates, rotates and swells",()=>{
  const {w,b}=lab();shoot(w,720,730,1200,0);
  const hole=structuredClone(b.leaks),before=leakOutlets(b)[0];
  b.x+=170;b.y-=90;b.angle=Math.PI/2;b.fuse=.3;
  const after=leakOutlets(b)[0];assert.deepEqual(b.leaks,hole);
  assert.ok(after.ny<-.999);assert.ok(Math.abs(after.x-b.x-b.w/2)<10);
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>100);
  step(w,.05);assert.ok(w.gas[0].y<after.y);assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});

test("both sides can leak, repeated hits reuse holes, and fuel and puncture counts stay bounded",()=>{
  const {w,b}=lab("oilBarrel");
  shoot(w,720,730,1200,0);shoot(w,920,740,-1200,0);
  assert.equal(b.leaks.length,2);assert.deepEqual(b.leaks.map(p=>p.nx),[-1,1]);
  shoot(w,720,730,1200,0);assert.equal(b.leaks.length,2);
  for(let y=710;y<770;y+=3)punctureContainer(b,{x:799,y});
  assert.equal(b.leaks.length,LEAK_LIMIT);
  for(let n=0;n<375;n++)step(w);
  assert.ok(b.spent);assert.ok(b.liquidLeft<.01);
  assert.ok(Math.abs(w.spills.reduce((v,q)=>v+q.w*q.h,0)-96*32)<1e-5);
});

test("cryo seals the existing holes temporarily without relocating them",()=>{
  const {w,b}=lab();shoot(w,720,730,1200,0);const holes=structuredClone(b.leaks);
  surfaceReaction(w,{kind:"frost"},b);const fuse=b.fuse;
  for(let n=0;n<120;n++)step(w);
  assert.equal(w.gas.length,0);assert.equal(b.fuse,fuse);assert.deepEqual(b.leaks,holes);
  for(let n=0;n<200;n++)step(w);
  assert.ok(w.gas.length);assert.deepEqual(b.leaks,holes);
});

test("hot join and interpolated snapshots retain punctures; round reset removes them",async()=>{
  const {w,b}=lab();shoot(w,720,730,1200,0);step(w);
  const render=new RenderSnapshots(),first=render.make(w.snapshot());
  const joined=await decodeState(await encodeState(first));assert.deepEqual(joined.cover[0].leaks,first.cover[0].leaks);
  b.angle=.7;b.x+=90;step(w);const next=render.make(w.snapshot()),mid=interpolateStates(first,next,.5);
  assert.deepEqual(mid.cover[0].leaks,next.cover[0].leaks);assert.ok(validSnapshot(mid));
  const outlet=leakOutlets(mid.cover[0])[0];assert.ok(Number.isFinite(outlet.x+outlet.y));
  w.startRound();assert.ok(w.cover.every(p=>!p.leaks));assert.equal(w.gas.length,0);
});

test("malformed, oversized, off-casing and non-container punctures are rejected",()=>{
  const {w}=lab();shoot(w,720,730,1200,0);const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  for(const mutate of [b=>b.leaks=null,b=>b.leaks=[],b=>b.leaks=Array(5).fill(b.leaks[0]),
    b=>b.leaks[0].x=NaN,b=>b.leaks[0].x=1,b=>b.leaks[0].x=0,b=>b.leaks[0].ny=1,
    b=>b.leaks[0].nx=.5,b=>b.leaks[0].y=Infinity,b=>b.kind="crate"]){
    const next=structuredClone(s);mutate(next.cover[0]);assert.equal(validSnapshot(next),false);
  }
});
