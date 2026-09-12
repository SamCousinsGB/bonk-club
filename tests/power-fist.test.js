import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS, ARENAS, cleanInput } from "../src/engine.js";
import { makeRig } from "../src/puppet.js";
import { POWER_FIST, launchPowerFist, movePowerFlight } from "../src/power-fist.js";
import { prepareProp } from "../src/props.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { WeaponRotation, secondaryAction } from "../src/arsenal.js";
import { killCredit } from "../src/kill-credit.js";
import { combatFloor } from "./helpers.js";

const box = (id,x,y,w,h) => ({id,x,y,w,h,baseX:x,baseY:y,dx:0,dy:0});
function fixture(angle=0) {
  const w = new World({players:[0,1,2],shuffle:false,random:()=>.4});
  combatFloor(w); w.platforms=[]; w.chunks=[]; w.cables=[]; w.water=[]; w.gas=[]; w.spills=[];
  w.arena={...w.arena,spikes:[]}; w.phase="fight";
  w.players.forEach((p,i)=>{
    Object.assign(p,{x:i===0?550:i===1?550+Math.cos(angle)*58:2300,
      y:i===0?650:i===1?640+Math.sin(angle)*58:300,
      vx:0,vy:0,ground:false,aimAngle:angle,support:null,weapon:null});
    p.rig=makeRig(p);
  });
  Object.assign(w.players[0],{weapon:"powerfist",ammo:4});
  return w;
}
const packed = w => new RenderSnapshots().make(w.snapshot());
function advance(w,p,ticks) {
  for(let i=0;i<ticks;i++){w.time+=STEP;w.move(p,cleanInput({}),STEP);}
}

test("power fist punches launch a living body in the aimed direction, including downwards",()=>{
  for(const angle of [0,Math.PI,-Math.PI/2,Math.PI/2,-.7,.65]) {
    const w=fixture(angle),[p,q]=w.players; w.attack(p);
    assert.equal(q.hp,66);assert.ok(q.knockdown>1.6);assert.equal(q.powerFlight,POWER_FIST.duration);
    assert.ok(Math.abs(q.vx-Math.cos(angle)*POWER_FIST.speed)<.001);
    assert.ok(Math.abs(q.vy-Math.sin(angle)*POWER_FIST.speed)<.001);
    assert.equal(p.ammo,3);assert.equal(w.projectiles.length,0);assert.equal(w.fields.length,0);
    assert.equal(secondaryAction(p),null);assert.ok(validSnapshot(packed(w)));
  }
});

test("misses and wall-blocked punches do not launch bodies or carve distant terrain",()=>{
  for(const mode of ["miss","wall"]){
    const w=fixture(),[p,q]=w.players;
    if(mode==="miss")q.x+=250;
    else w.platforms.push(box("cover",575,580,8,150));
    const before=structuredClone(w.platforms);w.attack(p);
    assert.equal(q.hp,100);assert.equal(q.powerFlight,undefined);
    assert.deepEqual(w.platforms,before);
  }
});

test("an empty-handed parry stops the power fist and the remaining contact window",()=>{
  const w=fixture(),[p,q]=w.players;
  Object.assign(q,{block:true,blockTime:.1,facing:-1,aimAngle:Math.PI});
  w.attack(p);assert.equal(q.hp,100);assert.equal(q.powerFlight,undefined);
  assert.ok(p.stun>0);assert.ok(w.events.some(e=>e.type==="parry"));
  assert.equal(w.terrainVersion,0);
});

