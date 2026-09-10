import test from 'node:test';
import assert from 'node:assert/strict';
import {World,STEP,cleanInput,ARENAS} from '../src/engine.js';
import {combatFloor} from './helpers.js';
import {pickupLabels} from '../src/scene-detail.js';
function fixture(){const w=new World({players:[0,1],shuffle:false});combatFloor(w);w.phase='fight';Object.assign(w.players[0],{x:600,y:535,ground:true});Object.assign(w.players[1],{x:1900,y:535,ground:true});return w;}

test('a melee lunge connects after the first frame, only once per fighter',()=>{
 const w=fixture(),[p,q]=w.players;q.x=708;p.hp=70;
 w.attack(p);assert.equal(q.hp,100);
 for(let n=0;n<24;n++)w.step(STEP);
 assert.equal(q.hp,75);assert.equal(p.hp,74);
});
test('a late parry cancels a lunging strike without delayed damage after recovery',()=>{
 const w=fixture(),[p,q]=w.players;q.x=710;q.aimAngle=Math.PI;
 w.attack(p);
 for(let n=0;n<45;n++)w.step(STEP,{1:{block:true,aim:Math.PI}});
 assert.equal(q.hp,100);assert.ok(w.events.some(e=>e.type==='parry'));
});
test('an expiring melee animation cannot damage a new target during recovery',()=>{
 const w=fixture(),[p,q]=w.players;w.attack(p);
 for(let n=0;n<22;n++)w.step(STEP);
 q.x=p.x+45;
 for(let n=0;n<15;n++)w.step(STEP);
 assert.equal(q.hp,100);
});
test('the brief projectile protection during a lunge preserves its contact window',()=>{
 const w=fixture(),[p,q]=w.players;q.x=709;w.attack(p);
 w.hit(p,{x:p.x-20,y:p.y},10,25,1,0,{projectile:true,stun:.02,hitstop:0});
 for(let n=0;n<24;n++)w.step(STEP);
 assert.equal(q.hp,75);
});
test('jump pressed just before landing is buffered and holding does not repeat',()=>{
 const w=fixture(),p=w.players[0];Object.assign(p,{y:524,vy:300,ground:false,jumps:2});
 let bounced=false;
 for(let n=0;n<25;n++){w.move(p,cleanInput({jump:true}),STEP);bounced ||= p.vy < -600;}
 assert.ok(bounced);assert.equal(p.jumps,1);
 for(let n=0;n<150;n++)w.move(p,cleanInput({jump:true}),STEP);
 assert.equal(p.ground,true);assert.equal(p.jumps,0);
});
test('walking off a platform retains one air jump after coyote time, not two',()=>{
 const w=fixture(),p=w.players[0];w.platforms=[];Object.assign(p,{ground:false,coyote:.09,jumps:0});
 for(let n=0;n<15;n++)w.move(p,cleanInput({}),STEP);
 w.move(p,cleanInput({jump:true}),STEP);assert.equal(p.jumps,2);
 const vy=p.vy;w.move(p,cleanInput({}),STEP);w.move(p,cleanInput({jump:true}),STEP);
 assert.ok(p.vy>vy);
});
test('the eight original maps have distinct main routes and retain large world dimensions',()=>{
 const shapes=ARENAS.slice(0,8).map(a=>JSON.stringify(a.platforms.filter(p=>p.x>600&&p.x<1800).map(p=>[p.x,p.y,p.w])));
 assert.equal(new Set(shapes).size,8);
 for(const a of ARENAS.slice(0,8)){assert.ok(a.theme);assert.ok(a.platforms.some(p=>p.y>=1300));assert.ok(a.platforms.some(p=>p.y<=300));}
});
test('featured nuclear pickup does not always belong to the same side',()=>{
 const positions=new Set();
 for(let seed=1;seed<=12;seed++) {let n=seed*914;const random=()=> (n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296;const w=new World({arena:8,random});const d=w.drops.find(d=>d.type==='nuke');assert.ok(d);positions.add(Math.floor(d.x/600));}
 assert.ok(positions.size>=2, 'both sides must receive the featured weapon');
});
test('pickup text avoids fighters and other weapon labels',()=>{
 const players=[{alive:true,x:620,y:520}],drops=[{x:600,y:550,type:'a'},{x:620,y:550,type:'a'},{x:640,y:550,type:'a'}];
 const labels=pickupLabels(drops,players,null,()=>({label:{width:160}}),{a:{rarity:'exotic'}});
 assert.ok(labels.length>0);
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
});
test('bot routes build during countdown and no navigation work is scheduled for eliminated bots',()=>{
 const w=new World({players:[0,1],bots:[1],arena:8});
 w.step(STEP);assert.equal(w.ai.graph.size,1);assert.ok(w.ai.pendingNavigation);
 for(let n=0;n<150;n++)w.step(STEP);
 assert.ok(w.ai.graph.size>25);assert.equal(w.phase,'countdown');
 w.players[1].alive=false;w.step(STEP);assert.equal(w.ai.pendingNavigation,null);
});
