import test from 'node:test';
import assert from 'node:assert/strict';
import { World,STEP } from '../src/engine.js';
import { prepareProp,updateProps } from '../src/props.js';
import { cleanEscapedEntities } from '../src/world-cleanup.js';
import { projectileEscaped } from '../src/projectile-flight.js';
import { validSnapshot } from '../src/network.js';
const world=()=>new World({players:[0,1],shuffle:false,random:()=>.4});
test('escaped props and fragments are removed, release carrying, and do not reappear in hot join',()=>{
  const w=world();w.phase='fight';w.platforms=[];
  const b=prepareProp({id:'fallen',kind:'crate',x:500,y:1700,w:70,h:70,hp:80});w.cover=[b];
  w.chunks=[prepareProp({...b,id:'fragment',chunk:true})];w.players[0].carryId=b.id;
  cleanEscapedEntities(w);assert.equal(w.cover.length,0);assert.equal(w.chunks.length,0);assert.ok(!w.players[0].carryId);
  assert.ok(validSnapshot(w.snapshot()));
});
test('large partly visible props remain until the whole rotated bounds has left',()=>{
  const w=world();w.platforms=[];const b=prepareProp({id:'large',kind:'car',x:-350,y:1000,w:300,h:120,hp:200});w.cover=[b];
  cleanEscapedEntities(w);assert.equal(w.cover.length,1);
  b.x=-1000;updateProps(w,STEP);assert.equal(w.cover.length,0);
});
test('all death poses keep visible limbs and lose escaped ragdolls before lifetime expiry',()=>{
  const w=world();w.kill(w.players[0]);const r=w.ragdolls[0];assert.ok(r);
  for(const p of r.points)p.y=1800;r.points[0].y=1400;
  cleanEscapedEntities(w);assert.equal(w.ragdolls.length,1);
  r.points[0].y=1800;cleanEscapedEntities(w);assert.equal(w.ragdolls.length,0);
});
test('escaped shots are removed without remote explosions or fields, while returning and high arcs remain',()=>{
  const w=world();w.platforms=[];w.cover=[];w.chunks=[];w.hazards=[];
  for(const kind of ['bullet','rocket','grenade','blackhole','duck']) {
    w.projectiles=[{x:1000,y:2300,vx:0,vy:100,life:1,kind,r:5,damage:50,force:500}];
    w.updateProjectiles(STEP);assert.equal(w.projectiles.length,0,kind);
  }
  assert.equal(w.events.filter(e=>e.type==='explosion').length,0);assert.equal(w.fields.length,0);
  assert.equal(projectileEscaped(w,{x:1200,y:-4000,vx:0,vy:-200,kind:'grenade'}),false);
  assert.equal(projectileEscaped(w,{x:3400,y:700,vx:-400,vy:0,kind:'bullet'}),false);
  assert.equal(projectileEscaped(w,{x:3400,y:700,vx:400,vy:0,kind:'boomerang',owner:0}),false);
  w.players[0].alive=false;assert.equal(projectileEscaped(w,{x:3400,y:700,vx:400,vy:0,kind:'boomerang',owner:0}),true);
});
