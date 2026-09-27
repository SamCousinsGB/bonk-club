import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {COLOSSUS,colossusPhase,colossusPoint,colossusEye,colossusBeam,colossusBeams,beamX,updateColossus,carveColossusBeam} from '../src/colossus.js';
import {carveExplosion} from '../src/terrain.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
import {prepareProp} from '../src/props.js';
import {botDanger} from '../src/bot-danger.js';
import {navigation,routesFrom,surfaceAt} from '../src/navigation.js';
import {firePhaser} from '../src/phaser.js';
import {nuclearField,updateNuclear} from '../src/nuclear.js';
import {blackholeField,updateBlackhole} from '../src/blackhole.js';
import {makeRig} from '../src/puppet.js';

function fixture(){const w=new World({arena:ARENAS.findIndex(a=>a.colossus),players:[0,1,2,3],shuffle:false,random:()=>.42});w.phase='fight';return w;}
function advance(w,seconds){for(let n=0;n<Math.round(seconds/STEP);n++){w.time+=STEP;updateColossus(w,w.hazards[0],STEP);}}
function transport(w){return expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);}

test('colossus terraces connect every spawn to contested weapons with the distant mech above play',()=>{
  const w=fixture(),solids=w.solids(),graph=navigation(solids,{time:0,spikes:[]});
  assert.ok(w.platforms.every(p=>p.y>=870));
  for(const p of w.players){
    const paths=routesFrom(graph,solids,surfaceAt(solids,p),p.x,new Map(),0);
    for(const [x,y] of w.arena.weapons)assert.ok(paths.has(surfaceAt(solids,{x,y})?.id),`${p.id} -> ${x},${y}`);
    assert.equal(p.weapon,null);
  }
  assert.ok(validSnapshot(w.snapshot()));
});

test('gaze has mechanical lag, stays bounded, and follows players without moving the locked attack',()=>{
  const w=fixture(),h=w.hazards[0],start=colossusEye(h);
  w.players.forEach(p=>{p.x=2300;p.y=1000;});advance(w,.1);
  assert.ok(h.gazeX>1280&&h.gazeX<1282);
  assert.ok(colossusEye(h).x-start.x<.1);
  advance(w,12);assert.ok(h.gazeX>2050&&h.gazeX<2300);
  h.age=COLOSSUS.wake-STEP;advance(w,STEP);const target=h.strikeX;
  w.players.forEach(p=>p.x=200);advance(w,9);
  assert.equal(h.strikeX,target);assert.ok(h.gazeX<1800);
  assert.ok(h.warning>0&&!h.active);assert.ok(validSnapshot(transport(w)));
});

test('ten second charge does no damage or terrain edits, then lethal contact respects the visible beam',()=>{
  const w=fixture(),h=w.hazards[0];h.age=COLOSSUS.wake;h.strikeX=1280;
  const original=structuredClone(w.platforms);advance(w,COLOSSUS.charge-STEP);
  assert.ok(h.warning>0&&!h.active);assert.deepEqual(w.platforms,original);
  assert.ok(w.players.every(p=>p.hp===100));
  const beam=colossusBeam(h,0),p=w.players[0],safe=w.players[1];
  Object.assign(p,{x:beamX(beam,1010),y:1010,spawnShield:0});
  Object.assign(safe,{x:p.x+220,y:p.y,spawnShield:0});
  advance(w,STEP*2);
  assert.ok(h.active);assert.equal(p.alive,false);assert.equal(safe.hp,100);
  assert.equal(w.lastDeathCause,'colossus');assert.ok(w.terrainVersion>0);
  assert.ok(w.platforms.some(p=>p.sourceId));assert.ok(validSnapshot(w.snapshot()));
});

test('beam carves only its swept contact, releases removed supports and destroys contacted physical props',()=>{
  const w=fixture(),h=w.hazards[0];h.age=26;
  const beam=colossusBeam(h),near=beamX(beam,1100);
  w.platforms=[{id:'near',x:near-200,y:1100,w:400,h:32,material:'stone'},
    {id:'far',x:100,y:1100,w:220,h:32,material:'stone'}];
  w.players[0].support='near';w.players[0].ground=true;
  const far=w.platforms[1];assert.ok(carveColossusBeam(w,beam));
  assert.ok(w.platforms.includes(far));assert.equal(w.players[0].support,null);
  assert.ok(!w.platforms.some(p=>p.x<near&&p.x+p.w>near&&p.y<=1110&&p.y+p.h>=1110));
  w.cover=[prepareProp({id:'hit',kind:'crate',x:near-36,y:1040,w:72,h:64,hp:75,maxHp:75}),
    prepareProp({id:'safe',kind:'crate',x:100,y:1040,w:72,h:64,hp:75,maxHp:75})];
  advance(w,STEP);assert.equal(w.cover[0].hp,0);assert.equal(w.cover[1].hp,75);
  assert.ok(w.chunks.length>0&&w.chunks.length<=96);
});

