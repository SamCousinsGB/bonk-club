import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS } from "../src/engine.js";
import { prepareProp, bodyBounds } from "../src/props.js";
import { addWater, updateReactions, meltIce, surfaceReaction, explosionReaction, WATER_LIMIT, GAS_LIMIT, reactionDanger } from "../src/reactions.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { carveExplosion } from "../src/terrain.js";
import { firePhaser } from "../src/phaser.js";
import { nuclearField, updateNuclear } from "../src/nuclear.js";
import { blackholeField, updateBlackhole } from "../src/blackhole.js";
import { MATTER_KINDS } from "../src/accretion.js";
import { impactSpecial } from "../src/specials.js";

const floor=(id,x=0,y=1000,w=2560,h=24,extra={})=>({id,x,y,w,h,baseX:x,baseY:y,dx:0,dy:0,...extra});
const prop=(kind,x=800,y=930,extra={})=>prepareProp({id:`${kind}${x}`,kind,x,y,w:60,h:70,hp:85,maxHp:85,...extra});
function lab(){
  const w=new World({players:[0,1],shuffle:false,random:()=>.43});
  Object.assign(w,{platforms:[floor("floor")],cover:[],chunks:[],water:[],gas:[],hazards:[],drops:[],weaponTimer:999,phase:"fight"});
  w.arena={...w.arena,spikes:[]};
  w.players.forEach((p,i)=>Object.assign(p,{x:1800+i*300,y:970,vx:0,vy:0,ground:true,support:"floor"}));
  return w;
}

test("an explosion clears melted water before the next snapshot, without waiting for a fluid tick",()=>{
  const w=lab();addWater(w,900,1000,12);w.water.forEach(q=>q.grounded=true);
  explosionReaction(w,{x:910,y:985,radius:100,weapon:"cryo"});
  assert.ok(w.water.some(q=>q.frozen));
  explosionReaction(w,{x:910,y:985,radius:100,weapon:"grenade"});
  assert.equal(w.water.length,0);
  assert.ok(!w.platforms.some(p=>p.waterId));assert.ok(validSnapshot(w.snapshot()));
});
function advance(w,t,physics=false){for(let n=0;n<Math.ceil(t/.05);n++){
  w.time+=.05;if(physics)for(let i=0;i<6;i++)w.updateCover(STEP);updateReactions(w,.05);
}}
const amount=w=>w.water.reduce((sum,q)=>sum+q.w*q.h,0);
const shoot=(w,kind,x,y,vx=1200,vy=0)=>{
  w.projectiles.push({kind,weapon:kind==="flame"?"flamethrower":kind==="frost"?"ice":kind,owner:0,
    x,y,vx,vy,life:1,r:4,damage:10,force:100,bounces:0,hitIds:[],burn:kind==="flame"?1:0});
  for(let i=0;i<10;i++)w.updateProjectiles(STEP);
};

test("arenas get physical containers without obstructing spawns or intersecting terrain",()=>{
  let tanks=0,cylinders=0;
  for(let arena=0;arena<ARENAS.length;arena++){
    const w=new World({arena});
    for(const b of w.cover.filter(b=>b.id.startsWith("reaction-prop"))){
      tanks+=b.kind==="waterTank";cylinders+=b.kind==="canister";
      assert.ok(!w.arena.spawns.some(([x,y])=>Math.abs(x-b.x-b.w/2)<110&&Math.abs(y-b.y-b.h/2)<100));
      assert.ok(!w.platforms.some(p=>p.hp!==0&&p.x<b.x+b.w&&p.x+p.w>b.x&&p.y<b.y+b.h-.1&&p.y+p.h>b.y));
      for(const p of w.platforms.filter(p=>p.travel)) {
        const top=Math.min(p.baseY,p.baseY+p.travel)-95,bottom=Math.max(p.baseY,p.baseY+p.travel)+p.h+10;
        assert.ok(!(b.x<p.x+p.w+18&&b.x+b.w>p.x-18&&b.y<bottom&&b.y+b.h>top),"container obstructs lift travel");
      }
    }
    assert.ok(validSnapshot(w.snapshot()),ARENAS[arena].name);
  }
  assert.ok(tanks>=ARENAS.length*.6);assert.ok(cylinders>=ARENAS.length);
});

