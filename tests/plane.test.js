import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { PLANE, planePose, planeLocalPoint, planeBreaches, breachForce, updatePlane } from "../src/plane.js";
import { carveExplosion } from "../src/terrain.js";
import { addWater, addSpill } from "../src/reactions.js";
import { prepareProp } from "../src/props.js";
import { GuestPrediction } from "../src/guest-prediction.js";
import { RenderSnapshots } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { blackholeField, updateBlackhole } from "../src/blackhole.js";
import { nuclearField, updateNuclear } from "../src/nuclear.js";

const fixture = () => {
  const w=new World({arena:ARENAS.findIndex(a=>a.cargoPlane),players:[0,1],shuffle:false,random:()=>.4});
  w.phase="fight";w.weaponTimer=w.grenadeTimer=999;
  return {w,h:w.hazards.find(h=>h.type==="airflow")};
};
const breach = w => carveExplosion(w,{x:PLANE.x+PLANE.rx,y:PLANE.y,radius:140});

test("large destructive weapons cannot consume the plane's virtual pressure controller",()=>{
  for(const kind of ["blackhole","nuke","phaser"]) {
    const {w,h}=fixture();
    if(kind==="phaser") {
      Object.assign(w.players[0],{x:900,y:710,rig:null,weapon:"phaser",ammo:2,aimAngle:0});
      w.attack(w.players[0]);
    } else {
      const f=(kind==="nuke"?nuclearField:blackholeField)(w,{x:h.x,y:h.y,owner:0});
      f.age=.5;(kind==="nuke"?updateNuclear:updateBlackhole)(w,f,STEP);
    }
    assert.ok(w.hazards.includes(h),kind);
    const age=h.age;updatePlane(w,h,STEP);assert.ok(h.age>age);
    assert.ok(validSnapshot(w.snapshot()),kind);
  }
});

test("dents stay sealed, through cuts vent locally, and multiple holes retain distinct directions",()=>{
  const {w}=fixture();
  carveExplosion(w,{x:PLANE.x+PLANE.rx+25,y:PLANE.y,radius:42});
  assert.deepEqual(planeBreaches(w.platforms),[]);
  breach(w);
  let holes=planeBreaches(w.platforms),hull=w.platforms.filter(p=>p.planeHull);
  assert.ok(breachForce({x:1890,y:710},holes,hull).x>3500);
  assert.deepEqual(breachForce({x:1100,y:710},holes,hull),{x:0,y:0});
  assert.ok(breachForce({x:2150,y:710},holes,hull).x>0,"jet continues outward beyond the opening");
  carveExplosion(w,{x:PLANE.x-PLANE.rx,y:PLANE.y,radius:140});
  holes=planeBreaches(w.platforms);hull=w.platforms.filter(p=>p.planeHull);
  assert.equal(holes.length,2);
  assert.ok(breachForce({x:650,y:710},holes,hull).x< -3000);
});

test("gunfire can break a hull panel and the surviving metal still blocks other rays",()=>{
  const {w}=fixture();
  const plate=w.platforms.find(p=>p.planeHull&&p.x>2000&&p.y<=710&&p.y+p.h>710);
  w.damageCover(plate,110,1000,0);
  const holes=planeBreaches(w.platforms);
  assert.ok(holes.length>0);
  assert.equal(plate.hp,0);
  assert.deepEqual(breachForce({x:1900,y:990},holes,w.platforms.filter(p=>p.planeHull)),{x:0,y:0});
});

