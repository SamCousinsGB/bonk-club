import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP } from "../src/engine.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { cloudBillows, falloutOpacity } from "../src/nuclear-art.js";
import { blackholeField, updateWreckage } from "../src/blackhole.js";
import { updateFields } from "../src/specials.js";
const floor=(id,x,y,w,h=30,extra={})=>({id,x,y,w,h,baseX:x,baseY:y,dx:0,dy:0,...extra});
const contains=(p,x,y)=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h;
function fixture() {
  const w=new World({players:[0,1],shuffle:false,random:()=>.4});
  w.phase="fight";w.cover=[];w.hazards=[];w.drops=[];w.weaponTimer=999;
  w.arena={...w.arena,spikes:[]};
  w.platforms=[floor("rock",200,500,1600,360)];
  return w;
}
const blast=(w,x,y,radius=145)=>w.explode({x,y,radius,damage:0,force:0});

test("ordinary blasts dig cumulative circular craters through thick terrain, with collision outside the cut intact",()=>{
  const w=fixture(), before=structuredClone(w.platforms[0]);
  const blasts=[[700,490,145],[780,600,145],[900,700,205]];
  for(const [x,y,r] of blasts)blast(w,x,y,r);
  for(let y=before.y+1;y<before.y+before.h;y+=11)for(let x=before.x+1;x<before.x+before.w;x+=11){
    const distances=blasts.map(([cx,cy,r])=>Math.hypot(cx-x,cy-y)-r);
    if(distances.some(d=>d<0))assert.ok(!w.solids().some(p=>contains(p,x,y)),`phantom floor ${x},${y}`);
    if(distances.every(d=>d>8))assert.ok(w.solids().some(p=>contains(p,x,y)),`lost exterior ${x},${y}`);
  }
  assert.equal(w.craters.length,0,"ordinary explosions do not produce nuclear clouds");
  assert.equal(w.terrainVersion,3);
});

test("bullets, rail shots, saws and elemental projectiles cannot damage structural terrain",()=>{
  for(const kind of ["bullet","rail","saw","flame","frost","ricochet","force"]){
    const w=fixture();w.players.forEach(p=>p.x=2400);
    const panel=floor("wall",600,400,30,300);
    w.platforms=[panel];const saved=structuredClone(w.platforms);
    for(let n=0;n<8;n++){
      w.projectiles=[{kind,x:540,y:500,vx:3000,vy:0,r:4,damage:500,force:800,life:1,hitIds:[],owner:0,bounces:0}];
      w.updateProjectiles(.04);
    }
    assert.deepEqual(w.platforms,saved,kind);assert.equal(w.terrainVersion,0,kind);
    assert.equal(w.craters.length,0);assert.equal(w.debris.length,0);
  }
});

test("blasts cut lifts, remove nearby trap bodies and spikes, and release supported fighters",()=>{
  const w=fixture();w.arena={...w.arena,spikes:[{x:100,y:730,w:1500}]};
  const lift=floor("lift",500,700,700,30,{travel:200,speed:1,elevator:true});
  const safe=floor("safe",1800,700,200,30,{travel:200,speed:1,elevator:true});
  w.platforms=[lift,safe];
  Object.assign(w.players[0],{x:800,y:670,support:"lift",ground:true});
  w.hazards=[{bodyX:800,bodyY:700,w:90},{bodyX:1900,bodyY:700,w:90}];
  blast(w,800,700);
  assert.equal(w.players[0].ground,false);assert.equal(w.players[0].support,null);
  assert.ok(w.platforms.filter(p=>p!==safe).every(p=>!p.elevator&&!p.travel&&!p.move));
  assert.equal(w.platforms.find(p=>p.id==="safe"),safe);
  assert.equal(w.hazards.length,1);assert.equal(w.hazards[0].bodyX,1900);
  assert.ok(!w.spikes().some(s=>800>s.x&&800<s.x+s.w));
  assert.ok(w.spikes().some(s=>110>s.x&&110<s.x+s.w));
});