test("water lands on the actual floor, spreads, and conserves finite volume",()=>{
  const w=lab();addWater(w,600,890,100);const volume=amount(w);advance(w,3);
  assert.ok(w.water.length>5);assert.ok(w.water.every(q=>Math.abs(q.y+q.h-1000)<.01));
  assert.ok(Math.abs(amount(w)-volume)<1e-6);
});

test("destroying the supporting floor drains water into the lower room",()=>{
  const w=lab();w.platforms=[floor("upper",0,700),floor("lower",0,1100)];
  addWater(w,800,690,80);advance(w,.7);const volume=amount(w);
  carveExplosion(w,{x:816,y:700,radius:220});advance(w,2);
  assert.ok(w.water.some(q=>q.y>1080));assert.ok(!w.water.some(q=>q.x>650&&q.x<970&&Math.abs(q.y+q.h-700)<1));
  assert.ok(Math.abs(amount(w)-volume)<1e-6);
});

test("a separating wall stops lateral water flow and electrical conduction",()=>{
  const w=lab();w.platforms.push(floor("wall",640,880,12,120));
  addWater(w,592,990,24);advance(w,3);
  assert.ok(w.water.every(q=>q.x<640));
  addWater(w,656,990,20);advance(w,.2);
  w.water.find(q=>q.x<640).spark=.7;advance(w,.1);
  assert.ok(w.water.filter(q=>q.x>=640).every(q=>!q.charge));
});

test("admission limits do not duplicate water or exceed the parcel budget",()=>{
  const w=lab();addWater(w,1000,600,10000);addWater(w,1000,300,10000);addWater(w,1000,100,10000);
  const before=amount(w);const accepted=addWater(w,1000,600,100);
  assert.ok(w.water.length<=WATER_LIMIT);assert.ok(Math.abs(amount(w)-before-accepted*32)<1e-6);
  advance(w,4);assert.ok(w.water.length<=WATER_LIMIT);assert.ok(validSnapshot(w.snapshot()));
});

test("a broken tank releases its finite contents and cannot refill itself",()=>{
  const w=lab(),b=prop("waterTank",800,900,{waterLeft:210});w.cover=[b];
  w.damageCover(b,12);assert.equal(b.leak,1);advance(w,6);
  assert.ok(b.waterLeft<.01);const volume=amount(w);advance(w,2);
  assert.ok(Math.abs(amount(w)-volume)<1e-6);assert.ok(Math.abs(volume-210*32)<1e-4);
});

test("shooting a tank apart transfers its remaining water exactly once",()=>{
  const w=lab(),b=prop("waterTank",800,900,{waterLeft:100});w.cover=[b];
  w.damageCover(b,200);const volume=amount(w);w.damageCover(b,200);
  assert.equal(b.hp,0);assert.equal(amount(w),volume);assert.equal(volume,3200);
});

test("water extinguishes burning fighters, including physical knockdowns",()=>{
  const w=lab(),p=w.players[0];addWater(w,800,998,40);advance(w,.2);
  Object.assign(p,{x:816,y:970,burn:1,knockdown:.8});advance(w,.05);
  assert.equal(p.burn,0);assert.ok(p.soaked>0);
  impactSpecial(w,{burn:1,kind:"flame"},p,true);assert.equal(p.burn,0);
  p.soaked=0;impactSpecial(w,{burn:1,kind:"flame"},p,true);assert.equal(p.burn,3);
});

test("water catches a flame before it can ignite a fighter behind it",()=>{
  const w=lab(),p=w.players[1];Object.assign(p,{x:820,y:970});
  addWater(w,800,985,24);advance(w,.1);
  shoot(w,"flame",816,930,0,1000);assert.equal(p.burn,0);
});

test("Tesla shots energise a puddle and its touching metal, then lose charge",()=>{
  const w=lab(),b=prop("cabinet",832,925,{w:50,h:75});w.cover=[b];
  addWater(w,816,1000,24);advance(w,.1);shoot(w,"tesla",816,945,0,1000);advance(w,.05);
  assert.ok(w.water.some(q=>q.charge));assert.equal(b.charge,1);
  advance(w,1);assert.ok(w.water.every(q=>!q.charge));assert.equal(b.charge,0);
});

