import test from "node:test";
import assert from "node:assert/strict";
import {World, STEP, WEAPONS} from "../src/engine.js";
import {combatFloor} from "./helpers.js";
import {steer, traceFlight, routesFrom} from "../src/navigation.js";
import {botDanger} from "../src/bot-danger.js";

function fixture(weapon = "blaster") {
  const w = new World({players:[0,1],bots:[1],shuffle:false,random:()=>.45});
  combatFloor(w); w.phase="fight";
  Object.assign(w.players[0],{x:1500,y:535,ground:true,support:"floor0"});
  Object.assign(w.players[1],{x:1000,y:535,ground:true,support:"floor0",weapon,ammo:WEAPONS[weapon]?.ammo||0});
  return w;
}
function advance(w,t,observe=()=>{}) {
  for(let n=0;n<t/STEP&&w.phase==="fight";n++){w.step(STEP);observe();}
}
const vent = (x=1250) => ({id:99,type:"geyser",x,y:565,w:120,h:190,
  bodyX:x,bodyY:440,active:true,duration:100,warning:0,done:false,hitIds:[],hitTimer:1});

test("ground steering settles at a waypoint without sustained left/right oscillation",()=>{
  const w=fixture(null), p=w.players[1];p.x=900;
  let reversals=0,last=0,maxError=0;
  // Exercise ordinary movement physics, including the AI decision interval.
  let input={};
  for(let n=0;n<4/STEP;n++){
    if(n%10===0) input=steer(p,1000);
    w.move(p,input,STEP);
    if(n>2/STEP){const dir=Number(input.right)-Number(input.left);
      if(dir&&last&&dir!==last)reversals++;if(dir)last=dir;
      maxError=Math.max(maxError,Math.abs(p.x-1000));}
  }
  assert.ok(maxError<9,`settled error ${maxError}`);
  assert.ok(reversals<=1,`${reversals} reversals while stopped`);
});

test("bot brakes before entering a lethal vent to chase an opponent",()=>{
  const w=fixture(null);w.hazards=[vent()];
  let entered=false;
  advance(w,3,()=>{entered ||= w.players[1].x>1170&&w.players[1].y>345;});
  assert.equal(entered,false);
  assert.equal(w.players[1].alive,true);
});

test("bot ignores a weapon inside an active kill zone and gets the safe pickup",()=>{
  const w=fixture(null);w.hazards=[vent(1130)];
  const drop=(type,x)=>({id:type,type,x,y:555,vx:0,vy:0,ammo:WEAPONS[type].ammo,life:90});
  w.drops=[drop("railgun",1130),drop("blaster",700)];
  let acquired=false;
  advance(w,2,()=>{acquired ||= w.players[1].weapon==="blaster";});
  assert.ok(acquired);assert.equal(w.players[1].alive,true);
});

test("route search rejects a lethal landing even when it is the only path",()=>{
  const from={id:"a",x:0,y:565,w:300,h:25},to={id:"b",x:500,y:565,w:300,h:25};
  const graph=new Map([["a",[{key:"jump",from:"a",to:"b",startX:250,endX:650,duration:1}]]]);
  const routes=routesFrom(graph,[from,to],from,200,new Map(),0,[vent(650)]);
  assert.equal(routes.has("b"),false);
});

test("live takeoff checks reject hazards in the arc as well as at the landing",()=>{
  const from={id:"a",x:100,y:800,w:320,h:25},to={id:"b",x:600,y:800,w:400,h:25};
  const args=[[from,to],from,390,1,2,.38,0,[],0,null,false];
  const safe=traceFlight(...args);assert.ok(safe);
  const h={...vent(510),y:800,h:500,w:80};
  assert.equal(traceFlight(...args,(x,y)=>botDanger([h],x,y)),null);
});

test("warning press footprints cover the future downstroke",()=>{
  const press={type:"crusher",x:1000,y:565,w:160,h:300,bodyY:287,warning:1,active:false};
  assert.equal(botDanger([press],1000,535),true);
  assert.equal(botDanger([press],850,535),false);
  press.done=true;assert.equal(botDanger([press],1000,535),false);
});

test("recoil repositioning produces a shot instead of alternating incompatible goals",()=>{
  const w=fixture("railgun");
  w.platforms=[{id:"floor0",x:700,y:565,w:620,h:25},{id:"enemy",x:1800,y:565,w:500,h:25}];
  Object.assign(w.players[0],{x:2000,support:"enemy"});
  Object.assign(w.players[1],{x:760,ammo:3});
  let fired=false;
  advance(w,4,()=>{fired ||= w.players[1].ammo<3;});
  assert.ok(fired);assert.equal(w.players[1].alive,true);
});

test("a gunner leaves a narrow perch for a reachable platform with firing room",()=>{
  const w=fixture("railgun");
  w.platforms=[{id:"floor0",x:700,y:800,w:130,h:25},
    {id:"firing",x:940,y:800,w:620,h:25},{id:"enemy",x:1900,y:800,w:400,h:25}];
  Object.assign(w.players[0],{x:2100,y:770,support:"enemy"});
  Object.assign(w.players[1],{x:770,y:770,ammo:3});
  let fired=false,landed=false;
  advance(w,9,()=>{landed ||= w.players[1].support==="firing";fired ||= w.players[1].ammo<3;});
  assert.ok(landed,"move to safe firing ground");assert.ok(fired);assert.equal(w.players[1].alive,true);
});

test("tiny surviving terrain does not create an unreachable waypoint outside its edge",()=>{
  const w=fixture(null);
  w.platforms=[{id:"floor0",x:990,y:1200,w:14,h:8},{id:"enemy",x:1800,y:1200,w:400,h:25}];
  Object.assign(w.players[0],{x:2000,y:1170,support:"enemy"});
  Object.assign(w.players[1],{x:997,y:1170});
  advance(w,8);
  assert.equal(w.players[1].alive,true);
  const b=w.ai.bots.get(1);assert.ok(b.moveTo>=990&&b.moveTo<=1004);
  assert.equal(b.input.left||b.input.right,false);
});

test("Easy recognises a stationary grenade fuse and leaves its blast area",()=>{
  const w=fixture(null);
  w.players[0].x=2000;
  w.projectiles=[{id:99,kind:"grenade",weapon:"grenade",owner:0,x:970,y:535,
    vx:0,vy:0,life:.85,r:12,radius:215,damage:95,force:1550,bounces:99}];
  let jumped=false;
  advance(w,.75,()=>{jumped ||= w.players[1].jumps>0;});
  assert.ok(jumped);assert.ok(w.players[1].x>1080);
});

test("similar opponents do not repeatedly switch the bot's target and restart its reaction delay",()=>{
  const w=new World({players:[0,1,2],bots:[1],shuffle:false,random:()=>.45});
  combatFloor(w);w.phase="fight";
  for(const p of w.players)Object.assign(p,{y:535,ground:true,support:"floor0"});
  Object.assign(w.players[1],{x:1000,weapon:"blaster",ammo:14});
  const targets=new Set();let fire=false;
  for(let n=0;n<4/STEP;n++){
    const offset=Math.floor(n*STEP*4)%2?20:-20;
    w.players[0].x=500+offset;w.players[2].x=1500+offset;
    w.time+=STEP;const input=w.ai.inputs(w,STEP)[1];
    targets.add(w.ai.bots.get(1).target);fire ||= input.attack;
  }
  assert.equal(targets.size,1);assert.ok(fire);
});