test("exploded warped wreckage never rebuilds its collision on the next tick",()=>{
  const w=new World({arena:18,players:[0,1],random:()=>.4});w.phase="fight";
  w.fields=[blackholeField(w,{x:1250,y:750,owner:0})];
  for(let n=0;n<75;n++){w.time+=STEP;updateFields(w,STEP);}
  const tile=w.platforms.find(p=>p.wreckId);assert.ok(tile);
  const id=tile.wreckId;blast(w,tile.x+tile.w/2,tile.y+tile.h/2,80);
  updateWreckage(w,STEP);
  assert.ok(!w.wreckage.some(p=>p.id===id));assert.ok(!w.platforms.some(p=>p.wreckId===id));
});

test("late join receives carved platforms and spikes; malformed geometry is rejected and the next round restores everything",async()=>{
  const w=fixture(), wire=new RenderSnapshots();
  w.arena={...w.arena,spikes:[{x:100,y:520,w:1500}]};
  const old=wire.make(w.snapshot());blast(w,700,520);
  const state=wire.make(w.snapshot());
  assert.ok(validSnapshot(state));
  const guest=await decodeState(await encodeState(state));
  assert.deepEqual(guest.platforms,JSON.parse(JSON.stringify(state.platforms)));assert.deepEqual(guest.spikes,JSON.parse(JSON.stringify(state.spikes)));
  assert.deepEqual(interpolateStates(old,state,.5).platforms,state.platforms);
  assert.deepEqual(interpolateStates(old,state,.5).spikes,state.spikes);
  for(const mutate of [s=>s.spikes[0].w=-1,s=>s.spikes[0].x=Infinity,s=>s.platforms[0].sourceId={},s=>s.platforms.push(s.platforms[0])]){
    const invalid=structuredClone(state);mutate(invalid);assert.equal(validSnapshot(invalid),false);
  }
  w.startRound();assert.equal(w.spikeTerrain,null);assert.equal(w.terrainSerial,0);
  assert.ok(w.platforms.every(p=>!p.sourceId));
});

test("every platform in every arena can be carved, including structural walls, steps and lifts",()=>{
  for(let arena=0;arena<ARENAS.length;arena++){
    const template=new World({arena});
    for(const source of template.platforms){
      const w=fixture();w.platforms=[structuredClone(source)];
      const x=source.x+source.w/2,y=source.y+source.h/2;
      blast(w,x,y,90);
      assert.ok(!w.platforms.some(p=>contains(p,x,y)),`${ARENAS[arena].name}: ${source.id}`);
    }
  }
});

test("repeated small explosions stay within transport limits on all arenas",()=>{
  let peak=0;const wire=new RenderSnapshots();
  for(let arena=0;arena<ARENAS.length;arena++){
    const w=new World({arena,players:[0,1],random:()=>.4});
    for(let n=0;n<160;n++){
      blast(w,80+(n*397)%2400,100+(n*283)%1320, n%3?145:205);
      w.events=w.events.slice(-30);w.time+=.05;
      peak=Math.max(peak,w.platforms.length);
      assert.ok(validSnapshot(wire.make(w.snapshot())),`${ARENAS[arena].name} blast ${n}: ${w.platforms.length}`);
      assert.ok(w.platforms.every(p=>p.id.length<60));
    }
  }
  assert.ok(peak<800,`peak fragments ${peak}`);
});

test("the nuclear cloud rises and spreads, stays bounded and fully dissipates",()=>{
  const early=cloudBillows(.5,480),late=cloudBillows(3,480);
  const top=p=>Math.min(...p.map(b=>b.y-b.size/2));
  const width=p=>Math.max(...p.map(b=>b.x+b.size/2))-Math.min(...p.map(b=>b.x-b.size/2));
  assert.ok(top(late)<top(early)-180);assert.ok(width(late)>width(early));
  for(let age=0;age<13;age+=.1){
    const puffs=cloudBillows(age,480);assert.ok(puffs.length<=70);
    assert.ok(puffs.every(p=>[p.x,p.y,p.size,p.alpha,p.heat].every(Number.isFinite)&&p.alpha>=0&&p.alpha<=1));
  }
  assert.deepEqual(cloudBillows(12,480),[]);assert.equal(falloutOpacity(12),0);
});