test("moving a connecting metal prop away breaks the circuit immediately",()=>{
  const w=lab();const a=prop("cabinet",500,900,{w:50,h:100,spark:1});
  const bridge=prop("bed",550,950,{w:100,h:50}),b=prop("cabinet",650,900,{w:50,h:100});
  w.cover=[a,bridge,b];advance(w,.05);assert.equal(b.charge,1);
  bridge.y-=200;advance(w,.05);assert.equal(a.charge,1);assert.equal(b.charge,0);
});

test("wood does not conduct and living fighters get bounded shock intervals",()=>{
  const w=lab(),a=prop("cabinet",500,900,{spark:1}),wood=prop("crate",560,930);
  w.cover=[a,wood];const p=w.players[0];Object.assign(p,{x:620,y:970});advance(w,.05);
  assert.ok(!wood.charge);assert.equal(p.hp,100);
  p.x=500;advance(w,.05);const hp=p.hp;advance(w,.2);assert.equal(p.hp,hp);assert.ok(hp<100&&p.xray>0);
});

test("electrical fixture cycles power water and destroying its source removes danger",()=>{
  const w=lab();addWater(w,800,998,30);advance(w,.2);
  w.hazards=[{type:"tesla",x:816,y:1000,w:100,h:100,active:true,done:false}];advance(w,.1);
  assert.ok(w.water.some(q=>q.charge));assert.ok(reactionDanger(w,816,970));
  w.hazards[0].active=false;advance(w,.05);assert.ok(w.water.every(q=>!q.charge));
});

test("flame hits ignite furniture and broken pieces carry that fire",()=>{
  const w=lab(),b=prop("table");w.cover=[b];
  shoot(w,"flame",730,950);assert.ok(b.fire>0);
  w.damageCover(b,200);assert.ok(w.chunks.length>0);assert.ok(w.chunks.filter(c=>c.material==="wood").every(c=>c.fire>0));
  const c=prop("crate",w.chunks[0].x,w.chunks[0].y);w.cover.push(c);advance(w,.05);assert.ok(c.fire>0);
});

test("wet props resist ignition and fire consumes finite fuel",()=>{
  const w=lab(),b=prop("table",800,930,{soaked:1});w.cover=[b];
  surfaceReaction(w,{kind:"flame",x:800,y:950},b);assert.ok(!b.fire);
  b.soaked=0;surfaceReaction(w,{kind:"flame",x:800,y:950},b);advance(w,10);
  assert.ok(b.hp===0||!b.fire);assert.ok(w.chunks.every(c=>!c.fire||c.fuel<=3.5));
});

test("fire melts only the hit ice and produces water; repeated hits dig further",()=>{
  const w=lab();w.platforms=[floor("ice",400,800,500,35,{ice:true,material:"ice"}),floor("stone",1000,800,400)];
  const before=w.platforms.reduce((s,p)=>s+p.w*p.h,0);meltIce(w,600,800,35);
  const after=w.platforms.reduce((s,p)=>s+p.w*p.h,0);assert.ok(after<before);assert.ok(amount(w)>0);
  meltIce(w,600,820,35);assert.ok(w.platforms.reduce((s,p)=>s+p.w*p.h,0)<after);
  assert.equal(w.platforms.find(p=>p.id==="stone").w,400);
  assert.ok(!w.solids().some(p=>p.x<600&&p.x+p.w>600&&p.y<825&&p.y+p.h>825));
});

test("cryo freezes water into real slippery collision and flame thaws it without adding volume",()=>{
  const w=lab();addWater(w,800,999,40);advance(w,.3);const before=amount(w);
  explosionReaction(w,{x:816,y:960,radius:210,weapon:"cryo"});
  const q=w.water.find(q=>q.frozen),p=w.platforms.find(p=>p.waterId===q.id);
  assert.ok(p&&p.ice);assert.ok(w.solids().includes(p));
  surfaceReaction(w,{kind:"flame",x:q.x+5,y:q.y},p);
  assert.equal(q.frozen,0);assert.ok(!w.platforms.some(p=>p.waterId===q.id));assert.equal(amount(w),before);
});

