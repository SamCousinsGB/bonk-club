import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from '../src/puppet.js';
import { World,ARENAS,STEP } from '../src/engine.js';
import { updateWaterworks,resetWaterworks,waterworksOutlet,generatorPhase } from '../src/waterworks.js';
import { WATERWORKS_PIPES } from '../src/waterworks-arena.js';
import { updateReactions } from '../src/reactions.js';
import { moveLiquid,WATER_LIMIT } from '../src/liquid.js';
import { carveExplosion } from '../src/terrain.js';
import { swimmingWaterAt,swimPlayer,shipSwimControls } from '../src/ship.js';
import { RenderSnapshots } from '../src/render-state.js';
import { validSnapshot,encodeState,decodeState } from '../src/network.js';
import { compactSnapshot,expandSnapshot } from '../src/snapshot-wire.js';
import { GuestPrediction } from '../src/guest-prediction.js';

const index=ARENAS.findIndex(a=>a.waterworks);
const volume=w=>w.water.reduce((n,q)=>n+q.h*q.w,0);
function world(){const w=new World({players:[0,1],arena:index,shuffle:false,random:()=>.4});w.phase='fight';return w;}

test('Waterworks starts with a broad deep pool, six working outlets, eight physical generators and clear spawns',()=>{
  const w=world();assert.equal(w.arena.name,'WATERWORKS');assert.equal(w.cover.filter(b=>b.kind==='generator').length,8);
  assert.equal(w.water.length,38);assert.ok(w.water.every(q=>q.h===200&&q.grounded));
  assert.ok(WATERWORKS_PIPES.every((_,i)=>waterworksOutlet(w.platforms,i)));
  for(const p of w.players)assert.ok(!w.solids().some(s=>s.x<p.x+16&&s.x+s.w>p.x-16&&s.y<p.y+28&&s.y+s.h>p.y-28));
  const initial=volume(w);updateWaterworks(w,.05);
  assert.ok(Math.abs(volume(w)-initial-750*.05*32)<1e-7);
  assert.ok(validSnapshot(w.snapshot()));
});
test('damaged pipe throats stop emitting and existing water keeps falling; reset restores every source',()=>{
  const w=world(),p=WATERWORKS_PIPES[2];
  updateWaterworks(w,.05);const falling=w.water.find(q=>q.x===1152&&q.y<600),y=falling.y;
  carveExplosion(w,{x:p.x,y:p.y-10,radius:55});assert.equal(waterworksOutlet(w.platforms,2),false);
  const before=volume(w);updateWaterworks(w,.05);
  assert.ok(Math.abs(volume(w)-before-600*.05*32)<1e-7);
  moveLiquid(w,.05);assert.ok(falling.y>y);
  w.startRound();assert.ok(waterworksOutlet(w.platforms,2));assert.equal(volume(w),38*200*32);
});
test('mains flood continuously within the shared budget and a breached basin loses real water',()=>{
  const w=world(),initial=volume(w);w.players.forEach(p=>p.alive=false);
  for(let i=0;i<180;i++){w.elapsed=i*.05;updateReactions(w,.05);}
  assert.ok(volume(w)>initial+100000);assert.ok(w.water.length<=WATER_LIMIT);assert.ok(w.water.some(q=>q.grounded&&q.h>210));
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
  // Shut every main by removing its throat, then cut the bottom of the basin.
  w.platforms=w.platforms.filter(p=>p.waterworksPipe===undefined);
  carveExplosion(w,{x:1280,y:1340,radius:230});const full=volume(w);
  for(let i=0;i<280;i++)moveLiquid(w,.05);
  assert.ok(volume(w)<full*.8);assert.ok(w.water.every(q=>q.y<1520));
});
test('generator warning is safe; live generators energise connected pool water and destruction removes power',()=>{
  const w=world();w.players.forEach(p=>p.alive=false);
  assert.equal(generatorPhase(7.5),'warning');w.elapsed=7.5;updateReactions(w,.05);assert.ok(w.water.every(q=>!q.charge));
  w.elapsed=8.5;updateReactions(w,.05);assert.ok(w.water.filter(q=>q.grounded).some(q=>q.charge));
  const p=w.players[0],q=w.water.find(q=>q.grounded&&q.charge);Object.assign(p,{alive:true,x:q.x+16,y:q.y+80,shockWait:0});
  updateReactions(w,.05);assert.ok(p.hp<100);assert.ok(p.soaked>0);
  w.cover=w.cover.filter(b=>b.kind!=='generator');
  updateReactions(w,.05);updateReactions(w,.05);assert.ok(w.water.every(q=>!q.charge));
});
test('pool swimming, oxygen and escape controls use real water and never let prediction damage a fighter',()=>{
  const w=world(),p=w.players[0];Object.assign(p,{x:1280,y:1240,rig:undefined,vx:0,vy:0,oxygen:12});
  assert.ok(swimmingWaterAt(w,p.x,p.y));assert.ok(shipSwimControls(w,p));
  swimPlayer(w,p,{attack:true,aim:-Math.PI/2},.05);assert.ok(p.swimming&&p.submerged&&p.vy<0);assert.ok(p.oxygen<12);
  w.prediction=true;p.oxygen=0;const hp=p.hp;swimPlayer(w,p,{attack:true,aim:0},.05);assert.equal(p.hp,hp);
  w.prediction=false;swimPlayer(w,p,{},.05);assert.ok(p.hp<hp);
  w.water=[];swimPlayer(w,p,{},.05);assert.equal(p.swimming,false);assert.equal(p.submerged,false);assert.ok(p.oxygen>0);
});
test('flooding, cut outlets and generator removal survive compressed hot join and guest swimming',async()=>{
  const w=world();for(let i=0;i<20;i++)updateReactions(w,.05);
  carveExplosion(w,{x:800,y:750,radius:80});w.cover=w.cover.filter(b=>b.id!=='cover0');
  const p=w.players[0];Object.assign(p,{x:1280,y:1240,rig:undefined});
  // Use a normal rig in the transmitted snapshot at the submerged location.
  p.rig=makeRig(p);
  const s={...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]};assert.ok(validSnapshot(s));
  const copy=expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))),validSnapshot);
  assert.deepEqual(copy.water,JSON.parse(JSON.stringify(s.water)));assert.deepEqual(copy.platforms,JSON.parse(JSON.stringify(s.platforms)));assert.deepEqual(copy.cover,JSON.parse(JSON.stringify(s.cover)));
  assert.equal(waterworksOutlet(copy.platforms,1),false);
  const guest=new GuestPrediction();guest.receive(copy,0,1000);const water=JSON.stringify(guest.context.water),hp=guest.player.hp;
  guest.step({attack:true,aim:-Math.PI/2});assert.equal(guest.player.swimming,true);assert.ok(guest.player.vy<0);
  assert.equal(JSON.stringify(guest.context.water),water);assert.equal(guest.player.hp,hp);
  w.startRound();assert.equal(w.cover.filter(b=>b.kind==='generator').length,8);assert.equal(volume(w),38*200*32);
});