test("a flying curled ragdoll carves successive thin and thick walls only upon contact",()=>{
  const w=fixture(),[p,q]=w.players;
  w.platforms=[box("near",900,200,8,900),box("thick",1250,200,180,900),box("distant",2200,200,20,900)];
  const before=structuredClone(w.platforms);w.attack(p);
  advance(w,q,8);assert.deepEqual(w.platforms,before);
  advance(w,q,48);
  assert.ok(q.x>1450,`continued through walls: ${q.x}`);
  for(const id of ["near","thick"]){
    assert.ok(!w.platforms.some(s=>s.id===id));
    assert.ok(w.platforms.some(s=>s.sourceId===id));
  }
  assert.deepEqual(w.platforms.find(s=>s.id==="distant"),before[2]);
  assert.ok(Math.hypot(q.rig[4].x-q.rig[1].x,q.rig[4].y-q.rig[1].y)<22,"hands tuck to chest");
  assert.ok(Math.hypot(q.rig[8].x-q.rig[2].x,q.rig[8].y-q.rig[2].y)<24,"feet tuck to hips");
  assert.ok(q.y>650,"gravity continues throughout launch");
  assert.ok(q.vx>1700,"wall impact retains forward momentum");
  assert.ok(validSnapshot(packed(w)));
});

test("impacts fracture rotated props with momentum and clear contacted rubble",()=>{
  const w=fixture(),[p,q]=w.players;
  w.cover=[prepareProp({...box("sofa",900,620,110,85),kind:"sofa",hp:75,maxHp:75,angle:.3})];
  w.attack(p);advance(w,q,22);
  assert.equal(w.cover[0].hp,0);assert.ok(w.chunks.length>0);
  assert.ok(w.chunks.some(b=>Math.abs(b.vx)>200));
  assert.ok(q.x>950);assert.ok(validSnapshot(packed(w)));
});

test("smashing sealed containers destroys the casing instead of stopping at its reserved final HP",()=>{
  for(const kind of ["barrel","canister","oilBarrel","glueBarrel","waterTank"]){
    const w=fixture(),[p,q]=w.players;
    w.cover=[prepareProp({...box("container",900,620,65,90),kind,hp:85,maxHp:85,
      ...(kind==="waterTank"?{waterLeft:210}:{})})];
    w.attack(p);advance(w,q,25);
    assert.equal(w.cover[0].hp,0,kind);assert.ok(q.x>1000,kind);
    assert.ok(validSnapshot(packed(w)),kind);
  }
});

test("cable contact cuts the physical span and later snapshots retain missing links",()=>{
  for(const kind of ["transmission","furnace"]){
    const arena=ARENAS.findIndex(a=>a[kind]);
    const w=new World({players:[0,1],arena,shuffle:false,random:()=>.4}),[p,q]=w.players;
    w.phase="fight";const c=w.cables[0],point=c.points[12];
    Object.assign(q,{x:point.x-75,y:point.y,vx:0,vy:0});q.rig=makeRig(q);
    launchPowerFist(w,q,p,1,0);advance(w,q,12);
    assert.ok(c.links.some(v=>!v),kind);assert.ok(validSnapshot(packed(w)),kind);
  }
});

test("bubble pop damage is still applied once when a power fist launches its occupant",()=>{
  const w=fixture(),[p,q]=w.players;q.bubble=2;
  w.attack(p);assert.equal(q.hp,34);assert.equal(q.bubble,0);assert.ok(q.powerFlight>0);
  advance(w,q,5);assert.equal(q.hp,34);
});

test("the body can hit another fighter once, crediting its puncher",()=>{
  const w=fixture(),[p,q,r]=w.players;
  Object.assign(r,{x:1000,y:680,hp:40});r.rig=makeRig(r);
  let credit;w.onKill=event=>{credit=killCredit(w,event.source);};
  w.attack(p);advance(w,q,30);
  assert.equal(r.alive,false);assert.equal(credit.id,p.id);
  assert.equal(w.ragdolls.length,1);
});

