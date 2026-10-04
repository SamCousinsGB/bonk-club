import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP,W} from '../src/engine.js';
import {CROWN_TARGET,CROWN_RESPAWN,resetCrown,centreCrown,updateCrown,respawnCrownPlayers,crownSpawns} from '../src/crown.js';
import {validSnapshot,encodeState,decodeState} from '../src/room-session.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
import {motionState,mergeMotion,completeMotion} from '../src/motion-stream.js';
import {GuestPrediction} from '../src/guest-prediction.js';
import {defaultMatchOptions,validMatchOptions} from '../src/match-options.js';
import {createOfflineRoom} from '../src/offline-room.js';
import {combatFloor} from './helpers.js';
import {victoryMessage} from '../src/victory.js';
import {surfaceAt} from '../src/navigation.js';

function fixture(options={}) {
  const w=new World({players:[0,1],mode:'crown',shuffle:false,random:()=>.4,...options});
  combatFloor(w);w.cables=[];w.phase='fight';w.hitstop=0;
  for(const [i,p] of w.players.entries())Object.assign(p,{x:350+i*1500,y:535,ground:true,rig:null});
  resetCrown(w);return w;
}
const ticks=(w,n)=>{for(let t=0;t<n;t++)w.step(STEP);};

test('Crown is a host-selected lobby option and changing it clears readiness',()=>{
  const room=createOfflineRoom({},{});
  try {
    assert.equal(room.options.mode,'elimination');
    room.ready.add(1);const revision=room.revision;
    assert.equal(room.setOptions({...room.options,mode:'crown'}),true);
    assert.equal(room.options.mode,'crown');assert.equal(room.revision,revision+1);assert.equal(room.ready.size,0);
    assert.equal(validMatchOptions({...defaultMatchOptions(),mode:'unknown'}),false);
    assert.throws(()=>new World({mode:'unknown'}),/game mode/);
  }finally{room.close();}
});

test('all thirteen arenas start with one central crown and valid reachable-height spawn candidates',()=>{
  for(let arena=0;arena<ARENAS.length;arena++) {
    const w=new World({arena,mode:'crown'});
    assert.equal(w.crown.x,W/2,ARENAS[arena].name);
    assert.equal(w.crown.holder,null);assert.deepEqual(w.crown.times,[0,0,0,0]);
    assert.ok(crownSpawns(w).length>0,ARENAS[arena].name);
    const support=surfaceAt(w.solids(),w.crown);
    assert.ok(support && support.y-w.crown.y<60,ARENAS[arena].name+' crown must be collectable from its actual support');
    assert.equal(validSnapshot(w.snapshot()),true,ARENAS[arena].name);
  }
});

test('automatic pickup requires living contact and line of sight; touching a carrier does not steal it',()=>{
  const w=fixture(),p=w.players[0];
  Object.assign(p,{x:w.crown.x,y:w.crown.y+12});w.crown.lock=0;
  w.platforms.push({id:'wall',x:p.x-12,y:p.y-22,w:24,h:16});
  updateCrown(w,STEP);assert.equal(w.crown.holder,null);
  w.platforms.pop();updateCrown(w,STEP);assert.equal(w.crown.holder,0);
  Object.assign(w.players[1],{x:p.x,y:p.y});updateCrown(w,STEP);assert.equal(w.crown.holder,0);
});

test('possession is cumulative across deaths and changes of carrier',()=>{
  const w=fixture(),p=w.players[0];w.crown.holder=0;
  for(let i=0;i<1200;i++)updateCrown(w,STEP);
  assert.ok(Math.abs(w.crown.times[0]-10)<1e-8);
  w.kill(p);assert.equal(w.crown.holder,null);assert.equal(w.crown.respawn[0],CROWN_RESPAWN);
  w.crown.holder=1;for(let i=0;i<600;i++)updateCrown(w,STEP);
  assert.ok(Math.abs(w.crown.times[1]-5)<1e-8);assert.ok(Math.abs(w.crown.times[0]-10)<1e-8);
  respawnCrownPlayers(w,CROWN_RESPAWN);w.crown.holder=0;updateCrown(w,1);
  assert.ok(Math.abs(w.crown.times[0]-11)<1e-8);
});

