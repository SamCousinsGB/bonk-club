import test from "node:test";
import assert from "node:assert/strict";
import {World,STEP,ARENAS,WEAPONS} from "../src/engine.js";
import {projectileImpact} from "../src/arsenal.js";
import {navigation,routesFrom,surfaceAt} from "../src/navigation.js";
import {combatFloor} from "./helpers.js";
const advance=(w,t)=>{for(let n=0;n<t/STEP&&w.phase==="fight";n++)w.step(STEP);};
function fight(weapon){const w=new World({bots:[1],shuffle:false,random:()=>.45});combatFloor(w);w.phase="fight";
 Object.assign(w.players[0],{x:1100,y:535,ground:true});Object.assign(w.players[1],{x:500,y:535,ground:true,weapon,ammo:20});return w;}
for(const weapon of ["bat","sword"]) {
 test(`${weapon} bots run into melee range and land a hit without a ranged pickup`,()=>{
  const w=fight(weapon);advance(w,4);assert.ok(w.players[0].hp<100);assert.ok(w.events.some(e=>e.type==="hit"&&e.melee));
 });
 test(`${weapon} bots collect an ordinary pistol when the opponent is distant`,()=>{
  const w=fight(weapon);w.players[0].x=1900;w.drops=[{x:650,y:550,type:"blaster",ammo:14,vx:0,vy:0,life:30}];
  advance(w,2);assert.equal(w.players[1].weapon,"blaster");
 });
}
test("two railgun bots on adjoining floor panels do not veto each other's close-range shot",()=>{
 const w=fight("railgun");w.replacePlayer(0,true);
 w.platforms=[{id:"a",x:80,y:565,w:550,h:25},{id:"b",x:630,y:565,w:150,h:25},{id:"c",x:780,y:565,w:1100,h:25}];
 Object.assign(w.players[0],{x:670,y:535,weapon:"railgun",ammo:4,ground:true});
 Object.assign(w.players[1],{x:700,y:535,ground:true});advance(w,2);
 assert.ok(w.players.some(p=>p.hp<100));assert.ok(w.events.some(e=>e.type==="shoot"));
});
for(const weapon of ["bat","grenade","nuke","machinegun"])
 test(`Garden Houses: bottom-floor ${weapon} bot climbs toward the upper opponent`,()=>{
  const w=new World({bots:[1],arena:16,shuffle:false,random:()=>.45});w.phase="fight";w.hazards=[];w.drops=[];w.weaponTimer=999;
  Object.assign(w.players[0],{x:2020,y:930,ground:true});Object.assign(w.players[1],{x:760,y:1290,ground:true,weapon,ammo:WEAPONS[weapon].ammo});
  let highest=1290,travel=0,oldX=760;
  for(let n=0;n<18/STEP&&w.phase==="fight";n++){w.step(STEP);const p=w.players[1];highest=Math.min(highest,p.y);travel+=Math.abs(p.x-oldX);oldX=p.x;}
  assert.ok(travel>250,`${weapon} never left the bottom position`);
  assert.ok(highest<1120||w.players[0].hp<100,`${weapon} could not climb: ${highest}`);
 });
test("all spawn pairs have traversable routes before any floors are destroyed",()=>{
 for(let arena=0;arena<ARENAS.length;arena++){
  const w=new World({players:[0,1,2,3],arena,shuffle:false});
  const solids=w.solids(),graph=navigation(solids,{time:0,spikes:w.arena.spikes});
  for(const p of w.players){const here=surfaceAt(solids,p),paths=routesFrom(graph,solids,here,p.x,new Map(),0);
   const opponents=w.players.filter(q=>q.id!==p.id);
   assert.ok(opponents.every(q=>paths.has(surfaceAt(solids,q)?.id)),`${w.arena.name} slot ${p.id} lacks a route`);
  }
 }
});
test("close-range projectiles gain bounded damage while long-range base damage remains useful",()=>{
 for(const type of ["blaster","smg","shotgun","minigun","machinegun","burst","flame","frost"]){
  const b={...WEAPONS[type],weapon:type},near=projectileImpact(b,40),far=projectileImpact(b,900);
  assert.ok(near.damage>far.damage*1.2,type);assert.equal(far.damage,b.damage);assert.ok(near.force>far.force);
 }
 assert.ok(WEAPONS.bat.damage>=50&&WEAPONS.sword.damage>=40&&WEAPONS.railgun.damage>=100);
 assert.ok(WEAPONS.grenade.damage>=90&&WEAPONS.rocket.damage>=95);
});
