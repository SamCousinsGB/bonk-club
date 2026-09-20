import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS } from '../src/engine.js';
import { addWater, updateReactions } from '../src/reactions.js';
import { WATER_LIMIT, WATER_DEPTH, waterForces } from '../src/liquid.js';
import { prepareProp } from '../src/props.js';
import { waterSurfaces } from '../src/water-art.js';
import { validSnapshot, encodeState, decodeState } from '../src/network.js';
import { RenderSnapshots, interpolateStates } from '../src/render-state.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';

const solid=(id,x,y,w,h,material='stone')=>({id,x,y,w,h,material,baseX:x,baseY:y,dx:0,dy:0});
const parcel=(id,x,y,h,extra={})=>({id,x,y,w:32,h,vx:0,vy:0,grounded:true,frozen:0,spark:0,charge:0,...extra});
const volume=w=>w.water.reduce((n,q)=>n+q.w*q.h,0);
function lab() {
  const w=new World({players:[0,1],shuffle:false,random:()=>.4});
  Object.assign(w,{phase:'fight',platforms:[solid('floor',0,1000,2560,24)],cover:[],chunks:[],water:[],spills:[],gas:[],hazards:[],cables:[],drops:[]});
  w.players.forEach((p,i)=>Object.assign(p,{x:2100+i*100,y:970,vx:0,vy:0}));
  return w;
}
function advance(w,n=1){for(let i=0;i<n;i++){w.time+=.05;updateReactions(w,.05);}}

test('a fast drop crossing a live wire between samples conducts, without storing power after disconnection',()=>{
  const w=lab();w.platforms=[];
  w.hazards=[{type:'powerline',circuit:0,age:8,active:true}];
  w.cables=[{id:'tower0',attached:[true,true],links:[true],points:[{x:700,y:500},{x:1100,y:500}]}];
  w.water=[parcel(1,800,480,4,{grounded:false,vy:1000})];
  advance(w);assert.ok(w.water[0].y>510);assert.equal(w.water[0].charge,1);
  w.cables[0].attached=[false,false];advance(w);assert.equal(w.water[0].charge,0);
});

test('wire water metal water metal forms a live circuit and a drained bridge opens it',()=>{
  const w=lab();w.platforms=[solid('a',640,1000,96,20,'metal'),solid('b',768,1000,96,20,'metal'),solid('base',0,1020,2560,30)];
  w.water=[parcel(1,736,980,40)];w.platforms[0].spark=.7;
  advance(w);assert.equal(w.platforms[1].charge,1);
  w.water=[];advance(w);assert.equal(w.platforms[1].charge,0);
  w.platforms[0].spark=0;advance(w);assert.ok(w.platforms.every(p=>!p.charge));
});

test('a sealed basin accumulates deep water and drains through a destroyed wall with conserved volume',()=>{
  const w=lab();w.platforms.push(solid('left',608,650,32,350),solid('right',832,650,32,350));
  const accepted=addWater(w,720,850,1000);advance(w,80);
  assert.ok(w.water.some(q=>q.h>70));assert.ok(w.water.every(q=>q.x>=640 && q.x<832));
  assert.ok(Math.abs(volume(w)-accepted*32)<1e-6);
  w.platforms=w.platforms.filter(p=>p.id!=='right');advance(w,40);
  assert.ok(w.water.some(q=>q.x>900));assert.ok(Math.abs(volume(w)-accepted*32)<1e-6);
  assert.ok(validSnapshot(w.snapshot()));
});

test('a ruptured large tank admits its finite volume locally with outward momentum exactly once',()=>{
  const w=lab(),tank=prepareProp({id:'tank',kind:'waterTank',x:800,y:776,w:100,h:124,hp:85,maxHp:85,waterLeft:1200});w.cover=[tank];
  w.damageCover(tank,100);
  assert.equal(tank.hp,0);assert.equal(tank.waterLeft,0);assert.equal(volume(w),1200*32);
  assert.ok(w.water.some(q=>q.vx>250));assert.ok(w.water.some(q=>q.vx< -250));
  assert.ok(Math.max(...w.water.map(q=>q.x))-Math.min(...w.water.map(q=>q.x))<500);
  w.damageCover(tank,100);advance(w,30);assert.ok(Math.abs(volume(w)-1200*32)<1e-6);
});

test('a full liquid budget retains unadmitted tank contents instead of deleting them',()=>{
  const w=lab();w.water=Array.from({length:WATER_LIMIT},(_,i)=>parcel(i+1,(i%75)*32,-100+Math.floor(i/75)*60,24,{grounded:false}));
  const tank=prepareProp({id:'tank',kind:'waterTank',x:800,y:776,w:100,h:124,hp:85,maxHp:85,waterLeft:1200});w.cover=[tank];
  const before=volume(w);w.damageCover(tank,100);
  assert.equal(tank.hp,1);assert.ok(tank.waterLeft>0);assert.equal(volume(w)+tank.waterLeft*32,before+1200*32);
});

test('a tank ruptured near the top boundary cannot emit invalid water before the next tick',()=>{
  const w=lab();addWater(w,816,-180,1200,{burst:340});assert.ok(validSnapshot(w.snapshot()));
  assert.ok(w.water.every(q=>q.y>=-200));assert.equal(addWater(w,816,-201,50),0);
});

