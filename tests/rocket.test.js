import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {ROCKET,rocketPhase,rocketNozzle,rocketPlume,rocketTouches,updateRocket} from '../src/rocket.js';
import {carveExplosion} from '../src/terrain.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
import {botDanger} from '../src/bot-danger.js';
import {prepareProp} from '../src/props.js';
import {synthesizeRocket,ROCKET_SOUND_SECONDS,RocketSound} from '../src/rocket-sound.js';

const fixture=()=>{const w=new World({arena:ARENAS.findIndex(a=>a.rocket),players:[0,1,2,3],shuffle:false,random:()=>.42});w.phase='fight';return w;};
const advance=(w,t)=>{for(let n=0;n<Math.round(t/STEP);n++){w.time+=STEP;updateRocket(w,w.hazards[0],STEP);}};
const transport=w=>expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
test('three second warning, five second firing, purge and alternating sweeps are continuous',()=>{
  const w=fixture(),h=w.hazards[0];w.hit=()=>{};
  advance(w,6.1);assert.ok(h.warning>2.8&&!h.active);assert.ok(w.players.every(p=>p.hp===100));
  advance(w,3);assert.ok(h.active);advance(w,5);assert.ok(!h.active&&rocketPhase(h.age).purge>.9);
  for(const age of [6,9,14,17,23,26,31,34])assert.ok(Math.abs(rocketNozzle({...h,age:age-.001}).x-rocketNozzle({...h,age:age+.001}).x)<.1);
  assert.ok(rocketPhase(9).angle<0&&rocketPhase(14).angle>0&&rocketPhase(26).angle>0&&rocketPhase(31).angle<0);
  advance(w,160);assert.ok(validSnapshot(w.snapshot()));assert.equal(w.hazards.length,1);
  w.startRound();assert.equal(w.hazards[0].age,0);assert.equal(w.hazards[0].active,false);
});
test('jet contact burns and launches fighters, leaving the high crossing and outer routes safe',()=>{
  const w=fixture(),h=w.hazards[0];h.age=11.5;
  Object.assign(w.players[0],{x:1280,y:990,spawnShield:0});
  Object.assign(w.players[1],{x:1280,y:410,spawnShield:0});
  Object.assign(w.players[2],{x:1800,y:990,spawnShield:0});
  advance(w,.01);assert.ok(w.players[0].hp<100&&w.players[0].vy>0);
  assert.equal(w.players[1].hp,100);assert.equal(w.players[2].hp,100);
  advance(w,1);assert.equal(w.players[0].alive,false);assert.equal(w.lastDeathCause,'rocket');
});
test('actual surviving solid terrain blocks the same rays used by the art and damage',()=>{
  const w=fixture(),h=w.hazards[0];h.age=11.5;
  w.platforms=[{id:'shield',x:800,y:850,w:960,h:30,material:'metal'}];
  const blocked=rocketPlume(h,w.platforms);
  assert.ok(blocked.rays.every(r=>Math.abs(r.ey-850)<.001));
  assert.equal(rocketTouches(blocked,{x:1260,y:900,w:40,h:50}),false);
  Object.assign(w.players[0],{x:1280,y:970,spawnShield:0});advance(w,STEP);assert.equal(w.players[0].hp,100);
  carveExplosion(w,{x:1280,y:850,radius:70});
  const open=rocketPlume(h,w.platforms);assert.ok(open.rays[8].ey>1400);
  assert.ok(open.rays.some(r=>r.ey<900));advance(w,.3);assert.ok(w.players[0].hp<100);
  assert.equal(h.done,false);assert.ok(validSnapshot(transport(w)));
});
test('grating passes thrust and loose props, fragments, weapons and body particles receive momentum',()=>{
  const w=fixture(),h=w.hazards[0];h.age=10;w.platforms=[{id:'grate',x:300,y:800,w:2000,h:14,oneWay:true,material:'metal'}];
  const r=rocketPlume(h,w.platforms).rays[8],at=y=>r.x+(r.ex-r.x)*(y-r.y)/(r.ey-r.y),x=at(950);
  const b=prepareProp({id:'test',kind:'crate',x:x-30,y:920,w:60,h:60,hp:75,maxHp:75});w.cover=[b];
  w.drops=[{type:'blaster',x,y:950,vx:0,vy:0,ammo:10,life:90}];
  const q={x,y:960,px:x,py:960};w.ragdolls=[{points:[q]}];
  advance(w,STEP);assert.ok(b.vy>0&&b.vx<0);assert.ok(w.drops[0].vy>0);assert.ok(q.py<q.y&&q.px>q.x);
});
test('prediction cannot create thrust damage or advance the host machinery',()=>{
  const w=fixture();w.hazards[0].age=11;w.prediction=true;
  const before=structuredClone(w.snapshot());advance(w,.1);
  assert.deepEqual(w.hazards,before.hazards);assert.deepEqual(w.cover,before.cover);assert.deepEqual(w.players,before.players);
});
test('changed-world transport preserves the engine phase, solid shielding and reset',()=>{
  const w=fixture();advance(w,8.7);carveExplosion(w,{x:1280,y:1320,radius:170});
  const a=transport(w);advance(w,.5);const b=transport(w);
  assert.deepEqual(b.platforms,new RenderSnapshots().make(w.snapshot()).platforms);assert.ok(Math.abs(b.hazards[0].age-w.hazards[0].age)<.006);
  const render=interpolateStates(a,b,.5);assert.equal(render.hazards[0].active,true);
  assert.equal(render.hazards[0].age,b.hazards[0].age,'ignition is immediate across interpolation');
  for(const patch of [{x:1200},{done:true},{warning:4},{bodyX:99999},{hitTimer:Infinity}]){
    const s=structuredClone(b);Object.assign(s.hazards[0],patch);assert.equal(validSnapshot(s),false);
  }
  const wrong=structuredClone(b);wrong.arenaIndex=0;assert.equal(validSnapshot(wrong),false);
  w.startRound();assert.equal(w.platforms.length,w.arena.platforms.length);assert.equal(w.hazards[0].age,0);
});
test('bots avoid the announced sweep while the upper gantry remains a valid route',()=>{
  const w=fixture(),h=w.hazards[0];advance(w,6.1);
  assert.equal(botDanger([h],1280,1000),true);assert.equal(botDanger([h],1280,410),false);
  assert.equal(botDanger([h],650,1000),false);
});
test('easy bots walk out of the middle crossing during the warning using ordinary controls',()=>{
  for(const direction of [-1,1]){
    const w=new World({arena:12,players:[0,1],bots:[1],difficulty:'easy',shuffle:false,random:()=>.42});
    w.phase='fight';w.drops=[];w.weaponTimer=99;w.grenadeTimer=99;
    Object.assign(w.players[0],{x:direction<0?300:2260,y:1080});
    Object.assign(w.players[1],{x:1280,y:1010,vx:0,vy:0,ground:true,support:'floor5'});
    w.players[1].rig=null;w.hazards[0].age=6;
    for(let i=0;i<3.15/STEP;i++)w.step(STEP);
    assert.equal(w.players[1].hp,100);assert.equal(botDanger(w.hazards,w.players[1].x,w.players[1].y),false);
  }
});
test('original rocket audio separates warning, thrust and purge with bounded silent endpoints',()=>{
  const rate=12000,pcm=synthesizeRocket(rate),rms=(a,b)=>Math.sqrt(pcm.slice(a*rate,b*rate).reduce((s,x)=>s+x*x,0)/((b-a)*rate));
  assert.equal(pcm.length,rate*ROCKET_SOUND_SECONDS);assert.ok(pcm.every(v=>Number.isFinite(v)&&Math.abs(v)<=.64));
  assert.equal(Math.abs(pcm[0]),0);assert.equal(Math.abs(pcm.at(-1)),0);
  assert.ok(rms(3.2,7.8)>rms(.2,2.8)*3);assert.ok(rms(9.5,10.8)<rms(4,7)*.12);
});
test('seekable sound joins mid firing, never replays stale ignition, and stops on mute or reset',()=>{
  const played=[],stops=[],voice={end:0,stopped:false,source:{stop(){stops.push(1);}},gain:{gain:{cancelScheduledValues(){},setTargetAtTime(){}}},pan:{pan:{setTargetAtTime(){}}}};
  const sound={context:{currentTime:0},ready:()=>true,sample:(name,d,o)=>{played.push({name,...o});return {...voice,end:o.duration};}};
  const player=new RocketSound(),state={arenaIndex:12,round:1,phase:'fight',hazards:[{type:'rocket',id:1,x:1280,age:11}]};
  player.update(sound,state);assert.ok(Math.abs(played[0].offset-5)<1e-6);
  for(let i=0;i<30;i++)player.update(sound,state);assert.equal(played.length,1);
  sound.context.currentTime=.1;state.hazards[0].age=11.1;player.update(sound,state);assert.equal(played.length,1);
  sound.ready=()=>false;player.update(sound,state);assert.equal(stops.length,1);
  sound.ready=()=>true;state.hazards[0].age=0;player.update(sound,state);assert.equal(played.length,1);
});
