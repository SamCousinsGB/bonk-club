import test from 'node:test';
import assert from 'node:assert/strict';
import {World, STEP, cleanInput} from '../src/engine.js';
import {JOINTS, updateRig} from '../src/puppet.js';
import {combatFloor} from './helpers.js';
import {playerBox} from '../src/collision.js';
import {knockDown} from '../src/knockdown.js';
import {RenderSnapshots} from '../src/render-state.js';
import {GuestPrediction} from '../src/guest-prediction.js';
import {validSnapshot, encodeState, decodeState} from '../src/network.js';
import {compactSnapshot, expandSnapshot} from '../src/snapshot-wire.js';
import {carveExplosion} from '../src/terrain.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture() {
  const w=new World({players:[0],shuffle:false,random:()=>.4}); combatFloor(w);
  w.phase='fight';
  const p=w.players[0];Object.assign(p,{x:600,y:535,ground:true,support:'floor0',rig:null});
  const step=(n,input={})=>{for(let t=0;t<n;t++){
    w.time+=STEP;w.move(p,cleanInput(input),STEP);updateRig(p,STEP,w.solids(p),w.time);
  }};
  step(30);
  return {w,p,step};
}

test('held tuck folds the existing rig promptly and rolls in either direction',()=>{
  for(const dir of [-1,1]){
    const {p,step}=fixture(),rig=p.rig,before=structuredClone(rig);
    step(1,{curl:true});
    assert.equal(p.rig,rig);assert.equal(p.curl,true);assert.equal(p.prone,false);
    assert.ok(Math.max(...rig.map((q,i)=>distance(q,before[i])))<12,'entry preserves the pose');
    step(36,{curl:true,left:dir<0,right:dir>0});
    assert.ok(p.vx*dir>200 && p.angularVelocity*dir>6);
    assert.ok(Math.max(...rig.map(q=>distance(q,p)))<32,'compact within 300 ms');
    assert.ok(JOINTS.every(([a,b,l])=>Math.abs(distance(rig[a],rig[b])-l)<1));
    assert.equal(playerBox(p).h,52);
  }
});

test('midair tuck gains modest range, spins and reverses without extra lift',()=>{
  const normal=fixture(),tuck=fixture();
  for(const f of [normal,tuck])f.step(35,{right:true});
  const start=normal.p.x;
  for(const f of [normal,tuck])f.step(1,{right:true,jump:true});
  normal.step(65,{right:true});tuck.step(65,{right:true,curl:true});
  const ratio=(tuck.p.x-start)/(normal.p.x-start);
  assert.ok(ratio>1.1&&ratio<1.23,`bounded range gain ${ratio}`);
  assert.equal(tuck.p.vy,normal.p.vy);assert.equal(tuck.p.jumps,1);
  assert.ok(tuck.p.angularVelocity>9);
  tuck.step(30,{left:true,curl:true});assert.ok(tuck.p.angularVelocity<0,'steering brakes and reverses spin');
  tuck.p.y-=200;
  for(let i=0;i<12;i++)tuck.step(1,{curl:i%2===0});
  assert.equal(tuck.p.jumps,1,'retucking does not create extra jumps');
});

test('ground contacts roll, walls rebound and releasing unfolds without teleporting',()=>{
  const {w,p,step}=fixture();
  w.platforms.push({id:'wall',x:800,y:400,w:40,h:165});
  for(let i=0;i<130 && p.vx>=0;i++)step(1,{right:true,curl:true});
  assert.ok(p.x<=774);assert.ok(p.ground);assert.ok(p.vx<0,'wall contact changes linear momentum');
  const pose=structuredClone(p.rig),angle=p.bodyAngle;
  step(1,{});
  assert.equal(p.curl,false);assert.ok(Math.abs(p.bodyAngle-angle)<.3);
  assert.ok(Math.max(...p.rig.map((q,i)=>distance(q,pose[i])))<15,'limbs unfold from their last pose');
  step(110,{});assert.ok(Math.abs(p.bodyAngle)<.2);assert.equal(p.y,535);
});