test('pipe identity is validated and unrelated rubble cannot restart a destroyed outlet',()=>{
  const w=world(),p=WATERWORKS_PIPES[0],s=w.snapshot();
  for(const value of [-1,6,NaN,'0']){
    const bad=structuredClone(s);bad.platforms.find(p=>p.waterworksPipe===0).waterworksPipe=value;
    assert.equal(validSnapshot(bad),false);
  }
  const bad=structuredClone(s);bad.arenaIndex=0;assert.equal(validSnapshot(bad),false);
  w.platforms=w.platforms.filter(p=>p.waterworksPipe!==0);
  w.platforms.push({x:p.x-40,y:p.y-146,w:80,h:146,material:'stone'});
  assert.equal(waterworksOutlet(w.platforms,0),false);
});

test('perforated Waterworks catwalks pass water through instead of supporting separate vertical pools',()=>{
  const w=world();w.players.forEach(p=>p.alive=false);
  for(let i=0;i<600;i++){w.time+=.05;w.elapsed=i*.05;w.updateCover(.05);updateReactions(w,.05);}
  const grates=w.platforms.filter(p=>p.oneWay);
  assert.ok(w.water.filter(q=>q.grounded).every(q=>!grates.some(p=>Math.abs(q.y+q.h-p.y)<.1)));
  assert.ok(w.water.filter(q=>q.grounded&&q.x>=672&&q.x<1888).every(q=>q.h<440));
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});
