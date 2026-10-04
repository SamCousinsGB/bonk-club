import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {prepareProp,propSolids} from '../src/props.js';
import {makeRig} from '../src/puppet.js';
import {colossusRig} from '../src/colossus-rig.js';
import {botDanger} from '../src/bot-danger.js';
import {traceFlight} from '../src/navigation.js';

function fixture(){
 const w=new World({arena:ARENAS.findIndex(a=>a.colossus),players:[0,1],bots:[0],shuffle:false,random:()=>.45});
 w.phase='fight';w.cover=[];w.drops=[];w.weaponTimer=w.grenadeTimer=999;
 return w;
}
function place(w,id,x,y,support){
 const p=w.players[id];Object.assign(p,{x,y,vx:0,vy:0,ground:true,support,spawnShield:0});p.rig=makeRig(p);return p;
}
function target(w,p){
 const h=w.hazards[0];h.age=8;h.warning=4;
 const eyes=colossusRig({...h,age:13.5}).eyes;
 const eye={x:(eyes[0].x+eyes[1].x)/2,y:(eyes[0].y+eyes[1].y)/2};
 h.strikeX=eye.x+(p.x-eye.x)*(1510-eye.y)/(p.y-15-eye.y);
 return h;
}
function advance(w,seconds,observe=()=>{}){
 for(let n=0;n<seconds/STEP&&w.phase==='fight';n++){w.step(STEP);observe();}
}

test('unarmed bots step off rubble and reach a fight without waiting for pickups',()=>{
 const w=fixture();w.hazards=[];
 w.chunks=[prepareProp({id:'rubble',chunk:true,kind:'stone',x:420,y:1304,w:44,h:16,hp:100,maxHp:100,angle:0})];
 const p=place(w,0,442,1274,'rubble');place(w,1,900,1290,'floor0');
 advance(w,6);
 assert.ok(w.players[1].hp<100,'leave the fragment and reach the opponent');
 assert.equal(p.alive,true);
});

for(const x of [170,270]) test(`unarmed bot escapes a laser covering its whole damaged terrace at x=${x}`,()=>{
 const w=fixture();
 w.platforms=w.platforms.filter(s=>s.id!=='floor1');
 w.platforms.push({id:'damaged',sourceId:'floor1',x:80,y:1020,w:225,h:38,material:'stone'});
 const p=place(w,0,x,990,'damaged');place(w,1,2000,1290,'floor0');
 const h=target(w,p);let escaped=false;
 advance(w,7,()=>{if(h.warning>0&&!botDanger(w.hazards,p.x,p.y))escaped=true;});
 assert.ok(escaped,'use the intact floor below when this terrace has no safe standing spot');
 assert.equal(p.alive,true,'survive the actual sweep using normal controls');
});

test('a laser warning wakes an unarmed bot standing on a small fragment',()=>{
 const w=fixture();
 w.chunks=[prepareProp({id:'rubble',chunk:true,kind:'stone',x:420,y:1304,w:44,h:16,hp:100,maxHp:100,angle:0})];
 const p=place(w,0,442,1274,'rubble');place(w,1,1800,1140,'floor5');
 const h=target(w,p);let escaped=false;
 advance(w,7,()=>{if(h.warning>0&&!botDanger(w.hazards,p.x,p.y))escaped=true;});
 assert.ok(escaped,'step down and run clear before discharge');
 assert.equal(p.alive,true);
});

test('irregular debris resting on the floor does not become an isolated AI ledge',()=>{
 const w=fixture();w.hazards=[];
 const rubble=prepareProp({id:'rubble',chunk:true,kind:'canister',material:'metal',
  x:416.41,y:1311.88,w:29.52,h:16.31,mass:1.69,hp:24,maxHp:24,
  shape:[[-.5,-.5],[.19,-.5],[.5,.5]],angle:-.5047});
 w.chunks=[rubble];
 const support=propSolids(rubble)[2];
 const p=place(w,0,429.27,support.y-30,support.id);place(w,1,900,1290,'floor0');
 assert.equal(traceFlight(w.solids(),support,p.x,-1,0)?.to,'floor0',
  'adjacent collision strips on one fragment are one takeoff');
 advance(w,6);
 assert.ok(w.players[1].hp<100,'step over the physical fragment and engage unarmed');
 assert.equal(p.alive,true);
});

test('a bot can jump over an opponent blocking its laser escape',()=>{
 const w=fixture();
 const p=place(w,0,400,1290,'floor0');place(w,1,450,1290,'floor0');
 const h=target(w,p);let escaped=false,jumped=false;
 advance(w,7,()=>{
  if(h.warning>0&&!p.ground)jumped=true;
  if(h.warning>0&&!botDanger(w.hazards,p.x,p.y))escaped=true;
 });
 assert.ok(jumped,'use the normal jump instead of pushing against the opponent');
 assert.ok(escaped,'land and clear the sweep before discharge');
 assert.equal(p.alive,true);
});

test('a complete two-bot Colossus match keeps moving and fighting without any weapon drops',()=>{
 const w=new World({arena:ARENAS.findIndex(a=>a.colossus),players:[0,1],bots:[0,1],shuffle:false,random:()=>.45});
 w.drops=[];w.weaponTimer=w.grenadeTimer=999;
 const h=w.hazards[0],p=w.players[0];let warningX=null,escaped=false;
 for(let n=0;n<16/STEP&&w.round===1;n++){
  w.step(STEP);
  if(h.warning>0){
   warningX??=p.x;
   if(p.alive&&!botDanger(w.hazards,p.x,p.y))escaped=true;
  }
 }
 assert.ok(escaped,'leave the actual debris field before the first sweep');
 assert.ok(p.x>warningX+200,'make useful escape progress instead of standing on rubble');
 assert.ok(w.players[1].hp<100,'reach and hit an opponent using fists alone');
 assert.ok(!h.hitIds.includes(p.id),'the previously stranded bot avoids the laser');
});

test('a bot backs up to a usable takeoff after the real terrace has been blasted apart',()=>{
 let seed=4781;
 const random=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
 const w=new World({arena:ARENAS.findIndex(a=>a.colossus),players:[0,1,2,3],bots:[0,1,2,3],
  weaponPool:['nuke'],shuffle:false,random});
 const h=w.hazards[0],p=w.players[0];let escaped=false,damagedTakeoff=false;
 for(let n=0;n<18/STEP&&w.round===1;n++){
  w.step(STEP);
  if(h.warning>0){
   damagedTakeoff ||= p.support?.startsWith('cut');
   escaped ||= p.alive&&!botDanger(w.hazards,p.x,p.y);
  }
 }
 assert.ok(damagedTakeoff,'exercise the destroyed upper terrace');
 assert.ok(escaped,'walk back and jump out before the warning expires');
 assert.ok(!h.hitIds.includes(p.id),'survive the complete laser sweep');
 assert.equal(p.alive,true);
 assert.ok(p.actionSerial>5,'resume unarmed fighting after the escape');
});
