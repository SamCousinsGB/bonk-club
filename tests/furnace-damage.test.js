import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS, STEP } from '../src/engine.js';
import { updateHazards } from '../src/hazards.js';
import { carveExplosion } from '../src/terrain.js';
import { damageFurnacePart, furnacePartBox } from '../src/furnace-parts.js';
import { powerlineCircuit, poweredWirePieces } from '../src/powerline-circuit.js';
import { updateCables, blastCables } from '../src/heavy-cables.js';
import { validSnapshot } from '../src/network.js';
import { RenderSnapshots, interpolateStates } from '../src/render-state.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';
import { firePhaser } from '../src/phaser.js';

function lab() {
  const w=new World({arena:ARENAS.findIndex(a=>a.furnace),players:[0,1],bots:[],shuffle:false,random:()=>.4});
  w.phase='fight';w.cover=[];w.drops=[];w.water=[];w.spills=[];w.gas=[];
  return {w,h:w.hazards[0]};
}
const tick=(w,n=1)=>{for(let i=0;i<n;i++){w.time+=STEP;updateCables(w,STEP);updateHazards(w,STEP);}};

test('local blast damages shell sections without deleting the furnace or unrelated parts; repeat damage removes only those sections',()=>{
  const {w,h}=lab();const b=furnacePartBox(h,0),blast={x:b.x+70,y:b.y+120,radius:25};
  carveExplosion(w,blast);assert.equal(h.done,false);assert.equal(h.furnaceParts[0],35);
  assert.ok(h.furnaceParts.slice(1).every(hp=>hp===100));
  carveExplosion(w,blast);assert.equal(h.furnaceParts[0],0);assert.ok(!h.done);
  tick(w);assert.ok(h.furnaceFault>0);w.startRound();assert.ok(w.hazards[0].furnaceParts.every(hp=>hp===100));
});

test('ordinary projectile hits damage the actual shell and respect nearer cover',()=>{
  for(const cover of [false,true]){
    const {w,h}=lab();w.platforms=cover?[{id:'shield',x:940,y:1090,w:20,h:100}]:[];
    w.projectiles=[{x:900,y:1140,vx:3000,vy:0,life:1,r:3,kind:'bullet',damage:30,force:100,owner:0}];
    w.updateProjectiles(.08);
    assert.equal(h.furnaceParts[0],cover?100:70);assert.ok(!h.done);
  }
});

test('damage produces varied discharge lengths with a safe amber interval before every activation',()=>{
  const {w,h}=lab();damageFurnacePart(w,h,0,65);let previous=false,warning=0;const durations=[];
  for(let i=0;i<120*45;i++){
    // Only the power controller is needed; keep wire geometry stationary here.
    w.time+=STEP;updateHazards(w,STEP);
    if(h.warning>0)warning+=STEP;
    if(h.active&&!previous){assert.ok(warning>=1.18);durations.push(h.duration);warning=0;}
    previous=h.active;
  }
  assert.ok(durations.length>=4);assert.ok(new Set(durations.map(n=>n.toFixed(2))).size>=3);
});

test('cut wire tails stay powered from the wall and back-fed electrode; completely isolated matter goes dead',()=>{
  const {w,h}=lab();h.age=11;tick(w);const c=w.cables[0];c.links[12]=false;
  let runs=powerlineCircuit(w).runs.filter(r=>r.cable===c.id);assert.equal(runs.length,2);assert.ok(runs.every(r=>r.powered));
  // Remove the opposite feed and all other phases so there can be no short.
  for(const other of w.cables.slice(1))other.attached=[false,false];
  runs=powerlineCircuit(w).runs.filter(r=>r.cable===c.id);
  assert.ok(runs[0].powered);assert.equal(runs[1].powered,false);
  c.attached[0]=false;assert.equal(poweredWirePieces(w).length,0);
});