test("a lethal punch keeps the corpse curled, moving and destructive",()=>{
  const w=fixture(),[p,q]=w.players;q.hp=30;
  w.platforms=[box("wall",900,200,20,1000)];w.attack(p);
  assert.equal(q.alive,false);const rag=w.ragdolls[0];assert.ok(rag.powerFlight>0);
  const x=rag.points[2].x;
  for(let i=0;i<30;i++){w.time+=STEP;w.updateRagdolls(STEP);}
  assert.ok(rag.points[2].x>x+400);assert.ok(!w.platforms.some(s=>s.id==="wall"));
  assert.ok(validSnapshot(packed(w)));
});

test("survivors recover with control and ordinary collisions after the launch expires",()=>{
  const w=fixture(-Math.PI/2),[p,q]=w.players;
  for(const f of [p,q]){f.y+=500;f.rig=makeRig(f);}
  w.attack(p);let recovered=false;
  for(let i=0;i<260;i++){
    w.time+=STEP;w.move(q,cleanInput({move:1}),STEP);
    if(!q.knockdown){recovered=true;break;}
  }
  assert.ok(recovered);assert.equal(q.powerFlight,0);assert.ok(q.alive);
  const before=q.x;advance(w,q,1);w.move(q,cleanInput({move:1}),STEP);
  assert.ok(q.x>=before);assert.ok(validSnapshot(packed(w)));
});

test("prediction cannot launch or destroy; reset clears powered bodies and terrain cuts",()=>{
  const w=fixture(),[p,q]=w.players;w.prediction=true;
  w.attack(p);assert.equal(q.hp,100);assert.equal(q.powerFlight,undefined);
  launchPowerFist(w,q,p,1,0);assert.equal(q.powerFlight,undefined);
  w.prediction=false;launchPowerFist(w,q,p,1,0);w.startRound();
  assert.ok(w.players.every(p=>!p.powerFlight));assert.equal(w.ragdolls.length,0);
  assert.equal(w.terrainSerial,0);assert.ok(validSnapshot(packed(w)));
});

test("snapshot codec, interpolation and hot join retain powered bodies and the carved geometry",async()=>{
  const w=fixture(),[p,q]=w.players;w.platforms=[box("wall",900,200,8,1000)];
  const a=packed(w);w.attack(p);advance(w,q,24);const b=packed(w);
  const decoded=await decodeState(await encodeState(b));
  assert.ok(validSnapshot(decoded));assert.equal(decoded.players[1].powerFlight,b.players[1].powerFlight);
  const middle=interpolateStates(a,b,.5);assert.deepEqual(middle.platforms,b.platforms);
  assert.ok(validSnapshot(middle));
  for(const value of [-1,2,Infinity,"1",null]){
    const invalid=structuredClone(b);invalid.players[1].powerFlight=value;
    assert.equal(validSnapshot(invalid),false,String(value));
  }
  q.hp=1;w.hit(q,p,2,0,1);const corpse=packed(w);assert.ok(validSnapshot(corpse));
  corpse.ragdolls[0].powerFlight=100;assert.equal(validSnapshot(corpse),false);
});

test("the new weapon appears in featured rotation and repeated flights keep every arena within wire limits",()=>{
  const rotation=new WeaponRotation(()=>.4);
  assert.ok(Array.from({length:Object.keys(WEAPONS).length},()=>rotation.next()).includes("powerfist"));
  for(let arena=0;arena<ARENAS.length;arena++){
    const w=new World({players:[0,1],arena,shuffle:false,random:()=>.4});w.phase="fight";
    const [p,q]=w.players;
    for(let n=0;n<8;n++){
      Object.assign(q,{x:200+n*170,y:350+n*90,vx:0,vy:0});q.rig=makeRig(q);
      launchPowerFist(w,q,p,Math.cos(n*1.3),Math.sin(n*1.3));
      for(let i=0;i<30;i++){w.time+=STEP;movePowerFlight(w,q,STEP);}
      assert.ok(w.platforms.length<=1536,`${arena}: ${w.platforms.length}`);
      assert.ok(validSnapshot(packed(w)),`arena ${arena} launch ${n}`);
    }
  }
});
