import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS, STEP } from '../src/engine.js';
import { cableShotSolids, shootCable } from '../src/heavy-cables.js';
import { validSnapshot } from '../src/room-session.js';
import { carveExplosion } from '../src/terrain.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';
import { updateBridge } from '../src/bridge.js';
import { bridgeBayMounts } from '../src/bridge-arena.js';
import { prepareProp } from '../src/props.js';
import { carPoints } from '../src/assembly-geometry.js';

const arena=ARENAS.findIndex(a=>a.bridge);
const advance=(world,seconds)=>{for(let i=0;i<seconds/STEP;i++)world.step(STEP);};

test('a pistol shot severs the physical main cable',()=>{
  const world=new World({players:[0],fillSolo:false,arena,shuffle:false});
  const cable=world.cables[0],point=cable.points[5];
  world.projectiles=[{x:point.x-25,y:point.y,vx:5000,vy:0,kind:'bullet',weapon:'blaster',
    damage:24,force:440,life:1,r:4,owner:0,hitIds:[],age:0}];
  world.updateProjectiles(STEP);
  assert.equal(cable.links.filter(Boolean).length,23);
  assert.ok(validSnapshot(world.snapshot()));
});

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

test('maintenance bays follow suspension damage, retain blast cuts and fall when both mounts are lost',()=>{
  const world=new World({players:[0],fillSolo:false,arena,shuffle:false});
  const bay=()=>world.platforms.filter(p=>p.bridgeBay===0);
  assert.equal(bridgeBayMounts(world.platforms,0).filter(Boolean).length,2);
  shootCable(world,'bridge0',1);
  for(let i=0;i<480;i++)updateBridge(world,STEP);
  assert.ok(bay()[0].y>1200,'maintenance route must move with its road span');
  const p=bay()[0];
  carveExplosion(world,{x:p.x+p.w/2,y:p.y+9,radius:24});
  const area=()=>bay().reduce((sum,p)=>sum+p.w*p.h,0),cut=area();
  assert.ok(cut<380*18);
  for(let i=0;i<120;i++)updateBridge(world,STEP);
  assert.equal(area(),cut,'moving gantry must not restore its crater');
  const joined=expandSnapshot(compactSnapshot(structuredClone(world.snapshot())),validSnapshot);
  assert.deepEqual(joined.platforms,world.snapshot().platforms);
  world.platforms=world.platforms.filter(p=>![1,5].includes(p.bridgePanel));
  assert.ok(bridgeBayMounts(world.platforms,0).every(p=>p===null));
  for(let i=0;i<360;i++)updateBridge(world,STEP);
  assert.equal(bay().length,0,'escaped gantry clears collision and snapshots');
  world.startRound();assert.equal(bay()[0].y,1110);assert.equal(area(),380*18);
});

test('left-bound traffic accelerates downhill and its silhouette faces travel',()=>{
  const world=new World({players:[0],fillSolo:false,arena,shuffle:false});world.phase='fight';
  const floor=world.platforms.find(p=>p.bridgePanel===5),next=world.platforms.find(p=>p.bridgePanel===4);
  next.y+=25;
  const car=prepareProp({id:'slope-car',kind:'car',x:floor.x-50,y:floor.y-105,w:210,h:105,
    hp:170,maxHp:170,mass:190,carStage:31,bridgeVehicle:true,bridgeDir:-1,vx:-450});
  world.cover=[car];updateBridge(world,STEP);
  assert.ok(car.vx<-450,`left-bound downhill speed ${car.vx}`);
  const left=carPoints(car),right=carPoints({...car,bridgeDir:1});
  left.forEach((p,i)=>{assert.ok(Math.abs(p.x+right[i].x-2*(car.x+car.w/2))<.001);assert.equal(p.y,right[i].y);});
});

test('bridge snapshots reject malformed bay metadata and non-finite motion',()=>{
  const world=new World({players:[0],fillSolo:false,arena,shuffle:false});
  for(const [key,value] of [['bridgeBay',3],['bridgePart','wall'],['bridgeVy',NaN],['bridgeOffsetX',Infinity]]){
    const s=structuredClone(world.snapshot());s.platforms.find(p=>p.bridgeBay===0)[key]=value;
    assert.equal(validSnapshot(s),false,key);
  }
});

test('tower doorways let unarmed bots actually reach the contested road weapons',()=>{
  let seed=4821;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const world=new World({players:[0,1,2,3],bots:[0,1,2,3],arena,shuffle:false,random});
  advance(world,5);
  for(const id of [2,3]){
    const p=world.players.find(p=>p.id===id);
    assert.ok(p.weapon,`bot ${id} failed to leave its room and collect a weapon`);
    assert.ok(p.y>650,`bot ${id} is still inside the tower`);
  }
});
