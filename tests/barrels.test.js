import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS, cleanInput } from "../src/engine.js";
import { prepareProp, fractureProp } from "../src/props.js";
import { BARRELS, SPILLS, SPILL_LIMIT, barrelWarning } from "../src/barrels.js";
import { addSpill, addWater, updateReactions, surfaceReaction, explosionReaction,
  reactionContacts, contactReaction, consumeReactionArea } from "../src/reactions.js";
import { igniteFighter } from "../src/weird-weapons.js";
import { impactSpecial } from "../src/specials.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { blackholeField, updateBlackhole } from "../src/blackhole.js";
import { firePhaser } from "../src/phaser.js";
import { carveExplosion } from "../src/terrain.js";
import { makeRig } from "../src/puppet.js";

const floor=(id="floor",y=1000)=>({id,x:0,y,w:2560,h:24,baseX:0,baseY:y,dx:0,dy:0});
const prop=(kind,x=800,y=930)=>prepareProp({id:kind+x,kind,x,y,w:54,h:70,hp:85,maxHp:85});
function lab(){
  const w=new World({players:[0,1],shuffle:false,random:()=>.43});
  Object.assign(w,{phase:"fight",platforms:[floor()],cover:[],chunks:[],water:[],gas:[],spills:[],
    hazards:[],drops:[],weaponTimer:999});
  w.arena={...w.arena,spikes:[]};
  for(const p of w.players)Object.assign(p,{x:1800+p.id*250,y:970,vx:0,vy:0,ground:true,support:"floor"});
  return w;
}
function advance(w,seconds,player,input={}){
  for(let n=0;n<Math.ceil(seconds/STEP);n++){
    w.time+=STEP;
    if(player?.alive)w.move(player,cleanInput(input),STEP);
    updateReactions(w,STEP);
  }
}
const volume=w=>w.spills.reduce((sum,q)=>sum+q.w*q.h,0);

test("every barrel variant appears in the arena rotation with distinct physical weight",()=>{
  const counts=Object.fromEntries(Object.keys(BARRELS).map(k=>[k,0]));
  for(let arena=0;arena<ARENAS.length;arena++){
    const w=new World({arena});
    for(const b of w.cover)if(b.kind in counts)counts[b.kind]++;
    assert.ok(validSnapshot(w.snapshot()));
  }
  for(const [kind,count] of Object.entries(counts))assert.ok(count>=5,kind);
  assert.ok(prop("oilBarrel").mass<prop("tarBarrel").mass);
});

test("TNT arms a three-second fuse, survives further hits and leaves its casing once",()=>{
  const w=lab(),b=prop("barrel");w.cover=[b];w.damageCover(b,10);
  assert.equal(b.fuse,3);assert.equal(b.vx,0);assert.equal(b.vy,0);
  w.damageCover(b,200);assert.equal(b.hp,1);assert.ok(b.fuse>0);
  advance(w,1);assert.ok(b.hp>0);advance(w,1);assert.equal(b.hp,0);
  assert.equal(w.events.filter(e=>e.type==="explosion"&&e.weapon==="barrel").length,1);
  assert.ok(w.chunks.length>=6);assert.ok(w.chunks.every(c=>c.kind==="barrel"&&c.sourceArt));
  advance(w,3);assert.equal(w.events.filter(e=>e.type==="explosion"&&e.weapon==="barrel").length,1);
});

test("both explosive casings count down and pulse faster, while cold holds the warning",()=>{
  for(const kind of ["barrel","canister"]){
    const p=prop(kind);assert.equal(barrelWarning(p).count,0);
    p.leak=1;p.fuse=2.5;assert.equal(barrelWarning(p).count,3);
    p.fuse=1.5;assert.equal(barrelWarning(p).count,2);
    p.fuse=.5;assert.equal(barrelWarning(p).count,1);
    const waves=(from,to)=>{
      let edges=0,last=false;
      for(let t=from;t>to;t-=.005){p.fuse=t;const next=barrelWarning(p).pulse>.45;if(next&&!last)edges++;last=next;}
      return edges;
    };
    assert.ok(waves(1.05,.05)>waves(3,2));
    p.cold=1;assert.equal(barrelWarning(p).pulse,0);assert.equal(barrelWarning(p).swell,1);
  }
});

test("gas cylinders leak and propel themselves; liquid barrels release only their own finite contents",()=>{
  const gas=lab(),c=prop("canister");gas.cover=[c];gas.damageCover(c,5);advance(gas,.4);
  assert.ok(c.vx!==0&&gas.gas.length>0);assert.equal(gas.spills.length,0);
  for(const kind of ["oilBarrel","glueBarrel","tarBarrel"]){
    const w=lab(),b=prop(kind);w.cover=[b];w.damageCover(b,10);advance(w,3.1);
    assert.ok(b.spent);assert.ok(b.liquidLeft<.01);assert.equal(w.gas.length,0);
    assert.ok(Math.abs(volume(w)-96*32)<1e-5);assert.ok(w.spills.every(q=>q.kind===BARRELS[kind].contents));
    const before=volume(w);w.damageCover(b,200);advance(w,.5);assert.ok(Math.abs(volume(w)-before)<1e-5);
  }
});

