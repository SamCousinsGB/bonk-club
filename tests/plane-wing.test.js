import test from 'node:test';
import assert from 'node:assert/strict';
import { World,ARENAS,STEP,cleanInput } from '../src/engine.js';
import { updatePlane,planePose,planeLocalPoint,planeForces,cachedPlaneBreaches } from '../src/plane.js';
import { PlaneHullLayer } from '../src/plane-art.js';
import { carveExplosion } from '../src/terrain.js';
import { RenderSnapshots } from '../src/render-state.js';
import { compactSnapshot,expandSnapshot } from '../src/snapshot-wire.js';
import { validSnapshot } from '../src/network.js';
import { GuestPrediction } from '../src/guest-prediction.js';
import { BotController } from '../src/bots.js';
const fixture=()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.cargoPlane),players:[0,1],shuffle:false,random:()=>.4});
  w.phase='fight';w.weaponTimer=w.grenadeTimer=999;
  return {w,h:w.hazards.find(h=>h.type==='airflow')};
};
const cut=(w,side)=>carveExplosion(w,{x:side<0?460:2100,y:748,radius:125});

test('only a through-cut severs a wing: dents and unrelated cabin explosions remain flyable',()=>{
  const {w,h}=fixture();
  for(const blast of [{x:1280,y:660,radius:100},{x:350,y:690,radius:32}]) {
    carveExplosion(w,blast);updatePlane(w,h,STEP);assert.equal(h.failedAt,-1);
  }
  cut(w,-1);updatePlane(w,h,STEP);
  assert.equal(h.failedAt,h.age);assert.equal(h.rollDir,-1);assert.equal(h.rightWingAt,-1);
  assert.ok(w.platforms.some(p=>p.planeWing===-1&&p.wingLoose));
  assert.ok(w.platforms.filter(p=>p.planeWing===1).every(p=>!p.wingLoose));
  const started=h.failedAt;updatePlane(w,h,STEP);assert.equal(h.failedAt,started);
});

test('either severed wing rolls through upside down and continues into a spiral without losing the cabin or aim',()=>{
  for(const side of [-1,1]) {
    const {w,h}=fixture();cut(w,side);updatePlane(w,h,STEP);
    assert.equal(h.rollDir,side);
    let inverted=false;
    for(let t=0;t<12;t+=.05)for(const reduced of [false,true]) {
      const age=h.failedAt+t,p=planePose(age,reduced,h),c=Math.cos(p.angle),s=Math.sin(p.angle);
      if(Math.cos(p.angle)<-.99)inverted=true;
      for(let i=0;i<64;i++) {
        const x=830*Math.cos(i*Math.PI/32),y=594*Math.sin(i*Math.PI/32);
        const screen={x:1280+p.x+p.scale*(x*c-y*s),y:710+p.y+p.scale*(x*s+y*c)};
        assert.ok(screen.x>0&&screen.x<2560&&screen.y>0&&screen.y<1440);
        const q=planeLocalPoint(screen,age,reduced,h);
        assert.ok(Math.hypot(q.x-1280-x,q.y-710-y)<1e-8);
      }
    }
    assert.ok(inverted);assert.ok(Math.abs(planePose(h.failedAt+10,false,h).angle)>Math.PI*4);
    assert.ok(planeForces(h.failedAt+3.3,h).y < -2500,'gravity reverses in the inverted cabin');
  }
});

test('falling wings retain collision, engines follow them, subsequent blasts do not teleport cut sections',()=>{
  const {w,h}=fixture();cut(w,-1);updatePlane(w,h,STEP);
  const wing=w.platforms.find(p=>p.wingLoose),engine=w.hazards.find(p=>p.type==='turbine'&&p.planeWing===-1);
  const x=wing.x,y=wing.y,ey=engine.bodyY;
  h.age+=.5;w.movePlatforms();
  assert.ok(wing.x<x&&wing.y>y&&engine.bodyY>ey);assert.ok(w.solids().some(p=>p.id===wing.id));
  carveExplosion(w,{x:wing.x+wing.w-20,y:wing.y+15,radius:35});
  const pieces=w.platforms.filter(p=>p.wingLoose).map(p=>({id:p.id,x:p.x,y:p.y}));
  h.age+=STEP;w.movePlatforms();
  for(const old of pieces) {
    const p=w.platforms.find(p=>p.id===old.id);assert.ok(Math.abs(p.x-old.x)<2&&Math.abs(p.y-old.y)<5);
  }
  h.age+=6;w.movePlatforms();assert.ok(!w.platforms.some(p=>p.wingLoose));assert.equal(engine.done,true);
});

