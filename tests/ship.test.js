import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP,cleanInput} from '../src/engine.js';
import {SHIP,shipOpenings,updateShip,shipWaterAt,shipCapacity,shipLevels,volumeAt,swimPlayer,shipPose,shipLocalPoint} from '../src/ship.js';
import {carveExplosion} from '../src/terrain.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {GuestPrediction} from '../src/guest-prediction.js';
import {prepareProp} from '../src/props.js';
const fixture=()=>{const w=new World({arena:ARENAS.findIndex(a=>a.ship),players:[0,1],shuffle:false,random:()=>.4});w.phase='fight';w.weaponTimer=w.grenadeTimer=999;return w;};
const advance=(w,t)=>{for(let n=0;n<Math.round(t/STEP);n++)updateShip(w,STEP);};
const breach=(w,x=850)=>carveExplosion(w,{x,y:1140,radius:95});
const total=w=>w.ship.volumes.reduce((a,b)=>a+b,0);

test('intact hull floats dry; dents and above-water shell damage stay dry',()=>{
  for(const blast of [null,{x:850,y:1186,radius:30},{x:216,y:711,radius:24}]) {
    const w=fixture();if(blast)carveExplosion(w,blast);advance(w,15);
    assert.equal(total(w),0);assert.ok(Math.abs(w.ship.sink)<2);assert.ok(validSnapshot(w.snapshot()));
  }
});
test('a through-hull blast floods only the breached watertight compartment first',()=>{
  const w=fixture();breach(w);assert.ok(shipOpenings(w).some(b=>b.i===1&&b.j===-1));advance(w,3);
  assert.ok(w.ship.volumes[1]>10000);assert.equal(w.ship.volumes[0],0);assert.equal(w.ship.volumes[2],0);
  assert.ok(w.ship.sink>0);assert.ok(w.ship.angle<0);
});
test('bullet damage to an actual keel panel admits water',()=>{
  const w=fixture(),p=w.platforms.find(p=>p.shipHull&&p.y===1130&&p.x>700);w.damageCover(p,130);advance(w,1);
  assert.ok(total(w)>1000);assert.ok(validSnapshot(w.snapshot()));
});
test('single shot-out side plates each open a passage, including between coarse floor samples',()=>{
  for(const side of [-1,1])for(const y of [950,986,1022]) {
    const w=fixture(),p=w.platforms.find(p=>p.shipHull&&p.y===y&&(p.x<1280? -1:1)===side);
    assert.ok(p);shipOpenings(w);w.damageCover(p,130);advance(w,.3);
    assert.ok(total(w)>0,`${side} ${y}`);
  }
});
test('intact bulkheads retain water and broken bulkheads equalize with conserved volume',()=>{
  const w=fixture();w.ship.volumes[1]=60000;advance(w,2);assert.equal(w.ship.volumes[2],0);
  const before=total(w);carveExplosion(w,{x:1078,y:1050,radius:62});advance(w,3);
  assert.ok(w.ship.volumes[2]>10000);assert.ok(Math.abs(total(w)-before)<.01);
});
test('water overtops intact low bulkheads when its actual free surface reaches the crest',()=>{
  const w=fixture();w.ship.volumes[1]=160000;advance(w,.5);
  assert.ok(w.ship.volumes[0]>0);assert.ok(w.ship.volumes[2]>0);assert.ok(Math.abs(total(w)-160000)<.1);
});
test('progressive flooding exhausts reserve buoyancy and sinks the ship',()=>{
  const w=fixture();for(const x of [510,850,1280,1680,2050])breach(w,x);advance(w,35);
  assert.ok(w.ship.sink>500);assert.ok(total(w)>650000);assert.ok(validSnapshot(w.snapshot()));
});
test('opposite asymmetric flood weights heel in opposite directions',()=>{
  for(const [cell,sign] of [[0,-1],[4,1]]){const w=fixture();w.ship.volumes[cell]=70000;advance(w,3);assert.ok(w.ship.angle*sign>.04);}
});
test('tilted free surfaces preserve finite compartment volume',()=>{
  const w=fixture();for(const angle of [-.5,0,.5])for(let i=0;i<5;i++) {
    w.ship.angle=angle;w.ship.volumes[i]=shipCapacity(i)*.4;
    assert.ok(Math.abs(volumeAt(i,shipLevels(w.ship)[i],-Math.tan(angle))-w.ship.volumes[i])<1);
  }
});
test('saturated compartments have bounded pressure at their upper edge',()=>{
  const w=fixture();for(const angle of [-.5,0,.5])for(let i=0;i<5;i++) {
    w.ship.angle=angle;w.ship.volumes[i]=shipCapacity(i);const level=shipLevels(w.ship)[i];
    assert.ok(level>100&&level<1200);assert.ok(Math.abs(volumeAt(i,level,-Math.tan(angle))-shipCapacity(i))<.001);
  }
});
test('head immersion drains oxygen, dry air restores it, and drowning has a truthful cause',()=>{
  const w=fixture(),p=w.players[0];Object.assign(p,{x:1200,y:1050,rig:null});w.ship.volumes[2]=160000;
  for(let n=0;n<600;n++)swimPlayer(w,p,cleanInput({}),STEP);
  assert.ok(Math.abs(p.oxygen-7)<.01);assert.equal(p.submerged,true);assert.equal(p.hp,100);
  p.y=680;swimPlayer(w,p,cleanInput({}),1);assert.ok(p.oxygen>9.9);
  p.y=1050;p.oxygen=0;p.hp=.01;swimPlayer(w,p,cleanInput({}),STEP);assert.equal(p.alive,false);assert.equal(w.lastDeathCause,'drowning');
});
test('swimming follows aim and permits primary fire',()=>{
  for(const aim of [-Math.PI/2,0,Math.PI]) {
    const w=fixture(),p=w.players[0];Object.assign(p,{x:1200,y:1030,rig:null,weapon:'railgun',ammo:3});w.ship.volumes[2]=160000;
    for(let n=0;n<24;n++)w.step(STEP,{0:{attack:true,aim}});
    assert.ok(p.ammo<3);assert.ok(w.events.some(e=>e.type==='shoot'));assert.ok(p.swimming&&p.swimStroke);
  }
});
test('ocean exists outside the vessel, but intact dry rooms below sea level contain air',()=>{
  const w=fixture();assert.ok(shipWaterAt(w,100,1000));assert.equal(shipWaterAt(w,850,1050),null);
});
test('flood water moves physical cargo and dead bodies with buoyancy and drag',()=>{
  const w=fixture();w.ship.volumes[2]=160000;
  const b=prepareProp({id:'floating',x:1190,y:1000,w:60,h:60,kind:'crate',hp:100,maxHp:100});w.cover=[b];
  b.fire=3;
  w.ragdolls=[{points:[{x:1210,y:1040,px:1210,py:1040}]}];updateShip(w,STEP);
  assert.ok(b.vy<0);assert.ok(w.ragdolls[0].points[0].py>1040);
  assert.equal(b.fire,0);assert.ok(b.soaked>0);
});
test('guest swimming uses the same movement without consuming oxygen or changing flooding',()=>{
  const w=fixture();w.ship.volumes[2]=120000;Object.assign(w.players[1],{x:1250,y:1030,rig:null});
  const snapshot={...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]},saved=structuredClone(snapshot),guest=new GuestPrediction();
  guest.receive(snapshot,1,1000);const input=cleanInput({attack:true,aim:-Math.PI/2});guest.advance(input,1,1017);
  const p=w.players[1];for(let i=0;i<2;i++) {
    w.move(p,input,STEP);
    if(p.cooldown<=0)w.attack(p);
  }
  assert.ok(Math.abs(guest.player.x-p.x)<.01);assert.ok(Math.abs(guest.player.y-p.y)<.01);
  assert.equal(guest.player.oxygen,12);assert.deepEqual(snapshot,saved);
});
test('hot join retains hull damage, finite flood mass and pose; reset restores the vessel',()=>{
  const w=fixture();breach(w);advance(w,3);const snapshot=new RenderSnapshots().make(w.snapshot());
  assert.ok(validSnapshot(snapshot));assert.ok(snapshot.ship.volumes[1]>0);assert.ok(snapshot.platforms.some(p=>p.sourceId));
  const next=structuredClone(snapshot);next.ship.sink+=10;next.ship.angle+=.02;
  const mid=interpolateStates(snapshot,next,.5);assert.equal(mid.ship.sink,snapshot.ship.sink+5);
  for(const corrupt of [s=>s.ship.volumes[0]=-1,s=>s.ship.angle=Infinity,s=>s.ship.volumes.push(1),s=>s.players[0].oxygen=20,s=>s.arenaIndex=0]){
    const bad=structuredClone(snapshot);corrupt(bad);assert.equal(validSnapshot(bad),false);
  }
  w.startRound();assert.equal(total(w),0);assert.equal(w.ship.sink,0);assert.equal(shipOpenings(w).filter(b=>b.j===-1).length,0);
});
test('inverse ship transform keeps mouse aim aligned through list and sinking',()=>{
  for(const angle of [-.5,0,.5])for(const sink of [0,400,1000]) {
    const s={angle,sink},pose=shipPose(s),p={x:870,y:1010},x=p.x-1280,y=p.y-800;
    const q=shipLocalPoint({x:1280+pose.scale*(x*Math.cos(angle)-y*Math.sin(angle)),y:800+pose.y+pose.scale*(x*Math.sin(angle)+y*Math.cos(angle))},s);
    assert.ok(Math.hypot(q.x-p.x,q.y-p.y)<1e-8);
  }
});
test('submerged liner bots retain combat decisions and damage opponents',()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.ship),players:[0,1],bots:[0,1],shuffle:false,random:()=>.4});
  w.phase='fight';w.weaponTimer=w.grenadeTimer=999;w.ship.volumes[2]=160000;
  for(const [id,p] of w.players.entries())Object.assign(p,{x:1200+id*140,y:1030,ground:false,weapon:'blaster',ammo:14,rig:null});
  for(let n=0;n<2/STEP&&w.phase==='fight';n++)w.step(STEP);
  assert.ok(w.players.some(p=>p.hp<100));assert.ok(w.events.some(e=>e.type==='shoot'));
});
