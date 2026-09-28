import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {colossusBeam,beamX,updateColossus} from '../src/colossus.js';
import {HOLY_FIRE,holyFireStage,holyJoints,holyRadii} from '../src/holy-fire.js';
import {makeRig} from '../src/puppet.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';

function fixture(){
  const w=new World({arena:ARENAS.findIndex(a=>a.colossus),players:[0,1],shuffle:false,random:()=>.42});
  w.phase='fight';w.cover=[];w.drops=[];w.botIds.clear();w.weaponTimer=w.grenadeTimer=999;
  w.platforms=[{id:'floor',x:0,y:1320,w:2560,h:80,material:'stone'}];
  w.players.forEach((p,i)=>{Object.assign(p,{x:i?2450:1280,y:1284,vx:0,vy:0,spawnShield:0});p.rig=makeRig(p);});
  return w;
}
const advance=(w,seconds)=>{for(let i=0;i<Math.ceil(seconds/STEP);i++)w.step(STEP);};
function ignite(w,ids=[0]){
  const h=w.hazards[0];h.age=12;h.strikeX=1280;
  ids.forEach((id,i)=>{const p=w.players[id],b=colossusBeam(h,0,i);
    p.x=beamX(b,p.y);p.rig=makeRig(p);});
  updateColossus(w,h,STEP);return w.ragdolls[0];
}
test('beam starts a distinct terminal holy burn, releases held state and keeps the full sweep running',()=>{
  const w=fixture(),p=w.players[0];p.freeze=2;
  const rag=ignite(w);
  assert.equal(p.alive,false);assert.equal(p.freeze,0);assert.equal(rag.effect,'holy');
  assert.equal(rag.ash,undefined);assert.equal(rag.deathAge,0);assert.equal(rag.life,HOLY_FIRE.duration);
  assert.equal(w.lastDeathCause,'colossus');
  advance(w,1);assert.equal(w.phase,'fight');assert.equal(w.scores[1],0);assert.ok(w.hazards[0].active);
  assert.equal(w.ragdolls.length,1,'repeat beam contacts do not restart or duplicate the burn');
});
test('holy burns swell, blister, physically contort, release into ash and finish before the result',()=>{
  const w=fixture(),rag=ignite(w),initial=structuredClone(rag.points);
  advance(w,1.6);
  assert.ok(holyFireStage(rag.deathAge).swell>.8);assert.ok(holyFireStage(rag.deathAge).blister>.9);
  assert.ok(holyRadii(rag.deathAge)[1]>15,'swollen body has physical thickness');
  const armAngle=pts=>Math.atan2(pts[4].y-pts[1].y,pts[4].x-pts[1].x);
  assert.ok(Math.abs(armAngle(rag.points)-armAngle(initial))>.2,'host points contort rather than just a shader');
  advance(w,2.5);assert.equal(w.phase,'fight');assert.equal(holyJoints(rag).length,0);
  assert.equal(holyFireStage(rag.deathAge).ash,1);assert.equal(w.scores[1],0);
  advance(w,1.2);assert.equal(w.phase,'result');assert.equal(w.winner,1);assert.equal(w.scores[1],1);
  advance(w,.5);assert.equal(w.scores[1],1);assert.equal(w.ragdolls.length,0);
});
test('simultaneous holy burns finish as a draw, and escaped bodies cannot cut the wait short',()=>{
  for(const escape of [false,true]){
    const w=fixture();ignite(w,[0,1]);assert.ok(w.players.every(p=>!p.alive));
    if(escape)w.ragdolls.forEach(r=>r.points.forEach(p=>{p.x=p.px=-500;}));
    advance(w,1);assert.equal(w.phase,'fight');
    if(escape)assert.equal(w.ragdolls.length,0,'fully escaped remains are still cleaned');
    advance(w,4.3);assert.equal(w.phase,'result');assert.equal(w.winner,null);
    assert.deepEqual(w.scores,[0,0,0,0]);
  }
});
test('a later laser victim extends the terminal wait and the completed sweep can change a win into a draw',()=>{
  const w=fixture();ignite(w);advance(w,1);
  const h=w.hazards[0],p=w.players[1],b=colossusBeam(h);p.x=beamX(b,p.y);p.rig=makeRig(p);
  updateColossus(w,h,STEP);assert.equal(p.alive,false);
  advance(w,4.3);assert.equal(w.phase,'fight');
  advance(w,1);assert.equal(w.phase,'result');assert.equal(w.winner,null);
});
test('holy stages and round hold survive compact late join, interpolation and reset; malformed state is rejected',()=>{
  const w=fixture(),rag=ignite(w),wire=new RenderSnapshots();
  for(const duration of [.2,.8,1.2,1.5]){
    advance(w,duration);const a=wire.make(w.snapshot());advance(w,.05);const b=wire.make(w.snapshot());
    const hot=expandSnapshot(compactSnapshot(b),validSnapshot);
    assert.ok(validSnapshot(hot));assert.equal(hot.ragdolls[0].effect,'holy');
    assert.ok(Math.abs(hot.ragdolls[0].deathAge-rag.deathAge)<.006);
    assert.ok(Math.abs(hot.hazards[0].deathUntil-w.hazards[0].deathUntil)<.006);
    const mid=interpolateStates(a,b,.5).ragdolls[0];assert.ok(mid.deathAge>a.ragdolls[0].deathAge);
    assert.equal(mid.netId,hot.ragdolls[0].netId);
    for(const badAge of [-1,Infinity,7]){const bad=structuredClone(hot);bad.ragdolls[0].deathAge=badAge;assert.equal(validSnapshot(bad),false);}
    for(const badEnd of [-1,Infinity,hot.hazards[0].age+6]){const bad=structuredClone(hot);bad.hazards[0].deathUntil=badEnd;assert.equal(validSnapshot(bad),false);}
  }
  w.startRound();assert.equal(w.ragdolls.length,0);assert.equal(w.hazards[0].deathUntil,0);
});
test('holy ash settles on actual collision and expires within its fixed budget',()=>{
  const w=fixture(),p=w.players[0];Object.assign(p,{x:700,y:1000,vx:120,vy:0});p.rig=makeRig(p);
  w.kill(p,{effect:'holy',cause:'colossus'});const rag=w.ragdolls[0];
  for(let i=0;i<3.9/STEP;i++)w.updateRagdolls(STEP);
  const floorY=Math.max(...rag.points.map(p=>p.y))+20;
  w.platforms=[{id:'ash-floor',x:0,y:floorY,w:2560,h:12}];
  for(let i=0;i<.7/STEP;i++)w.updateRagdolls(STEP);
  assert.ok(rag.points.every(p=>p.y<=floorY-1.99));assert.ok(rag.points.some(p=>p.y>floorY-3));
  for(let i=0;i<.7/STEP;i++)w.updateRagdolls(STEP);assert.equal(w.ragdolls.length,0);
});