test('wing failure, fallen geometry and spiral phase survive compact hot join and reset',()=>{
  const {w,h}=fixture();cut(w,1);updatePlane(w,h,STEP);h.age+=1.7;w.movePlatforms();
  const encoded=new RenderSnapshots().make(w.snapshot());
  const joined=expandSnapshot(compactSnapshot(encoded),validSnapshot);
  assert.ok(joined);assert.deepEqual(joined.platforms,encoded.platforms);
  assert.deepEqual(planePose(joined.hazards[0].age,false,joined.hazards[0]),planePose(encoded.hazards[0].age,false,encoded.hazards[0]));
  for(const [key,value] of [['failedAt',NaN],['rollDir',3],['leftWingAt',Infinity]]) {
    const bad=structuredClone(encoded);bad.hazards[0][key]=value;assert.equal(validSnapshot(bad),false);
  }
  const bad=structuredClone(encoded);bad.platforms.find(p=>p.planeWing).planeWing=9;assert.equal(validSnapshot(bad),false);
  w.startRound();assert.equal(w.hazards[0].failedAt,-1);assert.ok(!w.platforms.some(p=>p.wingLoose));assert.ok(validSnapshot(w.snapshot()));
});

test('guest movement agrees with host gravity during a spiral without mutating received state',()=>{
  const {w,h}=fixture();cut(w,-1);updatePlane(w,h,STEP);h.age=3;w.time=3;
  Object.assign(w.players[1],{x:1280,y:710,vx:0,vy:0,ground:false,rig:null});
  const state={...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]},saved=structuredClone(state);
  const guest=new GuestPrediction();guest.receive(state,1,1000);guest.advance(cleanInput({}),1,1017);
  for(let i=0;i<2;i++){w.time+=STEP;w.movePlatforms();w.move(w.players[1],cleanInput({}),STEP);updatePlane(w,h,STEP);}
  assert.ok(Math.abs(guest.player.vx-w.players[1].vx)<.2);assert.ok(Math.abs(guest.player.vy-w.players[1].vy)<.2);
  assert.deepEqual(state,saved);
});

test('prediction collision drops falling wing sections when they leave the arena',()=>{
  const {w,h}=fixture();cut(w,-1);updatePlane(w,h,STEP);h.age=w.time=2.7;w.movePlatforms();
  const state={...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]};
  const guest=new GuestPrediction();guest.receive(state,1,1000);
  const count=guest.context.platforms.filter(p=>p.wingLoose).length;assert.ok(count>0);
  for(let seq=1;seq<=14;seq++) {
    guest.advance(cleanInput({}),seq,1000+seq*1000/60);
    assert.deepEqual(guest.context.solids(guest.player),World.prototype.solids.call(guest.context,guest.player));
  }
  assert.ok(guest.context.platforms.filter(p=>p.wingLoose).length<count);
});

test('unchanged snapshot clones reuse breach rays and hull texture; damage invalidates both',()=>{
  const {w}=fixture(),first=cachedPlaneBreaches(w.platforms);
  assert.equal(cachedPlaneBreaches(structuredClone(w.platforms)),first);
  let draws=0;
  const ctx=new Proxy({}, {get:(_,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{draws++;}});
  const layer=new PlaneHullLayer(),canvas={getContext:()=>ctx},target={drawImage(){}};
  layer.draw(target,w.platforms,()=>canvas);const before=draws;
  layer.draw(target,structuredClone(w.platforms));assert.equal(draws,before);
  cut(w,1);assert.notEqual(cachedPlaneBreaches(w.platforms),first);
  layer.draw(target,w.platforms);assert.ok(draws>before);
});

test('plane navigation yields inside a flight search, prioritising playable decks over curved hull strips',()=>{
  const {w}=fixture();w.players.forEach(p=>p.bot=true);
  const bots=new BotController();bots.prepare(w);
  assert.ok(bots.pendingNavigation,'the initial search must not block until a whole landing is finished');
  assert.equal(bots.graph.size,0);
});