test("destroyed frozen water cannot regrow collision or refill a destroyed platform",()=>{
  const w=lab();addWater(w,800,999,24);advance(w,.1);
  explosionReaction(w,{x:816,y:960,radius:210,weapon:"cryo"});
  const q=w.water.find(q=>q.frozen);carveExplosion(w,{x:816,y:992,radius:60});advance(w,.1);
  assert.ok(!w.water.some(p=>p.id===q.id));assert.ok(!w.platforms.some(p=>p.waterId===q.id));
});

test("punctured cylinders launch, leak gas, survive the first hit and detonate once",()=>{
  const w=lab(),b=prop("canister",800,800,{w:44,h:72});w.cover=[b];
  w.damageCover(b,200);assert.equal(b.hp,1);assert.ok(b.leak&&b.vx!==0&&b.spin!==0);
  advance(w,.3);assert.ok(w.gas.length>0);const velocity=Math.hypot(b.vx,b.vy);assert.ok(velocity>200);
  advance(w,2);assert.equal(b.hp,0);assert.equal(w.events.filter(e=>e.type==="explosion"&&e.weapon==="canister").length,1);
  assert.ok(w.chunks.some(c=>c.kind==="canister"&&c.material==="metal"&&Math.hypot(c.vx,c.vy)>200));
  advance(w,3);assert.equal(w.events.filter(e=>e.type==="explosion"&&e.weapon==="canister").length,1);
});

test("cryo pauses a cylinder fuse and leak, then the damaged cylinder resumes",()=>{
  const w=lab(),b=prop("canister",800,800);w.cover=[b];w.damageCover(b,5);
  explosionReaction(w,{x:820,y:820,weapon:"cryo",radius:210});const fuse=b.fuse;
  advance(w,2);assert.equal(b.fuse,fuse);assert.equal(w.gas.length,0);assert.ok(b.cold>0);
  advance(w,1.5);assert.ok(b.fuse<fuse&&w.gas.length>0);
});

test("gas ignition chains into a nearby cylinder with a readable delay",()=>{
  const w=lab(),b=prop("canister",820,800);w.cover=[b];
  w.gas=[{id:999,x:805,y:820,r:30,life:3,vx:0,vy:0,lit:0,owner:0}];
  shoot(w,"flame",725,820);assert.ok(w.gas[0].lit>0);assert.equal(b.leak,undefined);
  advance(w,.3);assert.equal(b.leak,1);assert.ok(b.fuse>0);assert.ok(w.gas.length<=GAS_LIMIT);
});

test("tank water extinguishes a burning prop and cryo seals the tank leak temporarily",()=>{
  const w=lab(),tank=prop("waterTank",800,840,{waterLeft:120}),wood=prop("table",800,930,{fire:6,fuel:6});
  w.cover=[tank,wood];w.damageCover(tank,2);advance(w,1);assert.equal(wood.fire,0);
  tank.cold=2;const left=tank.waterLeft;advance(w,.5);assert.equal(tank.waterLeft,left);
});

test("all reaction state round-trips through compression and late-join snapshots",async()=>{
  const w=lab(),c=prop("canister",800,800);w.cover=[c];w.damageCover(c,5);addWater(w,1000,999,60);advance(w,.3);
  explosionReaction(w,{x:1016,y:970,radius:210,weapon:"cryo"});
  const rs=new RenderSnapshots(),a=rs.make(w.snapshot());
  assert.ok(validSnapshot(a));const copy=expandSnapshot(await decodeState(await encodeState(compactSnapshot(a))),validSnapshot);
  assert.deepEqual(copy.water,a.water);assert.deepEqual(copy.gas,a.gas);assert.deepEqual(copy.platforms,a.platforms);
  advance(w,.1);const b=rs.make(w.snapshot()),blend=interpolateStates(a,b,.5);
  assert.ok(validSnapshot(blend));assert.deepEqual(blend.water.map(q=>q.id),b.water.map(q=>q.id));
});

