import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS } from '../src/engine.js';
import { moveLiquid, liquidForces, blastLiquid, WATER_LIMIT } from '../src/liquid.js';
import { liquidColumns } from '../src/liquid-spatial.js';
import { WaterImpacts, drawWater } from '../src/water-art.js';
import { RenderSnapshots } from '../src/render-state.js';
import { validSnapshot, encodeState, decodeState } from '../src/network.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';

const parcel=(id,x,y,h,extra={})=>({id,x,y,w:32,h,vx:0,vy:0,grounded:true,frozen:0,spark:0,charge:0,fallDistance:0,...extra});
const volume=w=>[...w.water,...w.spills].reduce((n,q)=>n+q.w*q.h,0);
function lab() {
  const w=new World({players:[0,1],shuffle:false});w.phase='fight';
  Object.assign(w,{arena:{},platforms:[{id:'floor',x:0,y:1000,w:2560,h:24}],water:[],spills:[],cover:[],chunks:[],drops:[],ragdolls:[],reactionSerial:20});
  w.players.forEach(p=>Object.assign(p,{x:2200,y:600}));return w;
}

test('liquid broad phase contains swept neighbours without scanning distant terrain or duplicating a wide floor',()=>{
  const platforms=Array.from({length:1000},(_,i)=>({x:(i%50)*50,y:Math.floor(i/50)*60,w:12,h:20}));
  const floor={x:-20,w:2600,y:1400,h:20};platforms.push(floor);
  const index=liquidColumns(platforms,undefined,80);
  assert.ok(index.at(1200).length<platforms.length/5);
  for(let x=0;x<2560;x+=17)for(const p of platforms)if(p.x<=x+80&&p.x+p.w>=x-80)assert.ok(index.at(x).includes(p));
  assert.equal([...index.between(900,1300)].filter(p=>p===floor).length,1);
});

test('a falling jet joins the pool surface conservatively and retains horizontal momentum',()=>{
  const w=lab(),pool=parcel(1,800,800,200),jet=parcel(2,800,772,8,{grounded:false,vy:600,vx:180});
  w.platforms.push({x:768,y:650,w:32,h:350},{x:832,y:650,w:32,h:350});
  w.water=[pool,jet];const before=volume(w);moveLiquid(w,.05);
  assert.ok(!w.water.includes(jet));assert.ok(pool.h>200);assert.ok(pool.vx>0);
  assert.ok(Math.abs(volume(w)-before)<1e-7);assert.equal(pool.y+pool.h,1000);
});

test('intervening solid geometry intercepts a jet before the water below it',()=>{
  const w=lab(),pool=parcel(1,800,850,150),jet=parcel(2,800,775,8,{grounded:false,vy:600});
  w.platforms.push({x:760,y:800,w:160,h:12});w.water=[pool,jet];
  moveLiquid(w,.05);assert.ok(w.water.some(q=>q.grounded&&Math.abs(q.y+q.h-800)<.1));
});

test('explosions eject finite pool volume, create opposing currents and carry hot or conductive liquid',()=>{
  for(const kind of [undefined,'oil','molten']) {
    const w=lab();const qs=Array.from({length:5},(_,i)=>parcel(i+1,736+i*32,850,150,kind?{kind,life:20,fire:kind==='oil'?3:0,cold:0}:{spark:.6}));
    w[kind?'spills':'water']=qs;const before=volume(w);blastLiquid(w,{x:816,y:880,radius:180});
    const all=[...w.water,...w.spills];assert.ok(Math.abs(volume(w)-before)<1e-7);
    assert.ok(all.some(q=>!q.grounded&&q.vy<-200));assert.ok(qs[0].vx<0&&qs.at(4).vx>0);
    assert.ok(all.filter(q=>!q.grounded).every(q=>q.kind===kind));
    if(kind==='oil')assert.ok(all.every(q=>q.fire===3));
  }
});

test('walls shield liquid from blasts and a full simulation budget never loses splash volume',()=>{
  const w=lab();w.water=[parcel(1,800,850,150)];w.platforms.push({x:768,y:650,w:20,h:350});
  const before=structuredClone(w.water);blastLiquid(w,{x:730,y:900,radius:200});assert.deepEqual(w.water,before);
  w.platforms.length=1;w.water=Array.from({length:WATER_LIMIT},(_,i)=>parcel(i+1,800,850,150));
  const amount=volume(w);blastLiquid(w,{x:816,y:900,radius:200});assert.equal(w.water.length,WATER_LIMIT);assert.equal(volume(w),amount);
});

test('moving and plunging bodies entrain water and splash while dry bodies cannot disturb it',()=>{
  const w=lab(),p=w.players[0];w.water=[parcel(1,800,900,100)];
  Object.assign(p,{x:816,y:887,vx:300,vy:500});const before=volume(w);
  liquidForces(w,.05);assert.ok(w.water[0].vx>0);assert.ok(w.water.some(q=>!q.grounded));
  assert.ok(Math.abs(volume(w)-before)<1e-7);assert.ok(p.vy<500);
  const dry=lab();dry.water=[parcel(1,800,900,100)];liquidForces(dry,.05);assert.equal(dry.water[0].vx,0);assert.equal(dry.water.length,1);
});

test('prediction never ejects volume or applies body wakes',()=>{
  const w=lab();w.prediction=true;w.water=[parcel(1,800,900,100)];const before=structuredClone(w.water);
  blastLiquid(w,{x:816,y:920,radius:150});liquidForces(w,.05);moveLiquid(w,.05);assert.deepEqual(w.water,before);
});

test('blasted water survives compressed hot join and resets without new wire fields',async()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.waterworks),players:[0,1],shuffle:false});w.phase='fight';
  blastLiquid(w,{x:1280,y:1160,radius:200});const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  const copy=expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))),validSnapshot);
  assert.deepEqual(copy.water,s.water);assert.ok(copy.water.some(q=>!q.grounded&&q.vy<0));
  w.startRound();assert.ok(w.water.every(q=>q.grounded&&q.h===200));
});

test('surface absorption produces bounded impact foam, and a new viewer does not invent impacts',()=>{
  const tracker=new WaterImpacts(),state={time:1,round:1,arenaIndex:0,players:[],water:[parcel(1,800,800,200),parcel(2,800,760,8,{grounded:false,vy:600})]};
  assert.equal(tracker.update(state).length,0);state.time+=.05;state.water.pop();state.water[0].y-=8;state.water[0].h+=8;
  assert.equal(tracker.update(state).length,1);assert.equal(new WaterImpacts().update(state).length,0);
  state.round++;assert.equal(tracker.update(state).length,0);
});

test('liquid artwork is read-only and reduced motion renders the same still pool at different times',()=>{
  const state={time:1,round:1,arenaIndex:0,platforms:[],players:[],water:[parcel(1,800,800,200,{vx:200})]};
  const before=structuredClone(state),commands=[];
  const c=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get(o,k){return o[k]??((...args)=>commands.push([k,...args]));},set(o,k,v){o[k]=v;return true;}});
  drawWater(c,state,0,true);const a=structuredClone(commands);commands.length=0;state.time=1.1;drawWater(c,state,0,true);
  assert.deepEqual(commands,a);state.time=1;assert.deepEqual(state,before);
});
