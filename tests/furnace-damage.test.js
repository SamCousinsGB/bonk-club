import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS, STEP } from '../src/engine.js';
import { updateHazards } from '../src/hazards.js';
import { carveExplosion } from '../src/terrain.js';
import { damageFurnacePart, furnacePartBox, blastFurnace, furnaceHits, initialFurnacePieces } from '../src/furnace-parts.js';
import { powerlineCircuit, poweredWirePieces } from '../src/powerline-circuit.js';
import { updateCables, blastCables } from '../src/heavy-cables.js';
import { validSnapshot } from '../src/network.js';
import { RenderSnapshots, interpolateStates } from '../src/render-state.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';
import { furnaceStreams, updateFurnaceFlow } from '../src/furnace-flow.js';
import { firePhaser } from '../src/phaser.js';

function lab() {
  const w=new World({arena:ARENAS.findIndex(a=>a.furnace),players:[0,1],bots:[],shuffle:false,random:()=>.4});
  w.phase='fight';w.cover=[];w.drops=[];w.water=[];w.spills=[];w.gas=[];
  return {w,h:w.hazards[0]};
}
const tick=(w,n=1)=>{for(let i=0;i<n;i++){w.time+=STEP;updateCables(w,STEP);updateHazards(w,STEP);}};

const metalAt=(h,x,y)=>h.furnacePieces.some(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h);
test('blast carves a circular hole rather than deleting a panel; another impact extends that hole and reset restores steel',()=>{
  const {w,h}=lab();const cut={x:1100,y:1160,radius:40};
  carveExplosion(w,cut);assert.ok(!h.done);assert.ok(!metalAt(h,-180,160));
  assert.ok(metalAt(h,-240,160));assert.ok(metalAt(h,-180,220));
  assert.ok(h.furnaceParts[0]>80);assert.equal(h.furnaceParts[1],100);
  const area=()=>h.furnacePieces.reduce((n,p)=>n+p.w*p.h,0),before=area();
  carveExplosion(w,{...cut,x:1130});assert.ok(area()<before);assert.ok(!metalAt(h,-140,160));
  assert.ok(h.furnaceLeaks.length>0);tick(w);assert.ok(h.furnaceFault>0);
  w.startRound();assert.deepEqual(w.hazards[0].furnacePieces,initialFurnacePieces());assert.deepEqual(w.hazards[0].furnaceLeaks,[]);
});

test('ordinary projectile hits damage the actual shell and respect nearer cover',()=>{
  for(const cover of [false,true]){
    const {w,h}=lab();w.platforms=cover?[{id:'shield',x:940,y:1090,w:20,h:100}]:[];
    w.projectiles=[{x:900,y:1140,vx:3000,vy:0,life:1,r:3,kind:'bullet',damage:30,force:100,owner:0}];
    w.updateProjectiles(.08);
    assert.ok(cover?h.furnaceParts[0]===100:h.furnaceParts[0]<100&&h.furnaceParts[0]>90);if(!cover){assert.ok(!metalAt(h,-253,140));assert.ok(metalAt(h,-253,190));assert.equal(h.furnaceLeaks.length,1);}assert.ok(!h.done);
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
  const {w,h}=lab();blastFurnace(w,{x:1035,y:600,radius:17});tick(w);
  assert.deepEqual(w.cables[0].attached,[true,false]);assert.ok(w.cables.slice(1).every(c=>c.attached.every(Boolean)));
  carveExplosion(w,{x:1280,y:1000,radius:50});tick(w);assert.ok(!h.done);assert.ok(h.furnaceParts.some(hp=>hp===100));
});

test('phaser damage removes intersected machinery only and never drops the controller or cable state',()=>{
  const {w,h}=lab(),p=w.players[0];Object.assign(p,{x:500,y:1150,weapon:'phaser',aimAngle:0,rig:null});
  const beam=firePhaser(w,p,1,0);assert.ok(w.hazards.includes(h));assert.ok(h.furnaceParts.slice(0,3).every(hp=>hp>0&&hp<100));
  assert.ok(h.furnaceParts.slice(3).some(hp=>hp===100));assert.equal(w.cables.length,6);
  w.platforms=[];w.projectiles=[{x:800,y:beam.y,vx:4000,vy:0,life:1,r:3,kind:'bullet',damage:30,force:100,owner:0}];
  w.updateProjectiles(.25);assert.equal(w.projectiles.length,1);assert.ok(w.projectiles[0].x>1700,'shots cross the open beam cut');
});

test('damaged machinery, irregular power and cut geometry survive compact hot join and cannot interpolate back to pristine parts',()=>{
  const {w,h}=lab();const before=new RenderSnapshots().make(w.snapshot());damageFurnacePart(w,h,0,100);w.cables[0].links[12]=false;tick(w,400);
  const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  const hot=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(s))),validSnapshot);assert.deepEqual(hot.hazards,s.hazards);
  const view=interpolateStates(before,hot,.2);assert.deepEqual(view.hazards[0].furnacePieces,hot.hazards[0].furnacePieces);assert.deepEqual(view.hazards[0].furnaceLeaks,hot.hazards[0].furnaceLeaks);
  assert.deepEqual(poweredWirePieces(hot),poweredWirePieces(s));
  for(const patch of [{furnaceParts:[100]},{furnaceParts:Array(12).fill(-1)},{furnaceStage:3},{furnaceLeft:Infinity},{furnaceFault:2},{furnaceCooling:3},{done:true},{furnaceLanes:[1,true,true]},{furnacePieces:[{part:99,x:0,y:0,w:10,h:10}]},{furnaceMelt:2},{furnaceLeaks:[{x:0,y:100,r:200,born:0}]}]){
    const bad=structuredClone(s);Object.assign(bad.hazards[0],patch);assert.equal(validSnapshot(bad),false);
  }
});