test("invalid reaction state is rejected before guest rendering",()=>{
  const w=lab();addWater(w,800,900,20);w.cover=[prop("canister")];
  const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  for(const change of [s=>s.water[0].h=-1,s=>s.water[0].frozen=100,s=>s.water[0].charge=Infinity,
    s=>s.water[0].w=100000,s=>s.water.push({...s.water[0]}),s=>s.cover[0].fuse=NaN,
    s=>s.cover[0].fire=999,s=>s.gas=Array(GAS_LIMIT+1).fill({})]){
    const bad=structuredClone(s);change(bad);assert.equal(validSnapshot(bad),false);
  }
});

test("nuclear and phase destruction consume liquids rather than restoring them afterwards",()=>{
  for(const kind of ["nuke","phaser"]){
    const w=lab();addWater(w,816,999,24);advance(w,.1);
    if(kind==="nuke"){const f=nuclearField(w,{x:816,y:970,owner:0});for(let i=0;i<90;i++)updateNuclear(w,f,STEP);}
    else {Object.assign(w.players[0],{x:500,y:1000});firePhaser(w,w.players[0],1,0);}
    assert.equal(w.water.length,0,kind);advance(w,.5);assert.equal(w.water.length,0,kind);
  }
});

test("black holes retain captured fluid in bounded persistent matter samples",()=>{
  const w=lab();addWater(w,816,999,24);advance(w,.1);
  const count=w.water.length,f=blackholeField(w,{x:816,y:970,owner:0});w.fields=[f];
  updateBlackhole(w,f,.5);assert.equal(w.water.length,0);assert.ok(f.matter.totals[MATTER_KINDS.indexOf("debris")]>=count);
});

test("new rounds clear transient reactions and restore finite container supplies",()=>{
  const w=new World();const b=w.cover.find(b=>b.kind==="canister");w.damageCover(b,1);
  addWater(w,1000,700,100);w.players[0].soaked=2;w.startRound();
  assert.ok(w.cover.filter(b=>b.kind==="canister").every(b=>!b.leak));assert.ok(w.cover.find(b=>b.kind==="waterTank").waterLeft===210);
  assert.equal(w.players[0].soaked,undefined);assert.equal(w.gas.length,0);assert.ok(validSnapshot(w.snapshot()));
});

test("a damaged generator powers touching metal, and its destruction removes that source",()=>{
  const w=lab(),g=prop("generator",500,900),b=prop("cabinet",560,930);w.cover=[g,b];
  w.damageCover(g,5);advance(w,.05);assert.equal(b.charge,1);
  w.damageCover(g,200);advance(w,.05);assert.equal(b.charge,0);
});

test("the arena frost fixture freezes water and temporarily seals a cylinder",()=>{
  const w=lab(),b=prop("canister",800,928);w.cover=[b];addWater(w,820,999,20);advance(w,.1);w.damageCover(b,1);
  w.hazards=[{type:"frost",x:830,y:1000,w:150,h:130,active:true,done:false}];
  advance(w,.3);assert.ok(w.water.some(q=>q.frozen));assert.ok(b.cold>0);
});

test("fast gas leaving the bottom boundary is removed before transport",()=>{
  const w=lab();w.gas=[{id:1,x:800,y:1538,r:30,life:2,vx:0,vy:250,lit:0,owner:0}];
  advance(w,.05);assert.equal(w.gas.length,0);assert.ok(validSnapshot(w.snapshot()));
});

test("fighters land on the actual frozen-water surface and can jump away",()=>{
  const w=lab();addWater(w,800,999,48);advance(w,.2);explosionReaction(w,{x:816,y:970,radius:210,weapon:"cryo"});
  const q=w.water.find(q=>q.frozen),p=w.players[0];Object.assign(p,{x:q.x+16,y:900,ground:false,vy:50});
  for(let n=0;n<60;n++)w.move(p,{left:false,right:false,jump:false,duck:false},STEP);
  assert.ok(p.ground);assert.ok(Math.abs(p.y+30-q.y)<.1);
  w.move(p,{jump:true},STEP);assert.ok(p.vy<0&&!p.ground);
});
