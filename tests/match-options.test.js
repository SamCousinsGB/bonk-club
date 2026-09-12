import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMatchOptions, validMatchOptions, validLobbyState } from '../src/match-options.js';
import { createOfflineRoom } from '../src/offline-room.js';
import { World, ARENAS, WEAPONS, STEP } from '../src/engine.js';
import { chooseWeapon } from '../src/arsenal.js';

test('new lobbies include every map and weapon by default',()=>{
  const options=defaultMatchOptions();
  assert.equal(options.maps.length,ARENAS.length);assert.deepEqual(options.weapons,Object.keys(WEAPONS));
  assert.equal(options.difficulty,'easy');assert.equal(validMatchOptions(options),true);
  for(const players of [null,{},[null]]) assert.equal(validLobbyState({options,revision:0,ready:[1],players}),false);
});
test('a restricted weapon pool governs opening, starter and timed drops on every map',()=>{
  for(let arena=0;arena<ARENAS.length;arena++) {
    const world=new World({players:[0,1],arena,weaponPool:['bubble'],shuffle:false,random:()=>.3});
    for(let round=1;round<=4;round++) {
      world.round=round;world.startRound();
      assert.ok(world.drops.every(d=>d.type==='bubble'),ARENAS[arena].name+' opening');
      world.drops=[];for(let n=0;n<5;n++)world.spawnWeapon();
      assert.ok(world.drops.every(d=>d.type==='bubble'),ARENAS[arena].name+' later pickups');
    }
  }
  assert.throws(()=>new World({weaponPool:[]}),/Choose at least one/);
});
test('weighted and featured pickups never introduce an excluded weapon',()=>{
  const pool=['bat','nuke','tesla'];
  for(let n=0;n<100;n++) assert.ok(pool.includes(chooseWeapon(()=>n/100,new Set(pool),pool)));
  const world=new World({weaponPool:pool,random:()=>.7});
  const found=new Set();
  for(let round=1;round<=9;round++){world.round=round;world.startRound();for(const d of world.drops){assert.ok(pool.includes(d.type));found.add(d.type);}}
  assert.ok(found.has('nuke'));assert.ok(found.has('tesla'));
});
test('selected maps repeat within the chosen pool across round resets',()=>{
  const pool=[0,ARENAS.length-1],world=new World({arena:0,arenaPool:pool,weaponPool:['bat'],random:()=>.4});
  for(let n=0;n<10;n++){world.phase='result';world.phaseTime=0;world.step(STEP);assert.ok(pool.includes(world.arenaIndex));assert.ok(world.drops.every(d=>d.type==='bat'));}
});
test('a nuclear-only selection waits for scheduled rounds without random replacements',()=>{
  const world=new World({weaponPool:['nuke'],shuffle:false,random:()=>.4});
  for(let round=1;round<=6;round++) {
    world.round=round;world.startRound();
    assert.equal(world.drops.length,round%3===0?1:0);
    assert.ok(world.drops.every(d=>d.type==='nuke'));
    world.drops=[];world.spawnWeapon();assert.equal(world.drops.length,0);
    world.phase='fight';world.grenadeTimer=.001;world.step(STEP);assert.equal(world.drops.length,0);
  }
});
test('the independent grenade schedule cannot bypass the chosen weapon pool',()=>{
  const world=new World({weaponPool:['bubble'],shuffle:false,random:()=>.99});
  world.drops=[];world.phase='fight';world.weaponTimer=Infinity;world.grenadeTimer=.001;
  world.step(STEP);assert.equal(world.drops.length,0);
  world.spawnWeapon('grenade');assert.equal(world.drops.length,0);
  world.spawnWeapon('nuke');assert.equal(world.drops.length,0);
});
test('offline Play uses the same slot and match rules without pretending to offer invites',()=>{
  let started=0;const room=createOfflineRoom({onStart:()=>started++},{difficulty:'normal'},'Offline');
  try {
    assert.equal(room.code,'OFFLINE');assert.equal(room.offline,true);
    assert.equal(room.options.difficulty,'normal');
    assert.equal(room.setOptions({...room.options,weapons:['bat'],maps:[0]}),true);
    room.setSlot(1,'closed');room.setSlot(2,'closed');room.setSlot(3,'closed');
    assert.equal(room.start(),false);room.setSlot(1,'ai');assert.equal(room.start(),true);assert.equal(started,1);
  } finally {room.close();}
});
