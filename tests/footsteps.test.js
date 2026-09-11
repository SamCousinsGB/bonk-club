import test from 'node:test';
import assert from 'node:assert/strict';
import { Footsteps } from '../src/footsteps.js';
import { World, STEP } from '../src/engine.js';
import { RenderSnapshots, interpolateStates } from '../src/render-state.js';
import { combatFloor } from './helpers.js';

const player = (patch = {}) => ({id:0,occupant:'sam',alive:true,ground:true,walk:0,x:500,y:535,vy:0,...patch});
const state = (time, p, patch = {}) => ({round:1,arenaIndex:0,time,players:[p],...patch});

test('footfalls follow grounded strides in either direction, with no frame duplicates', () => {
  for (const dir of [1,-1]) {
    const steps=new Footsteps(),p=player(),contacts=[];
    for(let i=0;i<=120;i++){
      p.walk=dir*i/60*15;p.x=500+dir*i/60*240;
      const s=state(i/60,p);contacts.push(...steps.update(s));
      assert.deepEqual(steps.update(s),[]);
    }
    assert.ok(contacts.length>=8&&contacts.length<=10);
    assert.ok(contacts.every(c=>c.name==='footstep'&&c.player===0));
  }
});
test('idle, blocked, lift travel, prone, frozen and recovering fighters have no steps', () => {
  for(const patch of [{}, {prone:true}, {ground:false}, {freeze:1}, {knockdown:1}, {alive:false}, {morphTime:1}]){
    const steps=new Footsteps(),contacts=[];
    for(let i=0;i<=120;i++)contacts.push(...steps.update(state(i/60,player({...patch,x:500+i,walk:Object.keys(patch).length?i/4:0}))));
    assert.deepEqual(contacts,[],JSON.stringify(patch));
  }
});
test('landing makes one heavier contact and no airborne footsteps', () => {
  const steps=new Footsteps();steps.update(state(0,player()));
  for(let i=1;i<=60;i++)assert.deepEqual(steps.update(state(i/60,player({ground:false,vy:i*10,walk:0}))),[]);
  assert.equal(steps.update(state(1.02,player()))[0].name,'landing');
  assert.deepEqual(steps.update(state(1.04,player())),[]);
  assert.deepEqual(steps.update(state(1.06,player())),[]);
});
test('hot join, stalls, teleports, round reset and occupant replacement cannot replay a step backlog', () => {
  const steps=new Footsteps();assert.deepEqual(steps.update(state(3,player({walk:70}))),[]);
  assert.deepEqual(steps.update(state(4,player({walk:85}))),[]);
  assert.deepEqual(steps.update(state(4.02,player({walk:300}))),[]);
  assert.deepEqual(steps.update(state(4.2,player({walk:304,occupant:'new'}))),[]);
  assert.deepEqual(steps.update(state(4.4,player({walk:400}),{round:2})),[]);
  assert.deepEqual(steps.update(null),[]);assert.equal(steps.players.size,0);
});
test('four fighters keep independent contact timing; absent players leave no tracker state', () => {
  const steps=new Footsteps(),players=[0,1,2,3].map(id=>player({id}));
  steps.update({...state(0,players[0]),players});
  const contacts=steps.update({...state(.21,players[0]),players:players.map(p=>({...p,walk:3.2}))});
  assert.equal(contacts.length,4);
  steps.update(state(.23,player()));assert.equal(steps.players.size,1);
});
test('real walking, blocked motion, jumps and guest interpolation drive the same footfalls', () => {
  const w=new World({players:[0,1],bots:[]});combatFloor(w);w.phase='fight';
  const p=w.players[0];Object.assign(p,{x:400,y:535,vx:0,vy:0,ground:true,support:'floor0'});
  Object.assign(w.players[1],{x:2300,y:535,vx:0,vy:0,ground:true,support:'floor0'});
  const host=new Footsteps(),guest=new Footsteps(),wire=new RenderSnapshots();
  let previous=wire.make(w.snapshot()),hostCount=0,guestCount=0;
  host.update(w.snapshot());guest.update(previous);
  for(let i=0;i<240;i++){
    w.step(STEP,{0:{right:true,left:false,jump:false,duck:false,aim:0}});
    hostCount+=host.update(w.snapshot()).length;
    if(i%4===3){
      const next=wire.make(w.snapshot());
      guestCount+=guest.update(interpolateStates(previous,next,.5)).length;
      guestCount+=guest.update(next).length;previous=next;
    }
  }
  assert.ok(hostCount>=8&&hostCount<=10, 'host contacts: '+hostCount);assert.ok(Math.abs(hostCount-guestCount)<=1);
  for(let i=0;i<60;i++){
    w.step(STEP,{0:{right:false,left:false,jump:false,duck:false,aim:0}});
    assert.deepEqual(host.update(w.snapshot()),[]);
  }
});