test('exactly 30 accumulated seconds wins once, then a new round clears possession',()=>{
  const w=fixture();w.crown.holder=0;w.crown.times[0]=CROWN_TARGET-STEP*2;
  updateCrown(w,STEP);assert.equal(w.phase,'fight');
  updateCrown(w,STEP);assert.equal(w.phase,'result');assert.equal(w.winner,0);assert.equal(w.scores[0],1);
  updateCrown(w,1);assert.equal(w.scores[0],1);
  assert.equal(victoryMessage(w.snapshot(),'Sam').detail,'30 seconds with the crown');
  w.phaseTime=0;w.step(STEP);assert.equal(w.round,2);assert.equal(w.phase,'countdown');
  assert.deepEqual(w.crown.times,[0,0,0,0]);assert.equal(w.scores[0],1);
});

test('infinite respawns keep identity, totals and wins but clear inventory and physical status',()=>{
  const w=fixture();w.crown.times[0]=12;w.scores[0]=3;
  const profile=w.players[0].accessory,occupant=w.players[0].occupant;
  for(let n=0;n<7;n++) {
    const p=w.players[0];p.weapon='bat';p.ammo=4;p.burn=2;p.curl=true;
    w.kill(p);respawnCrownPlayers(w,1.9);assert.equal(w.players[0].alive,false);
    respawnCrownPlayers(w,.11);const q=w.players[0];
    assert.equal(q.alive,true);assert.equal(q.hp,100);assert.equal(q.weapon,null);assert.equal(q.burn,0);
    assert.equal(q.lifeId,n+1);assert.equal(q.occupant,occupant);assert.equal(q.accessory,profile);
    assert.equal(w.crown.times[0],12);assert.equal(w.scores[0],3);
  }
});

test('all-dead and one-survivor states do not end Crown; sudden death never drains health',()=>{
  const w=fixture();w.elapsed=1000;w.kill(w.players[1]);ticks(w,2);
  assert.equal(w.phase,'fight');assert.equal(w.players[0].hp,100);
  w.kill(w.players[0]);ticks(w,2);assert.equal(w.phase,'fight');
  ticks(w,250);assert.ok(w.players.every(p=>p.alive));assert.equal(w.phase,'fight');
});

test('an escaped or abandoned dropped crown returns to the middle without losing totals',()=>{
  const w=fixture();w.crown.times[0]=9;w.crown.loose=true;w.crown.y=2000;
  updateCrown(w,STEP);assert.equal(w.crown.x,W/2);assert.equal(w.crown.loose,false);
  w.crown.loose=true;w.crown.age=8.1;w.crown.x=500;updateCrown(w,STEP);
  assert.equal(w.crown.x,W/2);assert.equal(w.crown.times[0],9);
});

test('a dropped crown collides with thin walls and the carrier can die during the result without invalidating snapshots',()=>{
  const w=fixture();w.platforms.push({id:'wall',x:1400,y:300,w:8,h:265,baseX:1400,baseY:300,dx:0,dy:0});
  Object.assign(w.crown,{x:1380,y:450,vx:600,vy:0,loose:true,lock:.3});
  updateCrown(w,.025);assert.ok(w.crown.x<1388);assert.ok(w.crown.vx<0);
  w.crown.holder=0;w.crown.loose=false;w.crown.times[0]=29.99;updateCrown(w,.02);
  assert.equal(w.phase,'result');w.kill(w.players[0]);assert.equal(w.crown.holder,null);
  assert.equal(w.winner,0);assert.equal(validSnapshot(w.snapshot()),true);
});

test('destroyed spawn points are avoided; total arena loss recovers without awarding or resetting progress',()=>{
  const w=fixture();w.crown.times[0]=17;w.scores[0]=2;
  w.platforms[0].hp=0;for(const p of w.players)w.kill(p);
  respawnCrownPlayers(w,2.1);
  assert.equal(w.phase,'countdown');assert.equal(w.round,1);assert.equal(w.scores[0],2);
  assert.equal(w.crown.times[0],17);assert.ok(w.players.every(p=>p.alive&&p.lifeId===1));
});

