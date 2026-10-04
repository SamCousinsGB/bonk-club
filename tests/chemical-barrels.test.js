import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {prepareProp,bodyBounds} from '../src/props.js';
import {BARRELS,gasBlastRadius} from '../src/barrels.js';
import {addSpill,addWater,updateReactions,heatReactions,GAS_LIMIT} from '../src/reactions.js';
import {updateRocket} from '../src/rocket.js';
import {carveExplosion} from '../src/terrain.js';
import {validSnapshot,encodeState,decodeState} from '../src/network.js';
import {RenderSnapshots} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';

function lab(){
 const w=new World({arena:12,players:[0,1],shuffle:false,random:()=>.5});
 Object.assign(w,{phase:'fight',cover:[],chunks:[],gas:[],water:[],spills:[],
  platforms:[{id:'floor',x:0,y:1200,w:2560,h:30,baseX:0,baseY:1200,dx:0,dy:0}],drops:[]});
 for(const p of w.players)Object.assign(p,{x:2100+p.id*180,y:1170,spawnShield:0});
 return w;
}
const prop=(kind,x=1250,y=1130,extra={})=>prepareProp({id:kind+x,kind,x,y,w:54,h:70,hp:85,maxHp:85,...extra});
const tick=(w,t=.05)=>{for(let n=0;n<Math.ceil(t/.05);n++){w.time+=.05;updateReactions(w,.05);}};
const spill=(w,kind,x=1280,y=1200,n=96)=>addSpill(w,kind,x,y,n);

test('every arena rotates acid, coolant, oil and tar into safe physical placements',()=>{
 const before=JSON.stringify(ARENAS),large=new Set();
 for(let arena=0;arena<ARENAS.length;arena++){
  const seen=new Set();
  for(let round=1;round<=6;round++){
   const w=new World({arena,shuffle:false,random:()=>.95});w.round=round;w.startRound();
   for(const b of w.cover){
    seen.add(b.kind);if(b.w*b.h>10000)large.add(b.kind);
    if(!b.id.startsWith('reaction-prop'))continue;
    const box=bodyBounds(b);
    assert.ok(!w.platforms.some(p=>p.hp!==0&&p.x<box.x+box.w&&p.x+p.w>box.x&&p.y<box.y+box.h-.1&&p.y+p.h>box.y),`${w.arena.name} ${b.kind}`);
    assert.ok(!w.arena.spawns.some(([x,y])=>Math.abs(x-box.x-box.w/2)<110&&Math.abs(y-box.y-box.h/2)<100));
   }
   assert.ok(validSnapshot(w.snapshot()),w.arena.name);
  }
  for(const kind of ['acidBarrel','coolantBarrel','oilBarrel','tarBarrel'])assert.ok(seen.has(kind),`${ARENAS[arena].name}: ${kind}`);
 }
 for(const kind of ['oilBarrel','canister','tarBarrel'])assert.ok(large.has(kind));
 assert.equal(JSON.stringify(ARENAS),before);
});

test('large gas has a larger bounded blast and denser cloud emission than a normal cylinder',()=>{
 const clouds=[];
 for(const scale of [1,2.6]){
  const w=lab(),b=prop('canister',800,900,{w:44*scale,h:72*scale,mass:32*scale*scale});w.cover=[b];
  w.damageCover(b,1);tick(w,.6);clouds.push(w.gas.map(g=>g.r));
  assert.ok(w.gas.length<=GAS_LIMIT&&validSnapshot(w.snapshot()));
  b.fuse=.01;tick(w);const blast=w.events.find(e=>e.type==='explosion'&&e.weapon==='canister');
  assert.equal(blast.radius,gasBlastRadius(b));assert.ok(blast.radius<=320);
 }
 assert.ok(clouds[1].length>clouds[0].length);assert.ok(Math.max(...clouds[1])>Math.max(...clouds[0])*2);
});