test("breaking a full liquid barrel releases its contents once and preserves recognizable metal shards",()=>{
  for(const kind of ["oilBarrel","glueBarrel","tarBarrel"]){
    const w=lab(),b=prop(kind);w.cover=[b];w.damageCover(b,200);
    assert.equal(b.hp,0);assert.equal(volume(w),96*32);assert.ok(w.chunks.length>=6);
    assert.ok(w.chunks.every(c=>c.kind===kind&&c.sourceArt));
    w.damageCover(b,200);assert.equal(volume(w),96*32);
  }
});

test("oil spreads farther than viscous tar, and both conserve volume and drain through destruction",()=>{
  const widths={};
  for(const kind of ["oil","tar"]){
    const w=lab();w.platforms=[floor("upper",700),floor("lower",1100)];
    addSpill(w,kind,816,699,24);advance(w,2);widths[kind]=w.spills.length;
    assert.ok(Math.abs(volume(w)-24*32)<1e-6);
    carveExplosion(w,{x:816,y:700,radius:240});advance(w,2);
    assert.ok(w.spills.some(q=>q.y>1080));assert.ok(Math.abs(volume(w)-24*32)<1e-6);
  }
  assert.ok(widths.oil>widths.tar);
});

test("a wall blocks the initial spill and lateral flow",()=>{
  const w=lab();w.platforms.push({...floor("wall",850),x:832,w:24,h:150});
  addSpill(w,"oil",816,990,96);advance(w,3);assert.ok(w.spills.every(q=>q.x<832));
});

test("spill admission stays bounded and rejected liquid stays in its barrel",()=>{
  const w=lab();addSpill(w,"oil",1200,600,20000);addSpill(w,"tar",1200,400,20000);
  assert.equal(w.spills.length,SPILL_LIMIT);
  const b=prop("glueBarrel");w.cover=[b];w.damageCover(b,200);
  assert.equal(b.hp,1);assert.equal(b.liquidLeft,96);assert.equal(w.spills.length,SPILL_LIMIT);
  w.spills=[];advance(w,3.1);assert.ok(b.spent);assert.ok(b.liquidLeft<1e-6);
});

test("flame and electrical shots ignite oil and tar, but glue does not burn",()=>{
  for(const kind of Object.keys(SPILLS))for(const shotKind of ["flame","tesla"]){
    const w=lab();addSpill(w,kind,816,999,24);advance(w,.2);
    const shot={kind:shotKind,r:4,owner:0};
    const hit=reactionContacts(w,shot,816,940,816,1010).find(c=>c.spill);
    assert.ok(hit);contactReaction(w,shot,hit);
    assert.equal(w.spills.some(q=>q.fire>0),kind!=="glue");
  }
});

test("ignited oil burns through finite fuel and tar burns for longer",()=>{
  for(const kind of ["oil","tar"]){
    const w=lab();addSpill(w,kind,816,999,24,true);advance(w,8);
    assert.equal(w.spills.some(q=>q.fire),kind==="tar");advance(w,4);assert.equal(w.spills.length,0);
  }
});

test("burning oil ignites nearby gas and wood but solid cover blocks spread",()=>{
  for(const blocked of [false,true]){
    const w=lab(),b=prop("crate",832,930);w.cover=[b];
    if(blocked)w.platforms.push({...floor("wall",870),x:831,w:4,h:130});
    addSpill(w,"oil",800,999,24,true);advance(w,.1);
    b.fire=0;b.fuel=8;
    w.gas=[{id:++w.reactionSerial,x:850,y:978,r:25,vx:0,vy:0,life:3,lit:0,owner:0}];
    advance(w,.05);assert.equal(b.fire>0,!blocked);assert.equal(w.gas.some(g=>g.lit>0),!blocked);
  }
});

test("water quenches spill fires and washes away glue; cryo seals leaking barrels",()=>{
  const w=lab();addSpill(w,"oil",816,999,24,true);addWater(w,816,999,24);advance(w,.3);
  assert.ok(w.spills.every(q=>!q.fire));
  w.spills=[];addSpill(w,"glue",816,999,24);const before=volume(w);advance(w,1);assert.ok(volume(w)<before);
  const b=prop("oilBarrel");w.cover=[b];w.damageCover(b,5);
  surfaceReaction(w,{kind:"frost"},b);advance(w,1);assert.equal(b.liquidLeft,96);
  advance(w,2);assert.ok(b.liquidLeft<96);
});