test('a sunk liner recovers the arena after all players are awaiting respawn',()=>{
  const w=new World({mode:'crown',arena:ARENAS.findIndex(a=>a.ship)});w.phase='fight';w.ship.sink=1500;
  w.crown.times[1]=21;for(const p of w.players)w.kill(p);respawnCrownPlayers(w,2.1);
  assert.equal(w.ship.sink,0);assert.equal(w.crown.times[1],21);assert.equal(w.phase,'countdown');
});

test('slot replacement and departure release the crown and never transfer accumulated time',()=>{
  const w=fixture({bots:[1]});w.crown.holder=1;w.crown.times[1]=19;
  w.replacePlayer(1,false);assert.equal(w.crown.holder,null);assert.equal(w.crown.times[1],0);
  w.crown.holder=1;w.crown.times[1]=8;
  w.syncSlots(['player','closed','closed','closed'],[{id:0,...w.playerProfile(0)}]);
  assert.equal(w.crown.holder,null);assert.equal(w.crown.times[1],0);assert.equal(validSnapshot(w.snapshot()),true);
});

test('compact damaged-world hot joins and motion updates preserve possession, deaths and respawn timers',async()=>{
  const w=fixture();w.crown.holder=0;w.crown.times[0]=22.75;w.kill(w.players[1]);
  const s=new RenderSnapshots().make(w.snapshot());s.inputAcks=[0,0,0,0];
  assert.equal(validSnapshot(s),true);
  const joined=expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))),validSnapshot);
  assert.deepEqual(joined.crown,s.crown);assert.equal(joined.mode,'crown');
  const motion=motionState(s);assert.equal(completeMotion(motion),true);
  assert.deepEqual(mergeMotion({...joined,time:s.time-1},motion).crown,s.crown);
});

test('malformed crown ownership, times, respawns and life identities are rejected',()=>{
  const w=fixture(),base=structuredClone(w.snapshot());
  assert.equal(validSnapshot(base),true);
  for(const mutate of [s=>s.mode='bad',s=>s.crown=null,s=>s.crown.holder=3,s=>s.crown.holder=.5,
    s=>s.crown.times[0]=31,s=>s.crown.times[0]=NaN,s=>s.crown.respawn[0]=-1,
    s=>s.crown.respawn.push(0),s=>s.crown.x=Infinity,s=>s.players[0].lifeId=-1,
    s=>{s.crown.holder=0;s.players[0].alive=false;}]) {
    const s=structuredClone(base);mutate(s);assert.equal(validSnapshot(s),false);
  }
});

test('a missed death snapshot never interpolates or predicts across a respawn',()=>{
  const w=fixture();ticks(w,2);const pack=new RenderSnapshots();
  const a=pack.make(w.snapshot());a.inputAcks=[0,0,0,0];
  w.kill(w.players[0]);respawnCrownPlayers(w,2.1);w.players[0].x=a.players[0].x+20;w.time+=3;
  const b=pack.make(w.snapshot());b.inputAcks=[0,0,0,0];
  assert.equal(interpolateStates(a,b,.1).players[0].x,b.players[0].x);
  const prediction=new GuestPrediction();prediction.receive(a,0,0);
  prediction.receive(b,0,30);assert.deepEqual(prediction.correction,{x:0,y:0});assert.equal(prediction.player.lifeId,1);
});

test('bots seek the loose crown and prioritise its carrier through ordinary controls',()=>{
  const w=fixture({players:[0,1,2],bots:[1,2]});
  Object.assign(w.players[1],{x:800,y:535});Object.assign(w.players[2],{x:2100,y:535});
  ticks(w,900);assert.ok(w.crown.times.some(t=>t>0),'a bot picks up and holds the crown');
  const target=fixture({players:[0,1,2],bots:[1]});
  Object.assign(target.players[0],{x:500,y:535});Object.assign(target.players[1],{x:800,y:535});Object.assign(target.players[2],{x:1700,y:535});
  target.crown.holder=2;ticks(target,30);
  assert.equal(target.ai.bots.get(1)?.target,2);
});

test('elimination retains its normal winner and never creates a crown',()=>{
  const w=fixture({mode:'elimination'});assert.equal(w.crown,null);
  w.kill(w.players[1]);ticks(w,1);assert.equal(w.winner,0);assert.equal(w.phase,'result');
});