test('the clipped engine jet ignites each fuel container, released liquid and gas; solid shielding stops it',()=>{
 for(const kind of ['oilBarrel','tarBarrel','canister'])for(const shield of [false,true]){
  const w=lab(),b=prop(kind);w.cover=[b];w.hazards[0].age=11.5;
  if(shield)w.platforms.push({id:'shield',x:900,y:900,w:750,h:30,material:'metal'});
  spill(w,'oil',1280,1110);w.gas.push({id:++w.reactionSerial,x:1280,y:1000,r:25,vx:0,vy:0,life:3.2,lit:0,owner:0});
  updateRocket(w,w.hazards[0],STEP);
  assert.equal(b.fire>0,!shield);assert.equal(w.spills.some(q=>q.fire>0),!shield);assert.equal(w.gas[0].lit>0,!shield);
  if(shield){carveExplosion(w,{x:1280,y:910,radius:125});updateRocket(w,w.hazards[0],STEP);assert.ok(b.fire>0);}
 }
});

test('coolant puts out burning fuel, chills fighters, freezes water and suspends gas fuses',()=>{
 const w=lab(),b=prop('canister');w.cover=[b];w.damageCover(b,1);
 Object.assign(w.players[0],{x:1280,y:1170,burn:3});
 spill(w,'oil');w.spills.forEach(q=>q.fire=7);spill(w,'coolant');addWater(w,1280,1200,96);
 tick(w);const fuse=b.fuse;
 assert.ok(w.water.some(q=>q.frozen));assert.ok(w.platforms.some(p=>p.waterId));
 assert.equal(w.players[0].burn,0);assert.ok(w.players[0].chill>0);assert.ok(b.cold>0);
 assert.ok(w.spills.filter(q=>q.kind==='oil').every(q=>!q.fire));tick(w,.2);assert.equal(b.fuse,fuse);
 heatReactions(w,()=>true,.05);assert.ok(w.water.every(q=>!q.frozen));assert.ok(!w.platforms.some(p=>p.waterId));
});

test('acid corrodes props once per contact interval, consumes liquid and makes ignitable gas only from metal',()=>{
 for(const kind of ['cabinet','crate','stone','acidBarrel']){
  const w=lab(),b=prop(kind);w.cover=[b];spill(w,'acid');const initial=w.spills.reduce((s,q)=>s+q.h,0);
  tick(w);assert.equal(b.hp<85,kind!=='acidBarrel');
  assert.equal(w.gas.length>0,kind==='cabinet');
  if(kind==='cabinet'){
   const hp=b.hp;tick(w,.1);assert.equal(b.hp,hp);assert.ok(w.spills.reduce((s,q)=>s+q.h,0)<initial);
   heatReactions(w,()=>true,.05);assert.ok(w.gas.every(g=>g.lit>0));tick(w,.3);
   assert.ok(w.events.some(e=>e.type==='explosion'&&e.weapon==='gas'));
  }
 }
});

test('acid damages fighters with its own death cause, while water dilutes it and coolant stops corrosion',()=>{
 const w=lab();Object.assign(w.players[0],{x:1280,y:1170,hp:5});spill(w,'acid');tick(w);
 assert.equal(w.players[0].alive,false);assert.equal(w.lastDeathCause,'acid');
 const cold=lab(),b=prop('cabinet');cold.cover=[b];spill(cold,'acid');spill(cold,'coolant');tick(cold,.4);assert.equal(b.hp,85);
 const washed=lab();spill(washed,'acid');addWater(washed,1280,1200,96);const before=washed.spills.reduce((s,q)=>s+q.h,0);tick(washed,.5);
 assert.ok(washed.spills.reduce((s,q)=>s+q.h,0)<before-1);
});

test('new contents, large containers, ice and gas survive compact hot join and reset; prediction cannot react',async()=>{
 const w=lab();spill(w,'acid',800);spill(w,'coolant',1500);addWater(w,1500,1200,96);
 w.cover=[prop('cabinet',800),prop('oilBarrel',1000,1000,{w:140,h:177,mass:400,liquidLeft:649,liquidCapacity:649})];tick(w);
 const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
 const joined=expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))),validSnapshot);
 for(const k of ['spills','water','gas','cover','platforms'])assert.deepEqual(joined[k],JSON.parse(JSON.stringify(s[k])));
 w.prediction=true;const before=structuredClone(w.snapshot());heatReactions(w,()=>true,.05);tick(w,.5);
 for(const k of ['spills','water','gas','cover'])assert.deepEqual(w.snapshot()[k],before[k]);
 w.prediction=false;w.startRound();assert.equal(w.spills.length,0);assert.equal(w.gas.length,0);assert.ok(!w.platforms.some(p=>p.waterId));
 const bad=structuredClone(s);bad.spills[0].kind='unknown';assert.equal(validSnapshot(bad),false);
});
