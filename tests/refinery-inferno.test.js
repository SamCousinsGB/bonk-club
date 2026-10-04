import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS} from '../src/engine.js';
import {updateRefinery,heatRefinery} from '../src/refinery.js';
import {REFINERY_PIPES} from '../src/refinery-arena.js';
import {addSpill,updateReactions} from '../src/reactions.js';
import {moveLiquid} from '../src/liquid.js';
import {carveExplosion,corrodeTerrain} from '../src/terrain.js';
import {nuclearField,updateNuclear} from '../src/nuclear.js';
import {blackholeField,updateBlackhole} from '../src/blackhole.js';
import {firePhaser} from '../src/phaser.js';
import {refinerySmokeSources} from '../src/refinery-smoke.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
const fixture=()=>{const w=new World({arena:ARENAS.findIndex(a=>a.refinery),players:[0,1],shuffle:false,random:()=>.42});w.phase='fight';return w;};
const advance=(w,t)=>{for(let i=0;i<Math.round(t/.05);i++){w.time+=.05;updateReactions(w,.05);}};
const transport=w=>JSON.parse(JSON.stringify(expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot)));
const ground=w=>w.platforms.filter(p=>p.refineryGround);
const oil=w=>w.spills.filter(q=>q.kind==='oil').reduce((s,q)=>s+q.h,0);

test('earth basin survives real explosions, phaser cuts, nuclear melt, black holes and acid',()=>{
  for(const weapon of ['blast','phaser','nuke','blackhole','acid']){
    const w=fixture(),before=structuredClone(ground(w));
    for(const x of [32,1280,2528]){
      if(weapon==='blast')carveExplosion(w,{x,y:1400,radius:480});
      if(weapon==='phaser'){Object.assign(w.players[0],{x,y:1050,rig:null});firePhaser(w,w.players[0],0,1);}
      if(weapon==='nuke'){const f=nuclearField(w,{x,y:1400,owner:0});w.fields=[f];updateNuclear(w,f,.5);}
      if(weapon==='blackhole'){const f=blackholeField(w,{x,y:1400,owner:0});w.fields=[f];updateBlackhole(w,f,.5);}
      if(weapon==='acid')for(let n=0;n<8;n++){w.time+=.5;corrodeTerrain(w,[{x:1280,y:1404,w:32,h:20,grounded:true}]);}
    }
    assert.deepEqual(ground(w),before,weapon);assert.ok(validSnapshot(transport(w)),weapon);
  }
});

test('bottom and sloping banks retain all liquid volume even with fast lateral flow',()=>{
  const w=fixture();w.platforms=ground(w);w.cover=[];w.refinery=null;
  for(const x of [16,144,1280,2400,2528])addSpill(w,'oil',x,1100,160,false,{vx:x<1280?-900:900,depth:160,centered:true});
  const before=oil(w);for(let i=0;i<600;i++)moveLiquid(w,.05);
  assert.ok(Math.abs(oil(w)-before)<1e-6);
  assert.ok(w.spills.every(q=>q.x>=0&&q.x+q.w<=2560&&q.y+q.h<=1424.001));
  assert.ok(ground(w).some(p=>p.x===0&&p.y<1424));
});

test('the external intake can rupture and keeps supplying oil beyond a tankful',()=>{
  const w=fixture();w.damageCover(w.platforms.find(p=>p.refineryPipe===-1),200);advance(w,40);
  assert.ok(w.refinery.feed.broken);assert.ok(w.refinery.supplied>10000);assert.ok(oil(w)>8000);
  assert.ok(w.spills.length+w.water.length<=384&&w.gas.length<=24);assert.ok(validSnapshot(transport(w)));
  w.startRound();assert.equal(w.refinery.supplied,0);assert.equal(w.refinery.feed.broken,false);
});

test('all flammable refinery liquids consume volume slowly and water still quenches them',()=>{
  for(const kind of ['oil','petrol','tar']){
    const w=fixture();w.refinery=null;w.platforms=[...ground(w),...[960,1408].map(x=>({x,y:1000,w:32,h:424,material:'metal'}))];w.cover=[];
    addSpill(w,kind,1200,1424,800,true,{depth:100});const before=w.spills.reduce((s,q)=>s+q.h,0);advance(w,3);
    const after=w.spills.reduce((s,q)=>s+q.h,0);assert.ok(after<before&&after>before*.65,kind);assert.ok(w.spills.some(q=>q.fire>0),kind);
    const q=w.spills.find(q=>q.h>1);w.water=[{id:++w.reactionSerial,x:q.x,y:q.y,w:q.w,h:q.h+20,vx:0,vy:0,grounded:true,frozen:0,charge:0}];
    advance(w,.05);assert.ok(w.spills.some(q=>q.fire===0&&q.cold>0),kind);
  }
});

test('heated fuel pipes rupture and vent burning vapour from the actual opening',()=>{
  const w=fixture();advance(w,12);const spec=REFINERY_PIPES[3],panel=w.platforms.find(p=>p.refineryPipe===3);
  heatRefinery(w,b=>b.x<panel.x+panel.w&&b.x+b.w>panel.x&&b.y<panel.y+panel.h&&b.y+b.h>panel.y,2);
  updateRefinery(w,.05);assert.ok(w.refinery.pipes[3].broken);assert.ok(w.events.some(e=>e.type==='explosion'));
  advance(w,.3);assert.ok(w.spills.some(q=>q.kind==='oil'&&q.fire));assert.ok(w.gas.some(g=>g.spray&&g.lit&&Math.abs(g.x-spec.x)<200));
  assert.ok(w.chunks.some(c=>c.material==='metal'));assert.ok(validSnapshot(transport(w)));
  const a=transport(w);advance(w,.1);const b=transport(w);assert.ok(validSnapshot(interpolateStates(a,b,.5)));
  assert.ok(Math.abs(b.refinery.pipes[3].temperature-w.refinery.pipes[3].temperature)<.006);
  for(const change of [s=>s.refinery.feed.flow=Infinity,s=>s.refinery.supplied=-1,s=>s.refinery.pipes[3].temperature=9,s=>s.platforms.find(p=>p.refineryGround).w=12]){const bad=structuredClone(b);change(bad);assert.equal(validSnapshot(bad),false);}
});

test('smoke is driven by burning fuel, bounded, transported and cleared on reset',()=>{
  const w=fixture();assert.equal(refinerySmokeSources(w).length,0);
  addSpill(w,'oil',800,1400,100,true);w.gas.push({id:++w.reactionSerial,x:900,y:800,r:30,life:3,lit:.22,vx:0,vy:-200,owner:0,spray:true});
  const sources=refinerySmokeSources(w),hot=refinerySmokeSources(transport(w));assert.ok(sources.length>0&&sources.length<=10);assert.equal(hot.length,sources.length);
  hot.forEach((q,i)=>{for(const key of ['x','y','strength'])assert.ok(Math.abs(q[key]-sources[i][key])<.01);});
  w.spills=Array.from({length:384},(_,i)=>({x:i%80*32,y:300+Math.floor(i/80)*220,w:32,h:80,fire:7}));assert.ok(refinerySmokeSources(w).length<=10);
  w.startRound();assert.deepEqual(refinerySmokeSources(w),[]);
});