test('prediction cannot damage machinery, change its cycle or apply wire shocks',()=>{
  const {w,h}=lab();w.prediction=true;const before=structuredClone(h);damageFurnacePart(w,h,0,100);updateHazards(w,1);
  assert.deepEqual(h,before);assert.ok(w.players.every(p=>p.hp===100));
});


test('molten stream starts at the actual breach, bends under gravity and stops at the first surviving platform',()=>{
  const {w,h}=lab();blastFurnace(w,{x:1080,y:1160,radius:45});h.age=1;
  w.platforms=[{id:'catch',x:500,y:1250,w:800,h:24}];
  const s=furnaceStreams(h,w.platforms)[0];assert.ok(s.landed);
  assert.equal(s.points[0].x,1080);assert.equal(s.points[0].y,1160);
  assert.ok(s.points.at(-1).x<1050);assert.ok(s.points.at(-1).y<1250);
  const last=s.points.at(-1);w.platforms=[];
  assert.ok(furnaceStreams(h,w.platforms)[0].points.at(-1).y>last.y+100);
});

test('only contact with the real molten stream burns; a platform shields fighters below it',()=>{
  const {w,h}=lab();blastFurnace(w,{x:1080,y:1160,radius:45});h.age=1;
  w.platforms=[{id:'catch',x:500,y:1250,w:800,h:24}];
  const s=furnaceStreams(h,w.platforms)[0],q=s.points[Math.floor(s.points.length/2)];
  Object.assign(w.players[0],{x:q.x,y:q.y,hp:100,alive:true});Object.assign(w.players[1],{x:s.points.at(-1).x,y:1330,hp:100,alive:true});
  updateFurnaceFlow(w,h,STEP);assert.equal(w.players[0].alive,false);assert.equal(w.players[1].hp,100);
});

test('leaking lowers the finite melt below a breach, stopping its stream; intact or empty vessels do not leak',()=>{
  const {w,h}=lab();assert.deepEqual(furnaceStreams(h),[]);blastFurnace(w,{x:1080,y:1160,radius:45});h.age=2;
  for(let i=0;i<120*90;i++)updateFurnaceFlow(w,h,STEP);
  assert.ok(h.furnaceMelt<.555);assert.deepEqual(furnaceStreams(h),[]);
  h.furnaceMelt=0;assert.deepEqual(furnaceStreams(h),[]);
});

test('a projectile can pass through a bored hole and every later cut keeps existing voids open',()=>{
  const {w,h}=lab();w.platforms=[];blastFurnace(w,{x:1080,y:1160,radius:100});
  assert.ok(!furnaceHits(w).some(p=>p.x<=1080&&p.x+p.w>=1080&&p.y<=1160&&p.y+p.h>=1160));
  for(let i=0;i<100;i++)blastFurnace(w,{x:1030+(i*37)%500,y:1040+(i*53)%260,radius:8+i%17});
  assert.ok(!metalAt(h,-200,160));assert.ok(h.furnacePieces.length<=2048);assert.ok(h.furnaceLeaks.length<=12);
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});

test('consuming all vessel metal cannot leave streams pouring from an invisible reservoir',()=>{
  const {w,h}=lab();blastFurnace(w,{x:1080,y:1160,radius:45});assert.equal(h.furnaceLeaks.length,1);
  blastFurnace(w,{x:1280,y:1175,radius:400});assert.equal(h.furnaceMelt,0);assert.deepEqual(h.furnaceLeaks,[]);
  h.age=3;assert.deepEqual(furnaceStreams(h),[]);assert.ok(!h.done);
});

test('angled beam cuts through previously cratered steel keep valid quantized geometry',()=>{
  for(const angle of [0,.09,.21]){
    const {w,h}=lab();for(let i=0;i<8;i++)blastFurnace(w,{x:1050+i*32.31,y:1050+i*17.17,radius:31.23});
    const p=w.players[0];Object.assign(p,{x:600,y:1100,weapon:'phaser',aimAngle:angle,rig:null});
    firePhaser(w,p,Math.cos(angle),Math.sin(angle));
    const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
    assert.ok(h.furnacePieces.every(p=>p.w>=.5&&p.h>=.5));
  }
});