test('falling cut ends retain gravity, contact damage and shock throttling while isolated pieces cannot hurt',()=>{
  const {w,h}=lab();h.age=11;tick(w);const c=w.cables[0],p=w.players[0];
  blastCables(w,{...c.points[12],radius:10});const y=c.points[10].y;tick(w,60);assert.ok(c.points[10].y>y+5);
  const r=powerlineCircuit(w).runs.find(r=>r.cable===c.id&&r.powered),q=r.points[3];
  Object.assign(p,{x:q.x,y:q.y,hp:100,alive:true});h.wireHitIds=[];h.wireHitTimer=0;
  updateHazards(w,STEP);assert.equal(p.hp,30);updateHazards(w,STEP);assert.equal(p.hp,30);
  for(const cable of w.cables) cable.attached=[false,false];
  h.wireHitTimer=0;updateHazards(w,STEP);assert.equal(p.hp,30);
});

test('different phases short on contact during a safe interval; matching phases do not',()=>{
  const {w,h}=lab();const a=w.cables[0],b=w.cables[1];
  for(const c of w.cables){c.links.fill(false);c.attached=[false,false];}
  for(const [c,y] of [[a,500],[b,504]]){c.links[0]=true;c.points[0]={x:500,y};c.points[1]={x:700,y};}
  a.attached[0]=true;h.age=2;h.active=false;
  assert.ok(powerlineCircuit(w).runs.every(r=>r.shorted&&r.powered));
  b.points[0].y=b.points[1].y=540;assert.ok(powerlineCircuit(w).runs.every(r=>!r.powered));
  const same=w.cables[3];same.links[0]=true;same.points[0]={x:500,y:504};same.points[1]={x:700,y:504};
  assert.ok(powerlineCircuit(w).runs.every(r=>!r.powered),'matching phases cannot create a short');
});

test('lost terminals detach only their cables; loss of a grate support cannot delete the whole machine',()=>{
  const {w,h}=lab();damageFurnacePart(w,h,6,100);tick(w);
  assert.deepEqual(w.cables[0].attached,[true,false]);assert.ok(w.cables.slice(1).every(c=>c.attached.every(Boolean)));
  carveExplosion(w,{x:1280,y:1000,radius:50});tick(w);assert.ok(!h.done);assert.ok(h.furnaceParts.some(hp=>hp===100));
});

test('phaser damage removes intersected machinery only and never drops the controller or cable state',()=>{
  const {w,h}=lab(),p=w.players[0];Object.assign(p,{x:500,y:1150,weapon:'phaser',aimAngle:0,rig:null});
  firePhaser(w,p,1,0);assert.ok(w.hazards.includes(h));assert.ok(h.furnaceParts.slice(0,3).every(hp=>hp===0));
  assert.ok(h.furnaceParts.slice(3).some(hp=>hp===100));assert.equal(w.cables.length,6);
});

test('damaged machinery, irregular power and cut geometry survive compact hot join and cannot interpolate back to pristine parts',()=>{
  const {w,h}=lab();const before=new RenderSnapshots().make(w.snapshot());damageFurnacePart(w,h,0,100);w.cables[0].links[12]=false;tick(w,400);
  const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  const hot=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(s))),validSnapshot);assert.deepEqual(hot.hazards,s.hazards);
  const view=interpolateStates(before,hot,.2);assert.equal(view.hazards[0].furnaceParts[0],0);
  assert.deepEqual(poweredWirePieces(hot),poweredWirePieces(s));
  for(const patch of [{furnaceParts:[100]},{furnaceParts:Array(12).fill(-1)},{furnaceStage:3},{furnaceLeft:Infinity},{furnaceFault:2},{furnaceCooling:3},{done:true},{furnaceLanes:[1,true,true]}]){
    const bad=structuredClone(s);Object.assign(bad.hazards[0],patch);assert.equal(validSnapshot(bad),false);
  }
});

test('prediction cannot damage machinery, change its cycle or apply wire shocks',()=>{
  const {w,h}=lab();w.prediction=true;const before=structuredClone(h);damageFurnacePart(w,h,0,100);updateHazards(w,1);
  assert.deepEqual(h,before);assert.ok(w.players.every(p=>p.hp===100));
});
