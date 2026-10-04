import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentBox } from '../src/collision.js';
import { bodyBounds, bodyPoints, prepareProp, updateProps, damageProp } from '../src/props.js';
import { passiveBody } from '../src/body-physics.js';
import { World, ARENAS, STEP, cleanInput } from '../src/engine.js';
import { RenderSnapshots } from '../src/render-state.js';
import { GuestPrediction } from '../src/guest-prediction.js';
import { BotController } from '../src/bots.js';
import { navigation } from '../src/navigation.js';

test('swept contacts retain thin-wall hits, corner normals, parallel misses and inside exits', () => {
  const box={x:10,y:10,w:1,h:30};
  assert.deepEqual(segmentBox(-100,20,500,20,box),{t:110/600,nx:-1,ny:0});
  assert.deepEqual(segmentBox(20,20,0,20,box),{t:.45,nx:1,ny:0});
  assert.equal(segmentBox(0,5,100,5,box,4),null);
  assert.deepEqual(segmentBox(0,0,20,20,box),{t:.5,nx:0,ny:-1});
  assert.deepEqual(segmentBox(10.5,20,10.5,20,box),{t:0,nx:-0,ny:-1});
  assert.equal(segmentBox(12,0,12,100,box),null);
});

test('allocation-free bounds match transformed corners through rotation, resize and shape edits', () => {
  const b={x:0,y:0,w:70,h:23};
  for(let i=0;i<1000;i++) {
    Object.assign(b,{x:i*3.71-1500,y:i*.39-80,angle:i*.137,w:12+i%190,h:5+i%87});
    if(i%3) b.shape=[[-.5,-.5],[.25,-.5],[.5,.2],[-.4,.5]]; else delete b.shape;
    const ps=bodyPoints(b),x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));
    assert.deepEqual(bodyBounds(b),{x,y,w:Math.max(...ps.map(p=>p.x))-x,h:Math.max(...ps.map(p=>p.y))-y});
  }
});

test('reused ragdoll scratch preserves moving support, bounce and changing rig sizes exactly', () => {
  let fresh=[{x:10,y:10,px:5,py:5},{x:30,y:10,px:25,py:5}];
  const reused=structuredClone(fresh),floor={id:'floor',x:-200,y:100,w:800,h:5,dx:.4,dy:0};
  for(let tick=0;tick<240;tick++) {
    floor.x+=floor.dx;
    if(tick===120) { fresh.push({...fresh[1]}); reused.push({...reused[1]}); }
    fresh=structuredClone(fresh);
    for(const points of [fresh,reused]) passiveBody(points,[[0,1,20]],[floor],STEP,{restitution:.3});
    assert.deepEqual(reused,fresh);
  }
});

test('strapped cargo stays fixed in either pair order and releases only after restraint damage', () => {
  for(const reverse of [false,true]) {
    const held=prepareProp({id:'held',kind:'crate',x:500,y:500,w:80,h:80,hp:110,maxHp:110,strapped:true,strapHp:50});
    const loose=prepareProp({id:'loose',kind:'crate',x:440,y:510,w:80,h:60,hp:110,maxHp:110,vx:150});
    const w={cover:reverse?[loose,held]:[held,loose],chunks:[],players:[],platforms:[],time:0,terrainVersion:0,event(){},random:()=>.5};
    for(let i=0;i<30;i++) { w.time+=STEP; updateProps(w,STEP); }
    assert.deepEqual([held.x,held.y,held.angle,held.vx,held.vy,held.spin],[500,500,0,0,0,0]);
    assert.ok(bodyBounds(loose).x+bodyBounds(loose).w<500.2);
    damageProp(w,held,50,120,0);
    updateProps(w,STEP);
    assert.equal(held.strapped,false);
    assert.ok(held.x>500 && held.vx>0);
  }
});

test('stationary arenas also spread route work over ticks without dropping completed routes', () => {
  const solids=Array.from({length:5},(_,i)=>({id:`p${i}`,x:100+i*220,y:800-i*65,w:180,h:20}));
  const world={time:0,terrainVersion:0,arena:{},players:[{bot:true,alive:true}],cover:[],wreckage:[],fields:[],
    solids:()=>solids,spikes:()=>[]};
  const bot=new BotController(); bot.prepare(world);
  assert.ok(bot.pendingNavigation);
  assert.equal(bot.graph.size,0,'first long takeoff list yields before completing a landing');
  let ticks=0;
  while(bot.pendingNavigation && ticks++<10000) {world.time+=STEP;bot.prepare(world);}
  assert.ok(ticks<10000);
  assert.deepEqual(bot.graph,navigation(solids,{time:0,spikes:[]}));
  assert.deepEqual(navigation(solids,{priority:new Set(['p4','p3']),batchSize:8}),bot.graph,
    'prioritising an occupied support changes scheduling, never the completed route graph');
});

function freeze(value) {
  if(value && typeof value==='object' && !Object.isFrozen(value)) {
    Object.freeze(value); for(const v of Object.values(value))freeze(v);
  }
  return value;
}
test('guest replay and render lookahead leave deeply frozen world snapshots untouched in every arena', () => {
  for(let arena=0;arena<ARENAS.length;arena++) {
    const w=new World({arena,players:[0,1],shuffle:false,random:()=>.4});
    w.phase='fight';w.time=1;
    if(w.ship)w.ship.volumes.fill(100000);
    const s=freeze({...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]});
    const before=JSON.stringify(s),prediction=new GuestPrediction();
    prediction.receive(s,1,1000);
    for(let n=1;n<=12;n++) {
      prediction.advance(cleanInput({right:true,jump:n===2,duck:n>8,attack:n%2===0}),n,1000+n*1000/60);
      prediction.sample(s,1005+n*1000/60);
    }
    assert.equal(JSON.stringify(s),before,ARENAS[arena].name);
  }
});