test('the distant beam narrows with perspective and cannot hit outside its visible cone',()=>{
  const w=fixture(),h=w.hazards[0];h.age=26;h.strikeX=1280;
  const beam=colossusBeam(h),nearEye=w.players[0],foreground=w.players[1];
  Object.assign(nearEye,{x:beamX(beam,800)-50,y:800,spawnShield:0});
  Object.assign(foreground,{x:beamX(beam,1300)+20,y:1300,spawnShield:0});
  advance(w,STEP);
  assert.equal(nearEye.hp,100);assert.equal(foreground.alive,false);
});

test('both moving eyes fire together, damage both paths and leave the space between them intact',()=>{
  const w=fixture(),h=w.hazards[0];h.age=26;h.strikeX=1280;
  const beams=colossusBeams(h),xs=beams.map(b=>beamX(b,1300)),middle=(xs[0]+xs[1])/2;
  assert.equal(beams.length,2);assert.ok(beams[1].x>beams[0].x);
  beams.forEach((b,i)=>assert.deepEqual({x:b.x,y:b.y},colossusEye(h,i)));
  for(let i=0;i<2;i++)Object.assign(w.players[i],{x:xs[i],y:1300,spawnShield:0});
  Object.assign(w.players[2],{x:middle,y:1300,spawnShield:0});
  w.platforms=[{id:'test-floor',x:200,y:1320,w:2160,h:32,material:'stone'}];
  advance(w,STEP);
  assert.ok(w.players.slice(0,2).every(p=>!p.alive));assert.equal(w.players[2].hp,100);
  const solidAt=x=>w.platforms.some(p=>x>p.x&&x<p.x+p.w&&1324>=p.y&&1324<p.y+p.h);
  for(const b of colossusBeams(h))assert.equal(solidAt(beamX(b,1324)),false);
  assert.ok(solidAt(middle));assert.ok(validSnapshot(transport(w)));
});

test('articulated motion is slow, moves the head and hands, and anchors feet and the surrounding valley',()=>{
  const h=fixture().hazards[0],head=[1278,628],hand=[1248,693];
  const start=colossusPoint(h,...head);h.age=12;
  assert.ok(Math.abs(colossusPoint(h,...head).x-start.x)>4);
  assert.ok(Math.abs(colossusPoint(h,...hand).x-hand[0])>2);
  for(let age=0;age<180;age+=.1){
    h.age=age;
    for(const [x,y] of [[1218,650],[1338,650],[1278,603],[1278,737]])assert.deepEqual(colossusPoint(h,x,y),{x,y});
    for(const [x,y] of [head,hand]){
      const p=colossusPoint(h,x,y),q=colossusPoint({...h,age:age+.1},x,y);
      assert.ok(Math.hypot(p.x-x,p.y-y)<12);assert.ok(Math.hypot(q.x-p.x,q.y-p.y)<.12);
    }
  }
});

test('distant mech cannot be destroyed by local blasts; only host fight state advances it',()=>{
  const w=fixture(),h=w.hazards[0];
  carveExplosion(w,{x:h.bodyX,y:h.bodyY,radius:480});assert.equal(h.done,false);
  const state=structuredClone(h);w.prediction=true;advance(w,2);assert.deepEqual(h,state);
  w.prediction=false;w.phase='countdown';advance(w,2);assert.deepEqual(h,state);
  w.phase='result';advance(w,2);assert.deepEqual(h,state);
});

test('phaser, nuclear cuts and black hole capture cannot remove the remote eye controller',()=>{
  for(const weapon of ['phaser','nuclear','blackhole']){
    const w=fixture(),h=w.hazards[0],p=w.players[0];
    if(weapon==='phaser'){
      Object.assign(p,{x:h.bodyX-300,y:h.bodyY+10,weapon:'phaser',rig:null});firePhaser(w,p,1,0);
    }else if(weapon==='nuclear'){
      const field=nuclearField(w,{x:h.bodyX,y:h.bodyY,owner:p.id});
      for(let n=0;n<120;n++)updateNuclear(w,field,STEP);
    }else{
      const field=blackholeField(w,{x:h.bodyX,y:h.bodyY,owner:p.id});w.fields.push(field);
      for(let n=0;n<120;n++)updateBlackhole(w,field,STEP);
    }
    assert.ok(w.hazards.includes(h),weapon);assert.equal(h.done,false,weapon);
    advance(w,.1);assert.ok(h.age>0,weapon);
  }
});