test("decompression accelerates fighters, props, shots, debris, blood, liquids, gas and dead bodies",()=>{
  const {w,h}=fixture();breach(w);
  Object.assign(w.players[0],{x:1880,y:710,vx:0,vy:0,ground:false,rig:null});
  const b=prepareProp({id:"loose",kind:"crate",x:1850,y:680,w:40,h:40,hp:80,maxHp:80});w.cover=[b];
  w.projectiles=[{x:1870,y:705,vx:0,vy:0}];w.drops=[{x:1870,y:710,vx:0,vy:0}];
  w.debris=[{x:1880,y:720,vx:0,vy:0}];w.blood=[{x:1880,y:725,vx:0,vy:0}];
  w.gas=[{x:1880,y:720,vx:0,vy:0}];
  w.ragdolls=[{points:[{x:1880,y:710,px:1880,py:710}]}];
  addWater(w,1880,720,10);addSpill(w,"oil",1880,750,8);
  const waterX=w.water[0].x,spillX=w.spills[0].x;
  updatePlane(w,h,STEP);
  for(const p of [w.players[0],b,w.projectiles[0],w.drops[0],w.debris[0],w.blood[0],w.gas[0]])assert.ok(p.vx>25);
  assert.ok(w.ragdolls[0].points[0].px<1880);
  assert.ok(w.water[0].x>waterX);assert.ok(w.spills[0].x>spillX);
});

test("a nearby pressure jet tears cargo restraints and ejects an actual fighter through the gap",()=>{
  const {w,h}=fixture();breach(w);
  w.cover=[prepareProp({id:"strapped",kind:"crate",x:1880,y:670,w:40,h:40,hp:80,maxHp:80,strapped:true,strapHp:18})];
  Object.assign(w.players[0],{x:1930,y:710,vx:0,vy:0,ground:false,rig:null});
  const p=w.players[0];
  for(let i=0;i<100;i++) { w.move(p,cleanInput({}),STEP);w.updateCover(STEP);updatePlane(w,h,STEP); }
  assert.equal(w.cover[0].strapped,false);
  assert.ok(p.x>2110,`fighter clears surviving hull: ${p.x}`);
});

test("turbulence transform keeps the full plane visible and pointer aim follows the rotating frame",()=>{
  for(let age=0;age<80;age+=.13)for(const reduced of [false,true]) {
    const pose=planePose(age,reduced),c=Math.cos(pose.angle),s=Math.sin(pose.angle);
    for(const point of [{x:50,y:700},{x:2510,y:724},{x:PLANE.x,y:PLANE.y-PLANE.ry},{x:PLANE.x,y:PLANE.y+PLANE.ry},{x:1790,y:850}]) {
      const x=point.x-PLANE.x,y=point.y-PLANE.y;
      const screen={x:PLANE.x+pose.x+pose.scale*(x*c-y*s),y:PLANE.y+pose.y+pose.scale*(x*s+y*c)};
      const local=planeLocalPoint(screen,age,reduced);
      assert.ok(Math.hypot(local.x-point.x,local.y-point.y)<1e-8);
      assert.ok(screen.x>0&&screen.x<2560&&screen.y>0&&screen.y<1440);
    }
  }
});

test("guests predict only their own decompression movement without editing hull or cargo",()=>{
  const {w,h}=fixture();breach(w);h.age=3;w.time=3;
  Object.assign(w.players[1],{x:1880,y:710,vx:0,vy:0,ground:false,rig:null});
  const state={...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]};
  const saved=structuredClone(state),guest=new GuestPrediction();guest.receive(state,1,1000);
  guest.advance(cleanInput({}),1,1017);
  for(let i=0;i<2;i++) {w.time+=STEP;w.move(w.players[1],cleanInput({}),STEP);updatePlane(w,h,STEP);}
  assert.ok(Math.abs(guest.player.x-w.players[1].x)<.1);
  assert.ok(Math.abs(guest.player.vx-w.players[1].vx)<.1);
  assert.deepEqual(state,saved);
});

test("wind-driven fluids retain valid bounded transport and the hull cannot be forged on other arenas",()=>{
  const {w,h}=fixture();breach(w);addWater(w,1880,740,20);addSpill(w,"oil",1880,760,15);
  w.gas.push({id:++w.reactionSerial,x:1900,y:710,vx:400,vy:0,r:20,life:3,lit:0,owner:0});
  for(let n=0;n<200;n++)updatePlane(w,h,STEP);
  assert.ok(validSnapshot(w.snapshot()));
  const bad=structuredClone(w.snapshot());bad.arenaIndex=0;
  assert.equal(validSnapshot(bad),false);
});
