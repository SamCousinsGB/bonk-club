import test from 'node:test';
import assert from 'node:assert/strict';
import { crownFocus, crownSeconds, CrownCountdown } from '../src/crown-hud.js';
import { RespawnCue, drawRespawnCue } from '../src/respawn-cue.js';
import { Sound } from '../src/audio.js';

function state() {
  return {round:1,arenaIndex:6,time:10,phase:'fight',players:[
    {id:0,name:'Sam',color:'#4bf',alive:true,lifeId:0,occupant:'sam',x:200,y:400},
    {id:1,name:'Guest',color:'#fb4',alive:true,lifeId:0,occupant:'guest',x:800,y:400}],
    crown:{available:true,holder:1,times:[28,12,0,0]},projectiles:[]};
}

test('central Crown timer follows possession, not the leader; loose crown labels do not imply scoring',()=>{
  const s=state();let f=crownFocus(s);
  assert.equal(f.name,'Guest');assert.equal(f.value,'18.0');assert.equal(f.label,'TO WIN');assert.equal(f.urgent,false);
  s.crown.holder=null;f=crownFocus(s);
  assert.equal(f.name,'Sam');assert.equal(f.value,'2.0');assert.equal(f.status,'LEADER · CROWN LOOSE');assert.equal(f.urgent,false);
  s.crown.available=false;assert.equal(crownFocus(s).status,'CROWN UNAVAILABLE');
  s.crown.times.fill(0);assert.equal(crownFocus(s).label,'TOTAL TO WIN');
  assert.equal(crownFocus({...s,crown:null}),null);
});

test('last five seconds, result and rounding show the actual remaining hold time',()=>{
  const s=state();s.crown.holder=0;s.crown.times[0]=25;
  assert.equal(crownFocus(s).urgent,true);
  s.crown.times[0]=29.999;assert.equal(crownFocus(s).value,'0.1');
  assert.equal(crownSeconds(5.000000000000001),'5.0');
  s.crown.times[0]=30;s.phase='result';s.winner=0;
  assert.equal(crownFocus(s).status,'CROWN WINNER');assert.equal(crownFocus(s).value,'30.0');assert.equal(crownFocus(s).urgent,false);
});

test('countdown audio crosses each final second once; no tick on stale state, catch-up or hot join',()=>{
  const s=state(),cue=new CrownCountdown();s.crown.holder=0;s.crown.times[0]=24.9;
  assert.equal(cue.update(s),null);
  const ticks=[];
  for(let i=0;i<51;i++) { s.time+=.1;s.crown.times[0]=Math.min(30,s.crown.times[0]+.1);const n=cue.update(s);if(n!==null)ticks.push(n);assert.equal(cue.update(s),null); }
  assert.deepEqual(ticks,[5,4,3,2,1]);
  const join=new CrownCountdown();s.crown.times[0]=27.5;assert.equal(join.update(s),null);
  s.time+=2;s.crown.times[0]=29.5;assert.equal(join.update(s),null);
});

test('crown loss, death, new occupant, arena reset and leaving cannot replay old countdown cues',()=>{
  for(const change of ['drop','dead','occupant','life','round','exit']) {
    const s=state(),cue=new CrownCountdown();s.crown.holder=0;s.crown.times[0]=25.9;cue.update(s);
    if(change==='drop'){s.crown.holder=null;cue.update(s);s.crown.holder=0;}
    if(change==='dead'){s.players[0].alive=false;cue.update(s);s.players[0].alive=true;}
    if(change==='occupant')s.players[0].occupant='new';
    if(change==='life')s.players[0].lifeId++;
    if(change==='round')s.round++;
    if(change==='exit')cue.update(null);
    s.time+=.1;s.crown.times[0]=26;assert.equal(cue.update(s),null,change);
  }
});

test('Crown countdown respects mute and voice limits without deferring stale beeps',()=>{
  for(const blocked of ['mute','voices']) {
    const sound=new Sound(),notes=[],s=state();s.crown.holder=0;s.crown.times[0]=24.9;
    sound.ready=()=>!sound.muted;sound.tone=(...args)=>notes.push(args);sound.sample=()=>{};
    sound.update(s);if(blocked==='mute')sound.muted=true;else sound.active=44;
    s.time+=.1;s.crown.times[0]=25;sound.update(s);assert.equal(notes.length,0);
    sound.muted=false;sound.active=0;sound.update(s);assert.equal(notes.length,0);
    s.time+=.1;s.crown.times[0]=26;sound.update(s);assert.equal(notes.length,1);
  }
});

test('local spawn marker expires, follows a new life and never marks the other fighter',()=>{
  const s=state(),cue=new RespawnCue();
  assert.equal(cue.update(s,1).player.id,1);
  s.time+=3;assert.equal(cue.update(s,1),null);
  s.players[1].alive=false;assert.equal(cue.update(s,1),null);
  s.players[1].alive=true;s.players[1].lifeId++;s.time+=.1;
  assert.equal(cue.update(s,1).player.id,1);
  s.players[1].x=1000;s.time+=1;assert.equal(cue.update(s,1).player.x,1000);
  assert.equal(cue.update(s,null),null);
  assert.equal(cue.update(null,1),null);
});

test('spawn marker handles hot join, reused occupants and reset; death and results hide it',()=>{
  const s=state(),cue=new RespawnCue();s.players[0].lifeId=19;
  assert.ok(cue.update(s,0));s.time+=5;assert.equal(cue.update(s,0),null);
  s.players[0].occupant='replacement';assert.ok(cue.update(s,0));
  s.players[0].alive=false;assert.equal(cue.update(s,0),null);
  s.round++;s.time=0;s.players[0].alive=true;assert.ok(cue.update(s,0));
  s.phase='result';assert.equal(cue.update(s,0),null);
});

test('reduced motion keeps the red respawn arrow steady and labelled',()=>{
  function drawing(age,reduced) {
    const calls=[];const c=new Proxy({}, {get:(o,k)=>o[k]??((...a)=>calls.push([k,...a])),set:(o,k,v)=>{calls.push([k,v]);o[k]=v;return true;}});
    drawRespawnCue(c,{player:state().players[0],age},reduced);return calls;
  }
  assert.deepEqual(drawing(.1,true),drawing(.8,true));
  assert.notDeepEqual(drawing(.1,false),drawing(.8,false));
  assert.ok(drawing(.1,true).some(c=>c[0]==='fillText'&&c[1]==='YOU'));
});
