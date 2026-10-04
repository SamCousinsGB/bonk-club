import test from 'node:test';
import assert from 'node:assert/strict';
import { World, STEP, WEAPONS } from '../src/engine.js';
import { combatFloor } from './helpers.js';
import { traceFlight } from '../src/navigation.js';

function fight(weapon=null) {
  const w=new World({players:[0,1],bots:[1],shuffle:false,random:()=>.45});
  combatFloor(w); w.phase='fight';
  Object.assign(w.players[0],{x:1600,y:535,ground:true,support:'floor0'});
  Object.assign(w.players[1],{x:800,y:535,ground:true,support:'floor0',weapon,ammo:WEAPONS[weapon]?.ammo||0});
  return w;
}
function advance(w,seconds,observe=()=>{}) {
  for(let n=0;n<seconds/STEP&&w.phase==='fight';n++){w.step(STEP);observe(w);}
}

for(const weapon of Object.keys(WEAPONS)) {
  test(`${weapon} bot uses its weapon against an exposed opponent`,()=>{
    const w=fight(weapon);let used=false;
    advance(w,7,()=>{used ||= w.players[1].ammo<WEAPONS[weapon].ammo;});
    assert.ok(used,'must execute a real attack, not just request one');
  });
}

test('a heavy machine gunner climbs to deploy against an elevated opponent',()=>{
  const w=fight('machinegun');
  w.platforms=[{id:'floor0',x:100,y:1000,w:600,h:25},
    {id:'step',x:750,y:830,w:300,h:25},{id:'upper',x:1100,y:660,w:600,h:25}];
  Object.assign(w.players[1],{x:600,y:970});
  Object.assign(w.players[0],{x:1250,y:630,support:'upper'});
  let fired=false,climbed=false;
  advance(w,10,()=>{fired ||= w.players[1].ammo<100;climbed ||= w.players[1].y<800;});
  assert.ok(climbed,'follow a reachable route when the current firing stance is unusable');
  assert.ok(fired,'deploy and shoot after climbing');
});

for(const weapon of [null,'bat','sword','hammer','powerfist']) for(const dir of [-1,1])
test(`${weapon || 'unarmed'} bot fights at the ${dir<0?'left':'right'} edge without a suicidal lunge`,()=>{
  const w=fight(weapon);
  w.platforms=[{id:'floor0',x:700,y:1200,w:160,h:25}];
  Object.assign(w.players[1],{x:780+dir*15,y:1170});
  Object.assign(w.players[0],{x:780+dir*55,y:1170});
  advance(w,2);
  assert.ok(w.players[0].hp<100,'a rejected lunge must still allow a safe grounded strike');
  assert.equal(w.players[1].alive,true);
});

test('a rejected melee lunge on slats does not become a fatal drop-through',()=>{
  const w=fight();
  w.platforms=[{id:'floor0',x:700,y:1200,w:160,h:25,oneWay:true}];
  Object.assign(w.players[1],{x:795,y:1170});
  Object.assign(w.players[0],{x:835,y:1170});
  advance(w,3);
  assert.equal(w.players[1].alive,true);
  assert.equal(w.players[1].support,'floor0');
});

test('a bot routes around an obstruction on the same floor to fetch a weapon',()=>{
  const w=fight();
  w.platforms.push({id:'wall',x:1050,y:405,w:70,h:160});
  w.drops=[{id:'pickup',type:'blaster',x:1240,y:555,vx:0,vy:0,ammo:14,life:90}];
  let acquired=false;
  advance(w,10,()=>{acquired ||= w.players[1].weapon==='blaster';});
  assert.ok(acquired,'same support is not a clear walking route through a wall');
});

test('a bot clears breakable terrain blocking a weapon on its floor',()=>{
  const w=fight();
  w.platforms.push({id:'panel',x:1050,y:405,w:70,h:160,
    destructible:true,material:'wood',hp:90,maxHp:90});
  w.drops=[{id:'pickup',type:'blaster',x:1240,y:555,vx:0,vy:0,ammo:14,life:90}];
  let acquired=false;
  advance(w,8,()=>{acquired ||= w.players[1].weapon==='blaster';});
  assert.ok(acquired,'clear the nearby panel even when the enemy is out of melee range');
});

test('a blocked pickup does not suppress a reachable fight indefinitely',()=>{
  const w=fight();
  w.players[0].x=650;
  w.platforms.push({id:'wall',x:1050,y:65,w:70,h:500});
  w.drops=[{id:'pickup',type:'blaster',x:1240,y:555,vx:0,vy:0,ammo:14,life:90}];
  advance(w,7);
  assert.ok(w.players[0].hp<100,'give up the blocked pickup and fight the reachable opponent');
});

test('a bot executes a checked walk-off route without the edge guard pinning it',()=>{
  const w=fight();
  w.platforms=[{id:'floor0',x:500,y:800,w:300,h:25},
    {id:'ceiling',x:490,y:690,w:320,h:25},
    {id:'lower',x:810,y:1000,w:500,h:25}];
  Object.assign(w.players[1],{x:700,y:770});
  Object.assign(w.players[0],{x:1100,y:970,support:'lower'});
  // Reproduce a graph that currently has only the fastest valid drop. Other
  // takeoffs can still be rebuilding, or be excluded after a failed attempt.
  const edge=traceFlight(w.platforms,w.platforms[0],794,1,0,.38,0,[]);
  assert.equal(edge?.to,'lower');
  w.ai.graph=new Map([['floor0',[edge]]]);
  w.ai.revision=w.terrainVersion;w.ai.rebuildAt=Infinity;
  let landed=false;
  advance(w,6,()=>{landed ||= w.players[1].support==='lower';});
  assert.ok(landed,'the live-validated step down must start before the safety margin');
  assert.ok(w.players[0].hp<100,'resume the fight after landing');
  assert.equal(w.players[1].alive,true);
});