test("oil preserves sliding momentum while glue and tar reduce grounded movement and allow jumping free",()=>{
  const distance={};
  for(const kind of [null,"oil","glue","tar"]){
    const w=lab(),p=w.players[0];Object.assign(p,{x:800,vx:200});p.rig=makeRig(p);
    if(kind)for(let x=640;x<1152;x+=32)addSpill(w,kind,x,999,8);
    advance(w,.06);const start=p.x;advance(w,.4,p,kind==="glue"||kind==="tar"?{right:true}:{});
    distance[kind]=p.x-start;
    if(kind==="glue"||kind==="tar"){
      advance(w,.1,p,{jump:true});assert.ok(p.y<950);assert.ok(p.vy<0);
      p.x=1400;advance(w,1,p);assert.ok(!p.glued&&!p.tarred);
    }
  }
  assert.ok(distance.oil>distance.null*3);assert.ok(distance.glue<distance.tar);
});

test("burn expires during a living knockdown, repeated hits refresh without stacking, and lethal fire still chars",()=>{
  const w=lab(),p=w.players[0];p.knockdown=1.7;p.rig=makeRig(p);
  igniteFighter(p);advance(w,1,p);assert.ok(p.burn<2.01);
  for(let i=0;i<10;i++)igniteFighter(p);assert.equal(p.burn,3);
  advance(w,3.1,p);assert.equal(p.burn,0);assert.ok(p.alive);
  const hp=p.hp;advance(w,1,p);assert.equal(p.hp,hp);
  p.hp=5;igniteFighter(p);advance(w,.4,p);assert.equal(p.alive,false);assert.equal(w.ragdolls[0].effect,"burn");
});

test("leaving a burning spill extinguishes the fighter three seconds later, and water/ice act immediately",()=>{
  const w=lab(),p=w.players[0];p.x=816;addSpill(w,"oil",816,999,24,true);advance(w,.2);
  assert.equal(p.burn,3);p.x=1600;advance(w,3.1,p);assert.equal(p.burn,0);assert.ok(p.alive);
  igniteFighter(p);impactSpecial(w,{kind:"frost",chill:1},p,true);assert.equal(p.burn,0);
  p.freeze=0;igniteFighter(p);addWater(w,p.x,999,24);advance(w,.1);assert.equal(p.burn,0);
});

test("burning oil and active barrel fuses survive snapshots and hot join; resets restore a clean arena",async()=>{
  const w=lab(),b=prop("oilBarrel");w.cover=[b,prop("barrel",1200)];
  surfaceReaction(w,{kind:"flame"},b);w.damageCover(w.cover[1],5);advance(w,.5);
  igniteFighter(w.players[0]);w.players[0].burn=1.27;
  fractureProp(w,b);
  const render=new RenderSnapshots(),s=render.make(w.snapshot());assert.ok(validSnapshot(s));
  const joined=await decodeState(await encodeState(s));assert.deepEqual(joined.spills,s.spills);
  assert.equal(joined.players[0].burn,1.27);assert.equal(joined.cover[1].fuse,s.cover[1].fuse);
  advance(w,.1);const next=render.make(w.snapshot()),middle=interpolateStates(s,next,.5);
  assert.equal(middle.spills[0].id,s.spills[0].id);assert.ok(validSnapshot(middle));
  w.startRound();assert.equal(w.spills.length,0);assert.ok(w.players.every(p=>p.burn===0&&!p.glued&&!p.tarred&&!p.oiled));
  assert.ok(w.cover.every(b=>!b.leak));
});

test("invalid spill kinds, duplicated IDs, excessive fuel, and malformed timer state are rejected",()=>{
  const w=lab();addSpill(w,"oil",816,999,24);const state=w.snapshot();assert.ok(validSnapshot(state));
  for(const change of [s=>s.spills[0].kind="unknown",s=>s.spills[0].kind="__proto__",
    s=>s.spills[0].h=500,s=>s.spills[0].fire=12,s=>s.spills[0].x=NaN,s=>s.spills[0].cold=-1,
    s=>s.spills.push({...s.spills[0]}),s=>s.spills=Array(97).fill(s.spills[0]),s=>s.players[0].burn=3.1,
    s=>s.players[0].burn=-1,s=>s.players[0].glued=Infinity,s=>s.cover.push({...prop("oilBarrel"),liquidLeft:97})]){
    const s=structuredClone(state);change(s);assert.equal(validSnapshot(s),false);
  }
});

test("nuclear clearing, PHASER and black holes consume spills instead of leaving invisible effects",()=>{
  for(const method of ["nuke","phaser","blackhole"]){
    const w=lab();addSpill(w,"tar",816,800,24);const p=w.players[0];p.x=600;p.y=790;p.rig=null;
    if(method==="nuke")consumeReactionArea(w,{x:816,y:800,radius:220});
    if(method==="phaser")firePhaser(w,p,1,0);
    if(method==="blackhole"){
      const f=blackholeField(w,{x:816,y:800,owner:0});w.fields=[f];updateBlackhole(w,f,.41);
      assert.ok(f.matter.totals[6]>0);
    }
    assert.equal(w.spills.length,0,method);
  }
});
