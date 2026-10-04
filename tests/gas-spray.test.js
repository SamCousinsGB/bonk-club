import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {updateRefinery} from '../src/refinery.js';
import {REFINERY_ROUTES} from '../src/refinery-arena.js';
import {updateReactions,heatReactions,explosionReaction,addWater,addSpill,reactionDanger} from '../src/reactions.js';
import {prepareProp} from '../src/props.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
import {SnapshotHistory} from '../src/snapshot-delta.js';
import {RefinerySound} from '../src/refinery-sound.js';
const fixture=()=>{const w=new World({arena:ARENAS.findIndex(a=>a.refinery),players:[0,1],shuffle:false,random:()=>.42});w.phase='fight';return w;};
const advance=(w,t)=>{for(let i=0;i<Math.round(t/.05);i++){w.time+=.05;updateReactions(w,.05);}};
const gas=(w,x=800,y=600,extra={})=>{const g={id:++w.reactionSerial,x,y,r:26,vx:0,vy:0,life:3.2,lit:0,owner:0,spray:true,...extra};w.gas.push(g);return g;};
const lab=()=>{const w=fixture();w.refinery=null;w.platforms=[];w.cover=[];w.chunks=[];w.spills=[];w.water=[];w.gas=[];return w;};
function shoot(w,g,kind='flame',dx=0,dy=1){
  w.projectiles.push({kind,weapon:kind==='flame'?'flame':kind==='frost'?'ice':kind,owner:1,life:1,x:g.x+dx*25,y:g.y+dy*25,vx:-dx*1200,vy:-dy*1200,r:4,damage:1,force:0,bounces:0,hitIds:[]});
  for(let i=0;i<6;i++)w.updateProjectiles(STEP);
}
const transport=w=>JSON.parse(JSON.stringify(expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot)));
test('all eleven gas pipe sprays ignite from a flame and sustain fire on newly emitted fuel',()=>{
  for(const id of REFINERY_ROUTES[2].ids){
    const w=fixture();for(let i=0;i<600;i++)updateRefinery(w,.05);
    w.damageCover(w.platforms.find(p=>p.refineryPipe===id),200);advance(w,.15);
    const g=w.gas.find(g=>g.spray);assert.ok(g,`pipe ${id} emits spray`);for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){if(g.lit)break;shoot(w,g,'flame',dx,dy);}assert.ok(g.lit,`pipe ${id} ignites`);
    const first=new Set(w.gas.map(g=>g.id));advance(w,3);
    assert.ok(w.gas.some(g=>g.lit&&!first.has(g.id)),`pipe ${id} lights newly emitted gas`);
    assert.ok(w.gas.length<=24);assert.ok(validSnapshot(transport(w)));
    assert.equal(w.events.filter(e=>e.type==='explosion'&&e.weapon==='gas').length,0,'a fed spray burns without repeated grenade blasts');
  }
});
test('sprays accept sparks, plasma, flame, Tesla and environmental heat',()=>{
  for(const kind of ['spark','plasma','flame','tesla']){const w=lab(),g=gas(w);shoot(w,g,kind);assert.ok(g.lit,kind);}
  const w=lab(),g=gas(w);heatReactions(w,()=>true,.05);assert.ok(g.lit);advance(w,.5);assert.ok(w.gas.some(g=>g.lit));
  advance(w,1);assert.equal(w.gas.length,0,'spent gas burns out without replacement fuel');
});
test('a flame front spreads through touching gas but stops at a surviving solid wall',()=>{
  for(const wall of [false,true]){
    const w=lab(),a=gas(w,800,600,{lit:.22,owner:1}),b=gas(w,845,600);
    if(wall)w.platforms=[{id:'wall',x:823,y:500,w:8,h:200,material:'metal'}];
    advance(w,.05);assert.equal(b.lit>0,!wall);if(!wall)assert.equal(b.owner,1);
    assert.ok(reactionDanger(w,a.x,a.y));
  }
});
test('gas flames burn fighters and fuel without burning through solid cover',()=>{
  for(const wall of [false,true]){
    const w=lab(),p=w.players[0];Object.assign(p,{x:835,y:600,burn:0,soaked:0,cold:0,freeze:0,spawnShield:0});
    gas(w,800,600,{lit:.22,r:40});
    w.cover=[prepareProp({id:'wood',kind:'crate',x:825,y:600,w:25,h:30,hp:50,maxHp:50})];
    if(wall)w.platforms=[{id:'wall',x:819,y:500,w:4,h:200,material:'metal'}];
    advance(w,.05);assert.equal(p.burn>0,!wall);assert.equal(w.cover[0].fire>0,!wall);
  }
});
test('nearby burning furniture ignites a spray only through open space',()=>{
  for(const wall of [false,true]){
    const w=lab(),g=gas(w,840,600);
    w.cover=[prepareProp({id:'wood',kind:'crate',x:785,y:590,w:30,h:30,hp:50,maxHp:50,fire:3,fuel:3})];
    if(wall)w.platforms=[{id:'wall',x:819,y:500,w:4,h:200,material:'metal'}];
    advance(w,.05);assert.equal(g.lit>0,!wall);
  }
});
test('water, coolant and cryo extinguish a burning spray before it spreads',()=>{
  for(const cooling of ['water','coolant','frost','cryo']){
    const w=lab(),g=gas(w,800,600,{lit:.22});
    if(cooling==='water')addWater(w,800,630,60,{depth:60,centered:true});
    if(cooling==='coolant')addSpill(w,'coolant',800,630,60,false,{depth:60,centered:true});
    if(cooling==='frost')shoot(w,g,'frost');
    if(cooling==='cryo')explosionReaction(w,{x:800,y:600,radius:80,weapon:'cryo'});
    advance(w,.05);assert.ok(!w.gas.some(g=>g.lit),cooling);
  }
});
test('spray ignition survives transport, deltas and hot-join interpolation, then resets',()=>{
  const w=fixture();gas(w);const a=transport(w);w.gas[0].lit=.22;const b=transport(w);
  assert.ok(b.gas[0].spray&&b.gas[0].lit);const h=new SnapshotHistory();h.remember(1,a);
  assert.deepEqual(h.decode(h.encode(b,1),2),b);assert.ok(interpolateStates(a,b,.5).gas[0].lit);
  for(const value of ['yes',{},5]){const bad=structuredClone(b);bad.gas[0].spray=value;assert.equal(validSnapshot(bad),false);}
  const before=structuredClone(w.gas);w.prediction=true;advance(w,.4);assert.deepEqual(w.gas,before);
  w.prediction=false;w.startRound();assert.equal(w.gas.length,0);assert.ok(validSnapshot(transport(w)));
});
test('the flame roar seeks for hot joins, uses one voice and stops when combustion ends',()=>{
  const w=fixture();w.refinery.clock=1.5;gas(w,800,600,{lit:.22});
  const played=[],stops=[],audio=new RefinerySound(),sound={context:{currentTime:10},ready:()=>true,sample:(name,d,o)=>{played.push({name,...o});return {stopped:false,gain:{gain:{setTargetAtTime(){},cancelScheduledValues(){}}},source:{stop(){stops.push(name);}}};}};
  audio.update(sound,w.snapshot());assert.equal(played.filter(v=>v.name==='refinery-fire').length,1);assert.equal(played.find(v=>v.name==='refinery-fire').offset,1.5);
  for(let i=0;i<20;i++)audio.update(sound,w.snapshot());assert.equal(played.filter(v=>v.name==='refinery-fire').length,1);
  w.gas=[];audio.update(sound,w.snapshot());assert.ok(stops.includes('refinery-fire'));assert.ok(!audio.voices.has('refinery-fire'));
});