test('low ceilings retain the tuck until the standing body has clearance',()=>{
  const {w,p,step}=fixture();step(40,{curl:true});
  w.platforms.push({id:'roof',x:500,y:470,w:300,h:39});
  step(1,{});assert.equal(p.curl,true);assert.equal(p.y,539);
  w.platforms.pop();step(1,{});assert.equal(p.curl,false);assert.equal(p.y,535);
});

test('curl keeps recoil momentum, double jump rules and thin-platform traversal',()=>{
  const {w,p,step}=fixture();p.vx=950;p.impactTime=.4;
  step(1,{right:true,curl:true});assert.ok(p.vx>940);
  step(1,{jump:true,curl:true});step(4,{curl:true});step(1,{jump:true,curl:true});
  assert.equal(p.jumps,2);const vy=p.vy;
  step(1,{curl:true});step(1,{jump:true,curl:true});assert.ok(p.vy>vy);
  const deck={id:'thin',x:300,y:400,w:1200,h:10,oneWay:true};w.platforms.push(deck);
  Object.assign(p,{x:600,y:440,vy:-680,vx:0,ground:false,support:null});
  step(16,{curl:true});assert.ok(p.y<374,'tuck passes up through a slat');
  step(90,{curl:true});assert.equal(p.support,'thin');assert.equal(p.y,374);
});

test('curl does not parry or fire and hits still cause a physical knockdown',()=>{
  const {w,p,step}=fixture();p.weapon='blaster';p.ammo=9;
  for(let i=0;i<30;i++)w.step(STEP,{0:cleanInput({curl:true,attack:true,block:true})});
  assert.equal(p.curl,true);assert.equal(p.block,false);assert.equal(p.ammo,9);
  const old=structuredClone(p.rig);knockDown(p,'hammer');
  assert.equal(p.curl,false);assert.ok(p.knockdown>0);assert.equal(p.rig.length,11);
  assert.deepEqual(p.rig.map(q=>[q.x,q.y]),old.map(q=>[q.x,q.y]));
  step(8,{curl:true});assert.equal(p.curl,false);
});

test('faster lying pose reaches the floor promptly with bent physical joints',()=>{
  const {p,step}=fixture();step(25,{duck:true});
  assert.equal(p.prone,true);assert.ok(Math.abs(p.bodyAngle)>1.2);
  assert.ok(p.rig[0].y>p.y-22,'head lowers within 210 ms');
});

test('holding G through a tuck never manufactures a fresh parry on release',()=>{
  const {p,step}=fixture();step(30,{curl:true,block:true});
  step(1,{block:true});assert.equal(p.block,false);
  step(1,{});step(1,{block:true});assert.equal(p.block,true);
});

test('curled damaged-world hot join preserves limb momentum and guest movement',async()=>{
  const {w,p,step}=fixture();step(35,{curl:true,right:true});step(1,{curl:true,right:true,jump:true});
  step(12,{curl:true,right:true});
  carveExplosion(w,{x:1400,y:565,radius:70});
  const encoder=new RenderSnapshots();
  const s={...encoder.make(w.snapshot()),inputAcks:[0,0,0,0]};
  assert.equal(validSnapshot(s),true);
  const expanded=expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))),validSnapshot);
  assert.ok(expanded);assert.deepEqual(expanded.players[0].motion.curlVelocity,s.players[0].motion.curlVelocity);
  const prediction=new GuestPrediction();prediction.receive(expanded,0,1000);
  for(let i=1;i<=10;i++){
    prediction.advance(cleanInput({curl:true,right:true}),i,1000+i*1000/60);
    step(2,{curl:true,right:true});
  }
  assert.ok(distance(prediction.player,p)<.1);
  assert.ok(Math.abs(prediction.player.bodyAngle-p.bodyAngle)<.006,'within snapshot angle precision');
  assert.ok(prediction.player.rig.every((q,i)=>distance(q,p.rig[i])<.15));
  assert.equal(prediction.sample(s,1170).players[0].curl,true);
  for(const mutate of [q=>q.curl='yes',q=>q.motion.curlDirection=9,
    q=>q.motion.curlVelocity[0].x=Infinity,q=>q.motion.curlVelocity.pop()]){
    const bad=structuredClone(s);mutate(bad.players[0]);assert.equal(validSnapshot(bad),false);
  }
  w.startRound();assert.ok(w.players.every(q=>q.curl===false&&q.angularVelocity===0));
});