test('an unarmed bot walks out of the warning on surviving terrain and survives the sweep',()=>{
  const w=fixture(),h=w.hazards[0],p=w.players[0];
  w.ids=[0,1];w.players=w.players.slice(0,2);w.botIds=new Set([0]);p.bot=true;
  w.cover=[];w.drops=[];w.weaponTimer=Infinity;w.grenadeTimer=Infinity;
  Object.assign(p,{x:1280,y:1290,vx:0,vy:0,ground:true,support:'floor0'});p.rig=makeRig(p);
  Object.assign(w.players[1],{x:2400,y:1290,vx:0,vy:0,ground:true,support:'floor0'});w.players[1].rig=makeRig(w.players[1]);
  h.age=22;h.strikeX=1280;
  let escaped=false;
  // Isolate the dodge from a melee victory ending the round: use the actual
  // controller's movement through shared physics, with a stationary opponent.
  for(let n=0;n<120*9;n++){
    w.time+=STEP;const input=w.ai.inputs(w,STEP)[p.id];w.move(p,input,STEP);updateColossus(w,h,STEP);
    if(h.age<26&&!botDanger(w.hazards,p.x,p.y))escaped=true;
  }
  assert.ok(escaped);assert.ok(p.alive);assert.ok(p.y<1400);assert.ok(validSnapshot(w.snapshot()));
});

test('a full sweep, second eye and repeated attacks remain bounded and round reset restores everything',()=>{
  const w=fixture(),h=w.hazards[0];
  w.players.forEach(p=>{p.x=70;p.y=750;});
  for(let n=0;n<120*121;n++){
    w.time+=STEP;updateColossus(w,h,STEP);
    if(n%120===0){assert.ok(validSnapshot(w.snapshot()),`invalid at ${h.age}`);assert.ok(w.platforms.length<450);}
  }
  assert.equal(h.eye,1);assert.equal(h.cycleId,3);assert.ok(w.terrainVersion>0);
  assert.ok(w.debris.length<=90&&w.chunks.length<=96);
  w.startRound();assert.equal(w.hazards[0].age,0);assert.equal(w.hazards[0].eye,0);
  assert.equal(w.platforms.length,w.arena.platforms.length);assert.ok(w.platforms.every(p=>!p.sourceId));
  assert.ok(validSnapshot(w.snapshot()));
});

test('damaged-world hot join carries exact optical pose, charge, beam and collision; invalid state is rejected',()=>{
  const w=fixture(),h=w.hazards[0];h.age=25;advance(w,2.5);
  const s=transport(w),q=s.hazards[0];
  assert.ok(q.active&&s.platforms.some(p=>p.sourceId));
  assert.ok(Math.abs(colossusBeam(q).ex-colossusBeam(h).ex)<.02);
  for(let i=0;i<2;i++){
    const a=colossusBeams(h)[i],b=colossusBeams(q)[i];
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.02);assert.ok(Math.abs(a.ex-b.ex)<.02);
  }
  assert.equal(q.eye,h.eye);assert.ok(s.platforms.length===w.platforms.length);
  for(const patch of [{gazeX:Infinity},{gazeY:-1},{attentionX:3000},{strikeX:0},{eye:2},{eye:1},
    {cycleId:-1},{cycleId:1.5},{warning:11},{duration:9},{done:true},{x:10}]){
    const bad=structuredClone(s);Object.assign(bad.hazards[0],patch);assert.equal(validSnapshot(bad),false,JSON.stringify(patch));
  }
  const bad=structuredClone(s);bad.arenaIndex=0;assert.equal(validSnapshot(bad),false);
});

test('guest interpolation smooths slow eyes but never blends across firing or cycle boundaries',()=>{
  const w=fixture(),h=w.hazards[0];h.age=25;advance(w,.1);const a=transport(w);
  advance(w,.3);h.gazeX+=100;const b=transport(w),mid=interpolateStates(a,b,.5);
  assert.equal(mid.hazards[0].gazeX,(a.hazards[0].gazeX+b.hazards[0].gazeX)/2);
  advance(w,1);const fired=transport(w),transition=interpolateStates(b,fired,.01);
  assert.equal(transition.hazards[0],fired.hazards[0]);assert.equal(transition.hazards[0].active,true);
});

test('AI avoids the whole upcoming sweep at its own height while safe terraces remain usable',()=>{
  const w=fixture(),h=w.hazards[0];h.age=20;advance(w,STEP);
  const beam=colossusBeam(h,.5),x=beamX(beam,1000);
  assert.ok(botDanger(w.hazards,x,1000));assert.equal(botDanger(w.hazards,100,1000),false);
  h.age=35;advance(w,STEP);assert.equal(botDanger(w.hazards,x,1000),false);
  assert.equal(colossusPhase(0).firing,false);
});