test('currents wash a fighter into a recoverable knockdown and heavy props resist more than light props',()=>{
  const w=lab(),p=w.players[0];Object.assign(p,{x:816,y:950,vx:0,vy:0});
  w.water=[parcel(1,800,900,100,{vx:600})];
  const light=prepareProp({id:'light',kind:'crate',x:800,y:930,w:32,h:50,hp:100,mass:25});
  const heavy=prepareProp({...light,id:'heavy',mass:200});w.cover=[light,heavy];
  waterForces(w,.05);assert.ok(p.vx>80);assert.ok(p.knockdown>0 && p.knockdown<2);
  assert.ok(light.vx>heavy.vx && heavy.vx>0);assert.ok(p.impactTime>0);
});

test('deep still water damps falling bodies and provides buoyancy without moving a dry fighter',()=>{
  const w=lab(),p=w.players[0],dry=w.players[1];Object.assign(p,{x:816,y:930,vx:200,vy:500});
  w.water=[parcel(1,800,870,130)];const before={vx:dry.vx,vy:dry.vy};
  waterForces(w,.05);assert.ok(p.vy<350);assert.ok(p.vx<200);assert.deepEqual({vx:dry.vx,vy:dry.vy},before);
});

test('a wall stops a tank jet and prevents force or electricity on its dry side',()=>{
  const w=lab();w.platforms.push(solid('wall',864,500,32,500));
  const p=w.players[0];Object.assign(p,{x:928,y:920,vx:0,vy:0});
  addWater(w,816,800,200,{vx:800});advance(w,20);
  assert.ok(w.water.every(q=>q.x<864));assert.equal(p.vx,0);assert.equal(p.soaked||0,0);
});

test('connected water draws one smooth surface, and gaps and frozen cells split it',()=>{
  const qs=[parcel(1,800,950,50),parcel(2,832,960,40),parcel(3,864,955,45)];
  assert.equal(waterSurfaces(qs).length,1);assert.equal(waterSurfaces([qs[0],qs[2]]).length,2);
  qs[1].frozen=7;assert.equal(waterSurfaces(qs).length,2);
});

test('deep moving water and larger tanks survive compressed hot join and interpolation, then reset',async()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.transmission),shuffle:false});w.phase='fight';
  const b=w.cover.find(b=>b.kind==='waterTank');w.damageCover(b,100);advance(w,5);
  const renders=new RenderSnapshots(),a=renders.make(w.snapshot());assert.ok(validSnapshot(a));
  const copy=expandSnapshot(await decodeState(await encodeState(compactSnapshot(a))),validSnapshot);
  assert.deepEqual(copy.water,a.water);assert.deepEqual(copy.cover,a.cover);
  advance(w,2);const view=interpolateStates(a,renders.make(w.snapshot()),.5);assert.ok(validSnapshot(view));
  w.startRound();assert.equal(w.water.length,0);assert.equal(w.cover.filter(b=>b.kind==='waterTank' && b.waterLeft===1200).length,8);
});

test('malformed flow, impossible depths and oversized tanks are rejected',()=>{
  const w=lab();w.water=[parcel(1,800,900,100)];const s=w.snapshot();assert.ok(validSnapshot(s));
  for(const edit of [s=>s.water[0].vx=NaN,s=>s.water[0].vx=901,s=>s.water[0].vy=-601,s=>s.water[0].h=WATER_DEPTH+1]) {
    const bad=structuredClone(s);edit(bad);assert.equal(validSnapshot(bad),false);
  }
  w.cover=[prepareProp({id:'tank',kind:'waterTank',x:800,y:776,w:88,h:124,hp:85,maxHp:85,waterLeft:1200})];
  const bad=structuredClone(w.snapshot());bad.cover[0].waterCapacity=1201;assert.equal(validSnapshot(bad),false);
});

test('upward jets collide with the underside of a ceiling',()=>{
  const w=lab();w.platforms.push(solid('ceiling',600,700,600,12));
  w.water=[parcel(1,800,719,20,{grounded:false,vy:-600})];advance(w);
  assert.ok(w.water[0].y>=712);assert.ok(w.water[0].vy>=0);
});

test('a rising pool overtops a low retaining wall without leaking through its submerged face',()=>{
  const w=lab();w.platforms.push(solid('back',768,700,32,300),solid('sill',832,920,32,80));
  w.water=[parcel(1,800,850,150)];w.reactionSerial=1;const before=volume(w);advance(w,40);
  assert.ok(w.water.some(q=>q.x>=864 && q.h>.5));
  assert.ok(w.water.find(q=>q.x===800).h>=79);assert.ok(Math.abs(volume(w)-before)<1e-6);
  const pools=[parcel(11,608,980,20),parcel(12,640,980,20)];
  assert.equal(waterSurfaces(pools,[solid('divider',639,960,2,40)]).length,2);
});

test('currents carry corpse particles and prediction cannot apply water forces or reactions',()=>{
  const w=lab();w.water=[parcel(1,800,900,100,{vx:600})];
  w.ragdolls=[{points:[{x:816,y:940,px:816,py:940}]}];waterForces(w,.05);
  const p=w.ragdolls[0].points[0];assert.ok(p.px<p.x);assert.ok(p.py>p.y);
  w.prediction=true;const before=structuredClone({water:w.water,ragdolls:w.ragdolls});
  waterForces(w,.05);advance(w);assert.deepEqual({water:w.water,ragdolls:w.ragdolls},before);
});

test('all eight ruptured tower tanks stay bounded with valid quantized snapshots over sustained flooding',()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.transmission),players:[0,1,2,3],shuffle:false});w.phase='fight';
  for(const tank of w.cover.filter(b=>b.kind==='waterTank'))w.damageCover(tank,100);
  const render=new RenderSnapshots();
  for(let i=0;i<240;i++) {advance(w);assert.ok(w.water.length<=WATER_LIMIT);assert.ok(validSnapshot(render.make(w.snapshot())));}
});
