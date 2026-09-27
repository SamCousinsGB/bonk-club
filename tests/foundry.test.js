import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS, STEP } from '../src/engine.js';
import { LADLE_LIP, ladlePose, ladleZone, updateLadle } from '../src/foundry.js';
import { updateHazards } from '../src/hazards.js';
import { updateReactions } from '../src/reactions.js';
import { liquidBounds } from '../src/liquid-geometry.js';
import { moveLiquid } from '../src/liquid.js';
import { releaseCargo, CARGO_LIMIT } from '../src/cargo.js';
import { carveExplosion } from '../src/terrain.js';
import { validSnapshot } from '../src/network.js';
import { RenderSnapshots } from '../src/render-state.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';
const world=()=>{const w=new World({arena:ARENAS.findIndex(a=>a.theme==='foundry'),players:[0,1],shuffle:false,random:()=>.4});w.phase='fight';return w;};

test('both pours begin at their rotated lip, inside the AI warning, with mirrored tilt',()=>{
 const w=world();w.spills=[];
 for(const h of w.hazards.filter(h=>h.type==='ladle')){
  h.age=h.dir>0?6.5:1.5;updateLadle(w,h,STEP);
  const p=ladlePose(h),q=liquidBounds(w.spills.at(-1)),zone=ladleZone(h);
  assert.equal(p.angle,1.1*h.dir);
  assert.ok(Math.abs(p.x-(h.x+LADLE_LIP.x*h.dir*Math.cos(p.angle)-LADLE_LIP.y*Math.sin(p.angle)))<1e-8);
  assert.ok(Math.abs(q.x+q.w/2-p.x)<1e-8);
  assert.ok(Math.abs(q.y+q.h-p.y)<1e-8);
  assert.ok(q.x>=zone.x&&q.x+q.w<=zone.x+zone.w);
  assert.ok(h.active&&h.ladleLeft<3000);
 }
});

test('warning and return rotate continuously without emitting; active pours alternate',()=>{
 const w=world(),[a,b]=w.hazards.filter(h=>h.type==='ladle');w.spills=[];
 a.age=4.5;updateLadle(w,a,STEP);assert.ok(a.warning>0&&!a.active);assert.equal(w.spills.length,0);
 assert.ok(ladlePose(a).angle>0&&ladlePose(a).angle<1.1);
 a.age=6.5;b.age=6.5;updateLadle(w,a,STEP);updateLadle(w,b,STEP);assert.ok(a.active&&!b.active);
 a.age=9.5;const n=w.spills.length;updateLadle(w,a,STEP);assert.equal(w.spills.length,n);assert.ok(ladlePose(a).angle>0&&ladlePose(a).angle<1.1);
});

test('molten metal passes through foundry grating but is contained by solid troughs',()=>{
 const w=world(),h=w.hazards.find(h=>h.type==='ladle');w.spills=[];h.age=6.5;updateLadle(w,h,.05);
 for(let i=0;i<240;i++)moveLiquid(w,STEP);
 assert.ok(w.spills.some(q=>q.grounded&&q.y+q.h===1380));
 assert.ok(w.spills.every(q=>!q.grounded||q.y+q.h!==1010));
});

test('scrap outlets eject bounded physical metal in their belt direction and respect blockage',()=>{
 const w=world();w.cover=[];
 for(const h of w.hazards.filter(h=>h.type==='loader')){
  assert.ok(releaseCargo(w,h));const b=w.cover.at(-1);assert.equal(b.material,'metal');assert.ok(b.mass>0&&b.vx*h.dir>0);
  assert.equal(releaseCargo(w,h),false);
 }
 const h=w.hazards.find(h=>h.type==='loader');
 while(w.cover.length<CARGO_LIMIT){w.cover.forEach(b=>b.y=-150);assert.ok(releaseCargo(w,h));}
 w.cover.forEach(b=>b.y=-150);assert.equal(releaseCargo(w,h),false);
 assert.ok(validSnapshot(w.snapshot()));
});

test('either destroyed ladle attachment stops new liquid, while existing liquid keeps falling',()=>{
 for(const offset of [-70,70]){
  const w=world(),h=w.hazards.find(h=>h.type==='ladle');h.age=6.5;updateLadle(w,h,.05);
  const parcel=w.spills.at(-1),y=parcel.y,n=w.spills.length;
  carveExplosion(w,{x:h.x+offset,y:570,radius:22});updateLadle(w,h,.05);
  assert.ok(h.done&&!h.active);assert.equal(w.spills.length,n);moveLiquid(w,.05);assert.ok(parcel.y>y);
 }
});

test('working scrap, a cut crossing and disabled ladle survive compact hot join and reset',()=>{
 const w=world(),h=w.hazards.find(h=>h.type==='ladle');h.age=6.5;
 updateHazards(w,STEP);releaseCargo(w,w.hazards.find(h=>h.type==='loader'));
 carveExplosion(w,{x:850,y:1010,radius:45});carveExplosion(w,{x:h.x-70,y:570,radius:22});
 updateHazards(w,STEP);updateReactions(w,STEP);
 const s=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
 assert.ok(s&&validSnapshot(s));assert.ok(s.hazards.find(q=>q.id===h.id).done);
 assert.ok(s.cover.some(b=>b.id.startsWith('cargo')&&b.material==='metal'));
 assert.ok(s.platforms.some(p=>p.id.startsWith('cut')));
 w.startRound();assert.ok(w.hazards.every(h=>!h.done));assert.ok(w.hazards.filter(h=>h.type==='ladle').every(h=>h.ladleLeft===3000));
 assert.ok(!w.cover.some(b=>b.id.startsWith('cargo')));assert.ok(validSnapshot(w.snapshot()));
});

