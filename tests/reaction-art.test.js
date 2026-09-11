import test from "node:test";
import assert from "node:assert/strict";
import { fallingWaterStrands, WaterImpacts } from "../src/water-art.js";
import { visibleCircuit, arcPoints, CIRCUIT_NODE_LIMIT, CIRCUIT_LINK_LIMIT } from "../src/electricity-art.js";
import { World } from "../src/engine.js";
import { addWater, updateReactions } from "../src/reactions.js";
import { prepareProp } from "../src/props.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";

const parcel=(id,x=800,y=990,extra={})=>({id,x,y,w:32,h:10,vy:0,grounded:true,frozen:0,charge:1,spark:0,...extra});
const state=water=>({water,cover:[],chunks:[],platforms:[],hazards:[],players:[],time:1,round:1,arenaIndex:0});
const metal=(id,x,y,extra={})=>prepareProp({id,kind:"cabinet",x,y,w:50,h:100,hp:85,charge:1,...extra});

test("falling water stretches vertically with speed and breaks into unequal attached strands",()=>{
  const q=parcel(1,800,500,{h:24,grounded:false,vy:100}),before=structuredClone(q);
  const slow=fallingWaterStrands(q,1),fast=fallingWaterStrands({...q,vy:900},1);
  assert.deepEqual(q,before);
  assert.ok(fast.length<=5);
  assert.ok(fast.every((s,i)=>s.length>slow[i].length && s.length>2*s.radius));
  assert.ok(new Set(fast.map(s=>s.bottom)).size>2);
  assert.ok(fast.every(s=>s.bottom<=q.y+q.h && s.x>q.x && s.x<q.x+q.w));
  assert.notDeepEqual(fast,fallingWaterStrands({...q,vy:900},1.05));
});

test("impact splashes only follow observed landings and reset on hot join, stalls and rounds",()=>{
  const tracker=new WaterImpacts(),s=state([parcel(1,800,900,{grounded:false,vy:500})]);
  assert.equal(tracker.update(s).length,0);
  s.time+=.05;s.water=[parcel(1)];assert.equal(tracker.update(s).length,1);
  assert.equal(tracker.update(s).length,1);
  s.time+=.05;s.round++;assert.equal(tracker.update(s).length,0);
  assert.equal(new WaterImpacts().update(s).length,0);
  s.time+=1;assert.equal(tracker.update(s).length,0);
});

test("electrical artwork follows a connected water-metal chain and removes disconnected or frozen matter",()=>{
  const w=state([parcel(1,800),parcel(2,832),parcel(3,864)]);
  const b=metal("bridge",896,900),end=metal("end",946,900);w.cover=[b,end];
  const first=visibleCircuit(w);assert.equal(first.links.length,4);
  b.y-=200;assert.equal(visibleCircuit(w).links.length,2);
  w.water[1].charge=0;assert.equal(visibleCircuit(w).links.length,0);
  w.water[0].frozen=7;assert.ok(!visibleCircuit(w).nodes.includes(w.water[0]));
});

test("visible arcs cannot bridge a separating wall or an empty rotated metal corner",()=>{
  const w=state([parcel(1,800),parcel(2,832)]);
  w.platforms=[{id:"wall",x:831,y:940,w:2,h:60}];assert.equal(visibleCircuit(w).links.length,0);
  w.water=[];w.platforms=[];
  w.cover=[metal("rotated",100,100,{w:100,h:10,angle:Math.PI/4}),metal("corner",114,131,{w:8,h:8})];
  assert.equal(visibleCircuit(w).links.length,0);
});

test("arc channels keep contacts pinned while evolving continuously, with bounded geometry",()=>{
  const a={x:0,y:0},b={x:400,y:80},first=arcPoints(a,b,1,12),next=arcPoints(a,b,1.001,12);
  assert.deepEqual(first[0],a);assert.deepEqual(first.at(-1),b);assert.ok(first.length<=37);
  assert.notDeepEqual(first,next);
  assert.ok(first.every((p,i)=>Math.hypot(p.x-next[i].x,p.y-next[i].y)<2));
  const w=state(Array.from({length:192},(_,i)=>parcel(i+1,(i%60)*32,600+Math.floor(i/60)*40)));
  w.cover=Array.from({length:192},(_,i)=>metal(`m${i}`,i*10,900));
  const before=structuredClone(w),c=visibleCircuit(w);
  assert.ok(c.nodes.length<=CIRCUIT_NODE_LIMIT&&c.links.length<=CIRCUIT_LINK_LIMIT);
  assert.deepEqual(w,before);
});

test("live visual circuit follows host power expiry and damage without inventing stored charge",()=>{
  const w=new World();w.phase="fight";w.water=[];w.cover=[];w.chunks=[];w.hazards=[];
  w.platforms=[{id:"floor",x:0,y:1000,w:2560,h:30}];
  addWater(w,800,999,60);for(let i=0;i<8;i++)updateReactions(w,.05);
  w.water[0].spark=.3;updateReactions(w,.05);
  const rs=new RenderSnapshots(),s=rs.make(w.snapshot());assert.ok(visibleCircuit(s).links.length>0);
  for(let i=0;i<8;i++)updateReactions(w,.05);
  assert.equal(visibleCircuit(rs.make(w.snapshot())).nodes.length,0);
});

test("guest water lands on its floor and blends pool depth without floating bars or moving frozen collision",()=>{
  const w=new World(),rs=new RenderSnapshots();
  w.water=[parcel(1,800,900,{grounded:false,vy:400})];const a=rs.make(w.snapshot());
  Object.assign(w.water[0],{y:990,vy:0,grounded:true});const b=rs.make(w.snapshot());
  const landing=interpolateStates(a,b,.5);assert.equal(landing.water[0].y,990);assert.ok(validSnapshot(landing));
  Object.assign(w.water[0],{y:980,h:20});const c=rs.make(w.snapshot()),pool=interpolateStates(b,c,.5).water[0];
  assert.equal(pool.h,15);assert.equal(pool.y+pool.h,1000);
  w.water[0].frozen=7;const d=rs.make(w.snapshot());assert.deepEqual(interpolateStates(c,d,.5).water[0],d.water[0]);
});
