import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {updateRefinery} from '../src/refinery.js';
import {REFINERY_PIPES as PIPES,REFINERY_ROUTES as ROUTES} from '../src/refinery-arena.js';
import {updateReactions,heatReactions,addSpill} from '../src/reactions.js';
import {carveExplosion} from '../src/terrain.js';
import {waterSurfaces} from '../src/water-art.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
import {SnapshotHistory} from '../src/snapshot-delta.js';
const fixture=()=>{const w=new World({arena:ARENAS.findIndex(a=>a.refinery),players:[0,1],shuffle:false,random:()=>.42});w.phase='fight';return w;};
const advance=(w,t)=>{for(let i=0;i<Math.round(t/.05);i++){w.time+=.05;updateReactions(w,.05);}};
const oil=w=>w.spills.filter(q=>q.kind==='oil');
const volume=w=>oil(w).reduce((n,q)=>n+q.h,0);
const stored=r=>r.tanks.reduce((n,q)=>n+q.volume,0)+r.pipes.reduce((n,q)=>n+q.volume,0)+r.products.reduce((a,b)=>a+b,0)+r.released+r.combusted;
const transport=w=>JSON.parse(JSON.stringify(expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot)));
function flood(){const w=fixture();advance(w,12);w.damageCover(w.platforms.find(p=>p.refineryPipe===3),200);advance(w,10);return w;}
test('every crude section pours its actual finite oil after a shot or a through-cut',()=>{
  for(const id of ROUTES[0].ids)for(const cut of ['shot','blast']){
    const w=fixture();advance(w,12);const before=stored(w.refinery),p=PIPES[id];
    if(cut==='shot')w.damageCover(w.platforms.find(q=>q.refineryPipe===id),200);
    else carveExplosion(w,{x:(p.x+p.ex)/2,y:(p.y+p.ey)/2,radius:35});
    advance(w,5);
    assert.ok(w.refinery.released>800,`${cut} on crude pipe ${id} must pour, not drip`);
    assert.ok(volume(w)>700,`pipe ${id} leaves physical oil`);
    assert.ok(Math.abs(stored(w.refinery)-before)<1e-6);
    assert.ok(w.water.length+w.spills.length<=384);assert.ok(validSnapshot(transport(w)));
  }
});
test('a broken crude main forms a deep lake that remains after the source runs dry',()=>{
  const w=flood(),before=volume(w),runs=waterSurfaces(oil(w),w.platforms);
  assert.ok(runs.some(run=>run.length*32>=550&&run.some(q=>q.h>60)),'a substantial traversable-world pool forms');
  assert.equal(w.refinery.tanks[0].volume,0);assert.ok(before>1500);
  advance(w,60);assert.ok(Math.abs(volume(w)-before)<1e-5,'oil has no disappearing puddle timer');
  assert.ok(validSnapshot(transport(w)));
});
test('the lake catches a flame projectile and burns from its surface instead of vanishing in seven seconds',()=>{
  const w=flood(),q=oil(w).find(q=>q.x>700&&q.x<900&&q.h>60),before=volume(w);
  w.projectiles.push({kind:'flame',weapon:'flame',owner:0,x:q.x+16,y:q.y-80,vx:0,vy:950,r:10,damage:10,force:50,life:.85,age:0,bounces:0,hitIds:[],burn:1});
  for(let i=0;i<16;i++)w.updateProjectiles(STEP);
  assert.ok(oil(w).some(q=>q.fire>0));advance(w,10);
  assert.ok(oil(w).some(q=>q.fire>0&&q.h>20));assert.ok(volume(w)>100&&volume(w)<before);
  assert.ok(validSnapshot(transport(w)));
});
test('cutting a real hole in the basin floor drains the accumulated oil',()=>{
  const w=flood(),before=volume(w);carveExplosion(w,{x:800,y:1340,radius:95});advance(w,20);
  assert.ok(volume(w)<before*.5);assert.ok(validSnapshot(transport(w)));
});
test('blocked or time-batched leaks keep unaccepted fuel inside the circuit without a wide emission slab',()=>{
  const w=fixture();advance(w,12);w.damageCover(w.platforms.find(q=>q.refineryPipe===3),200);
  const before=stored(w.refinery);updateRefinery(w,2);
  assert.ok(volume(w)>0&&volume(w)<=36.00001);assert.equal(oil(w).length,1);
  assert.ok(Math.abs(stored(w.refinery)-before)<1e-6);assert.ok(validSnapshot(transport(w)));
});
test('oil and petrol persist on Refinery while other arenas retain their existing spill lifetime',()=>{
  for(const refinery of [false,true]){
    const w=fixture();w.refinery=null;w.arena={...w.arena,refinery};w.platforms=[];w.cover=[];
    for(const kind of ['oil','petrol'])addSpill(w,kind,800,1000,60);
    // Hold the physical parcel in place to isolate expiration from falling out.
    w.platforms=[{id:'floor',x:0,y:1000,w:2560,h:40,material:'stone'}];advance(w,45);
    assert.equal(w.spills.length>0,refinery);
  }
});
test('floods and their burning surfaces survive hot joins, deltas and reset',()=>{
  const w=flood(),a=transport(w);heatReactions(w,()=>true,.05);advance(w,.5);const b=transport(w),h=new SnapshotHistory();
  assert.ok(b.spills.some(q=>q.kind==='oil'&&q.h>60&&q.fire));h.remember(1,a);assert.deepEqual(h.decode(h.encode(b,1),2),b);
  assert.ok(validSnapshot(interpolateStates(a,b,.5)));const bad=structuredClone(b);bad.refinery.pipes[3].flow=10000;assert.equal(validSnapshot(bad),false);
  w.startRound();assert.equal(w.spills.length,0);assert.equal(w.refinery.released,0);assert.ok(validSnapshot(transport(w)));
});
