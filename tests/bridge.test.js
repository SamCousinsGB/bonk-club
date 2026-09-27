import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS, STEP } from '../src/engine.js';
import { cableShotSolids, shootCable } from '../src/heavy-cables.js';
import { validSnapshot } from '../src/room-session.js';
import { carveExplosion } from '../src/terrain.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';

const arena=ARENAS.findIndex(a=>a.bridge);
const advance=(world,seconds)=>{for(let i=0;i<seconds/STEP;i++)world.step(STEP);};

test('bridge traffic, cable damage, collapse, snapshot and round reset',()=>{
  const world=new World({players:[0],fillSolo:false,arena,shuffle:false,random:()=>.5});
  const far=()=>world.platforms.find(p=>p.bridgePanel===7);
  assert.equal(cableShotSolids(world).length,48);
  assert.ok(validSnapshot(world.snapshot()));
  advance(world,7);
  assert.ok(world.cover.some(c=>c.bridgeVehicle&&Math.abs(c.vx)>80));
  assert.ok(validSnapshot(world.snapshot()));
  const originalY=far().y;
  shootCable(world,'bridge0',2);
  advance(world,3);
  assert.ok(far().y>originalY+40,`first cable cut sagged only ${far().y-originalY}`);
  assert.ok(validSnapshot(world.snapshot()));
  for(const c of world.cables)c.links.slice(0,12).forEach((_,i)=>{c.links[i]=false;});
  advance(world,7);
  assert.ok(far().y>1300,`span stopped at ${far().y}`);
  assert.ok(far().x<900,`span did not fold toward tower: ${far().x}`);
  assert.ok(validSnapshot(world.snapshot()));
  const joined=expandSnapshot(compactSnapshot(structuredClone(world.snapshot())),validSnapshot);
  assert.deepEqual(joined.cables,world.snapshot().cables);
  assert.deepEqual(joined.platforms,world.snapshot().platforms);
  assert.deepEqual(joined.cover,world.snapshot().cover);
  world.startRound();
  assert.equal(far().y,850);
  assert.ok(world.cables.every(c=>c.links.every(Boolean)));
  assert.ok(validSnapshot(world.snapshot()));
});

test('a blast cuts moving deck panels without restoring missing steel',()=>{
  const world=new World({players:[0],fillSolo:false,arena,shuffle:false});
  world.phase='fight';
  shootCable(world,'bridge0',1);
  advance(world,2);
  const before=world.platforms.filter(p=>p.bridgePanel===3).reduce((sum,p)=>sum+p.w*p.h,0);
  const panel=world.platforms.find(p=>p.bridgePanel===3);
  carveExplosion(world,{x:panel.x+panel.w/2,y:panel.y+panel.h/2,radius:24});
  const cut=world.platforms.filter(p=>p.bridgePanel===3).reduce((sum,p)=>sum+p.w*p.h,0);
  assert.ok(cut<before);
  advance(world,2);
  assert.equal(world.platforms.filter(p=>p.bridgePanel===3).reduce((sum,p)=>sum+p.w*p.h,0),cut);
  assert.ok(validSnapshot(world.snapshot()));
});
