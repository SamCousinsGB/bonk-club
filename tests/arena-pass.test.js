import test from "node:test";
import assert from "node:assert/strict";
import {World,ARENAS,STEP,cleanInput,WEAPONS} from "../src/engine.js";
import {nearFixture,fixtureBounds} from "../src/arena-dressing.js";
import {navigation,routesFrom,surfaceAt} from "../src/navigation.js";
import {createHazards,updateHazards,HAZARD_TYPES} from "../src/hazards.js";
import {validSnapshot} from "../src/network.js";
import {combatFloor} from "./helpers.js";
import {prepareProp,updateProps} from "../src/props.js";

test("round starts are unarmed with only contested pickups away from starting positions",()=>{
  for(let arena=0;arena<ARENAS.length;arena++)for(const round of [1,2,3,4]){
    const w=new World({arena,players:[0,1,2,3],shuffle:false,random:()=>.35});
    w.round=round;w.startRound();
    assert.equal(w.drops.length,w.arena.weapons.length,w.arena.name);
    for(const p of w.players){
      assert.equal(p.weapon,null);assert.equal(p.ammo,0);
      if(!w.arena.survival)assert.ok(!nearFixture(p.x,p.y,w.hazards,100),w.arena.name);
      for(const d of w.drops){
        assert.ok(Math.hypot(d.x-p.x,d.y-p.y)>=250,`${w.arena.name}: pickup at slot ${p.id}`);
        assert.ok(!nearFixture(d.x,d.y,w.hazards,45));
      }
    }
    assert.ok(validSnapshot(w.snapshot()));
  }
});

test("all contested opening pickups are reachable from every spawn and outside fixture footprints",()=>{
  for(let arena=0;arena<ARENAS.length;arena++){
    if(ARENAS[arena].survival)continue;
    const w=new World({arena,players:[0,1,2,3],shuffle:false,random:()=>.45});
    assert.ok(w.arena.weapons.length>=2,w.arena.name);
    const solids=w.solids(),graph=navigation(solids,{time:0,spikes:w.arena.spikes});
    for(const p of w.players){
      const paths=routesFrom(graph,solids,surfaceAt(solids,p),p.x,new Map(),0);
      for(const [x,y] of w.arena.weapons){
        assert.ok(paths.has(surfaceAt(solids,{x,y})?.id),`${w.arena.name} slot ${p.id} -> ${x},${y}`);
        assert.ok(!nearFixture(x,y,w.hazards,45),w.arena.name);
      }
    }
    assert.ok(validSnapshot(w.snapshot()),w.arena.name);
  }
});

function fixture(type) {
  const w=new World({shuffle:false,random:()=>.5});combatFloor(w);w.phase="fight";
  w.arena={...w.arena,traps:[{type,x:650,y:565,w:260,h:190,dir:1}]};
  w.hazards=createHazards(w);const h=w.hazards[0];h.cooldown=0;
  Object.assign(w.players[0],{x:690,y:535,ground:true,vx:0,vy:0});
  Object.assign(w.players[1],{x:1500,y:535,ground:true});return {w,h,p:w.players[0]};
}
function advance(w,t){for(let n=0;n<t/STEP;n++){w.time+=STEP;updateHazards(w,STEP);}}
for(const type of ["xray","steam","frost","spores"])test(`${type} warns without damage, then affects only exposed fighters`,()=>{
  const {w,h,p}=fixture(type);advance(w,.8);assert.equal(p.hp,100);assert.ok(h.warning>0);
  Object.assign(w.players[1],{x:650,y:350});w.platforms.push({id:"shield",x:560,y:380,w:180,h:24,baseX:560,baseY:380,dx:0,dy:0});
  advance(w,.3);assert.ok(p.hp<100&&p.alive);assert.equal(w.players[1].hp,100);
  if(type==="xray")assert.ok(p.xray>0);
  if(type==="steam"){assert.ok(p.vy<=-720);assert.equal(p.ground,false);}
  if(type==="frost")assert.ok(p.chill>0);
  assert.ok(validSnapshot(w.snapshot()));
  w.startRound();assert.ok(w.players.every(p=>p.hp===100&&p.chill===0&&p.xray===0));
});

test("magnetic scanner pulls armed fighters and loose metal, with walls shielding the next room",()=>{
  const {w,h,p}=fixture("magnet");p.weapon="blaster";
  const metal=prepareProp({id:"metal",kind:"trolley",x:720,y:507,w:82,h:58,hp:75,maxHp:75});
  const wood=prepareProp({id:"wood",kind:"pallet",x:530,y:531,w:104,h:34,hp:55,maxHp:55});
  w.cover=[metal,wood];w.drops=[{x:580,y:535,vx:0,vy:0,type:"shotgun",ammo:5,life:60}];
  Object.assign(w.players[1],{x:610,y:535,vx:0,weapon:null});advance(w,1.2);
  assert.ok(p.vx<0);assert.equal(p.hp,99);assert.equal(w.players[1].vx,0);
  assert.ok(w.drops[0].vx>0);assert.ok(metal.vx<0);assert.equal(wood.vx,0);
  p.vx=0;w.platforms.push({id:"wall",x:665,y:370,w:12,h:195,baseX:665,baseY:370,dx:0,dy:0});advance(w,.1);assert.equal(p.vx,0);
  assert.ok(validSnapshot(w.snapshot()));
});

test("all new fixtures disable when their floor is destroyed and reject malformed wire state",()=>{
  for(const type of HAZARD_TYPES.slice(6)){
    const {w,h,p}=fixture(type);h.active=true;
    w.platforms[0].hp=0;advance(w,.1);assert.equal(h.done,true);assert.equal(p.hp,100);
    assert.ok(validSnapshot(w.snapshot()));
    for(const patch of [{w:-1},{h:10000},{bodyX:Infinity},{active:"true"}]){
      const s=structuredClone(w.snapshot());Object.assign(s.hazards[0],patch);assert.equal(validSnapshot(s),false);
    }
  }
});

test("reinforcement weapons avoid idle and active hazard footprints and destroyed floors",()=>{
  const {w,h}=fixture("saw");w.drops=[];w.platforms.push({id:"other",x:1200,y:400,w:400,h:25});
  for(let n=0;n<12;n++)w.spawnWeapon();
  for(const d of w.drops)assert.ok(!nearFixture(d.x,d.y,[h],45));
  w.drops=[];w.platforms.forEach(p=>p.hp=0);w.spawnWeapon();assert.equal(w.drops.length,0);
});

test("new props retain physical mass, break into material pieces and reset on all new arenas",()=>{
  const seen=new Set();
  for(let arena=0;arena<ARENAS.length;arena++){
    const w=new World({arena,shuffle:false});
    for(const p of w.cover.filter(p=>["trolley","generator","planter","pallet"].includes(p.kind))){
      seen.add(p.kind);assert.ok(p.mass>0);w.damageCover(p,500,400,-100);
    }
    assert.ok(validSnapshot(w.snapshot()),w.arena.name);
    if(w.chunks.length){updateProps(w,STEP);assert.ok(w.chunks.every(c=>c.material&&c.id));}
    w.startRound();assert.equal(w.chunks.length,0);assert.ok(w.cover.every(p=>p.hp===p.maxHp));
  }
  assert.equal(seen.size,4);
});
