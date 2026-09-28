import {blackholeField,updateBlackhole} from "../src/blackhole.js";
import { TRAIN_Y, TRAIN_SPEED, TRAIN_CYCLE } from "../src/setpiece-arenas.js";
import { ladlePose } from "../src/foundry.js";
import { updateReactions } from '../src/reactions.js';
import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateHazards, hazardZone } from "../src/hazards.js";
import { prepareProp } from "../src/props.js";
import { trainBodies, trainBox, trainIntersects, trainPose } from "../src/trains.js";
import { carveExplosion } from "../src/terrain.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { GuestPrediction } from "../src/guest-prediction.js";
import { navigation, routesFrom, surfaceAt } from "../src/navigation.js";
import { updateCables, cableSolids } from "../src/heavy-cables.js";

const fixture=(theme="railway")=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.theme===theme),players:[0,1,2,3],shuffle:false,random:()=>.4});
  w.phase="fight";w.weaponTimer=w.grenadeTimer=999;return w;
};
const place=(p,x,y,extra={})=>Object.assign(p,{x,y,vx:0,vy:0,ground:false,support:null,rig:null,prone:false,dropThrough:0,jumps:0,...extra});
const tick=w=>{updateHazards(w,STEP);updateReactions(w,STEP);};

test("train gives two seconds warning, crosses at speed and alternates directions",()=>{
  const w=fixture(),h=w.hazards[0];h.age=3;tick(w);assert.ok(h.warning>1.9&&!h.active);
  assert.deepEqual(hazardZone(h),{x:0,y:TRAIN_Y-150,w:2560,h:150});
  h.age=5.5;tick(w);const x=h.bodyX;tick(w);assert.ok(Math.abs(h.bodyX-x-TRAIN_SPEED*STEP)<.001);
  h.age=16.5;tick(w);assert.equal(h.dir,-1);const right=h.bodyX;tick(w);assert.ok(h.bodyX<right);
  assert.ok(validSnapshot(w.snapshot()));
});

test("swept train contact kills prone and recovering fighters and moves severed bodies",()=>{
  for(const extra of [{},{prone:true},{knockdown:1},{freeze:1},{block:true}]){
    const w=fixture(),h=w.hazards[0],p=w.players[0];h.age=5.2;
    place(p,1000,TRAIN_Y-40,extra);tick(w);assert.equal(p.alive,false);assert.equal(w.lastDeathCause,"train");
    const rag=w.ragdolls[0];assert.equal(rag.effect,"blend");const before=structuredClone(rag.points);
    for(let i=0;i<20;i++){w.updateRagdolls(STEP);tick(w);}
    assert.ok(rag.points.some((q,i)=>Math.hypot(q.x-before[i].x,q.y-before[i].y)>30));
  }
});

test("warning is safe and a real timed double jump clears the train",()=>{
  const w=fixture(),h=w.hazards[0],p=w.players[0];place(p,1280,TRAIN_Y-30,{ground:true,support:w.platforms[8].id});
  h.age=4.8;tick(w);assert.equal(p.hp,100);
  h.age=4.8;let clear=false;
  for(let i=0;i<180;i++){
    w.move(p,cleanInput({jump:i===0||i===50}),STEP);tick(w);
    if(h.active&&h.bodyX+h.w/2>1280&&h.bodyX-h.w/2<1280){assert.ok(p.y+30<=TRAIN_Y-150);clear=true;}
  }
  assert.ok(clear&&p.alive);assert.equal(p.hp,100);
});

test("train strikes props and loose weapons while the upper route stays safe",()=>{
  const w=fixture(),h=w.hazards[0];h.age=5.2;
  place(w.players[0],1000,750);Object.assign(w.cover[0],{x:1000,y:TRAIN_Y-70});
  w.drops.push({x:1040,y:TRAIN_Y-30,vx:0,vy:0,type:"blaster",ammo:10,life:100});tick(w);
  assert.equal(w.players[0].hp,100);assert.equal(w.cover[0].hp,0);
  assert.ok(w.drops.at(-1).vx>1000);assert.ok(w.chunks.length>0);
});

test("destroyed approaches keep warning and alternating services, including after a wreck",()=>{
  const w=fixture(),h=w.hazards[0];w.cover=[];
  for(const x of [25,2535])carveExplosion(w,{x,y:TRAIN_Y,radius:90});
  const warnings=[],directions=[];let oldWarning=0,oldDerailed=false;
  for(let i=0;i<TRAIN_CYCLE*4/STEP;i++){
    tick(w);
    if(h.warning>0&&!oldWarning)warnings.push(h.dir);
    if(h.derailed&&!oldDerailed)directions.push(h.dir);
    oldWarning=h.warning;oldDerailed=h.derailed;
    if(i%120===0)assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())),`frame ${i}`);
  }
  assert.deepEqual(warnings,[1,-1,1,-1]);assert.deepEqual(directions,[1,-1,1,-1]);
  const s=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
  assert.ok(validSnapshot(s));assert.deepEqual(s.platforms.map(p=>p.id),w.platforms.map(p=>p.id));
  w.startRound();assert.equal(w.hazards.length,1);assert.ok(!w.hazards[0].done);assert.equal(w.hazards[0].age,0);
});

test("train validation rejects malformed geometry and interpolation never sweeps a dormant train",()=>{
  const w=fixture(),r=new RenderSnapshots();w.hazards[0].age=4.99;tick(w);const a=r.make(w.snapshot());
  w.hazards[0].age=5.04;tick(w);const b=r.make(w.snapshot());
  assert.equal(interpolateStates(a,b,.5).hazards[0].bodyX,b.hazards[0].bodyX);
  for(const [key,value] of [["w",3201],["y",900],["bodyX",Infinity],["h",151]]){
    const bad=structuredClone(b);bad.hazards[0][key]=value;assert.equal(validSnapshot(bad),false,key);
  }
  w.prediction=true;const age=w.hazards[0].age;tick(w);assert.equal(w.hazards[0].age,age);
});

test("both new arenas connect all spawn positions to their contested weapons",()=>{
  for(const theme of ["railway","foundry"]){
    const w=fixture(theme),solids=w.solids(),graph=navigation(solids,{spikes:[]});
    for(const p of w.players){
      const paths=routesFrom(graph,solids,surfaceAt(solids,p),p.x,new Map(),0);
      for(const [x,y] of w.arena.weapons)assert.ok(paths.has(surfaceAt(solids,{x,y}).id),`${theme} spawn ${p.id} -> ${x}`);
    }
    assert.ok(validSnapshot(w.snapshot()),theme);
  }
});

test("foundry molten pits kill and destroyed machinery stays absent until reset",()=>{
  const w=fixture("foundry");place(w.players[0],790,1250);for(let i=0;i<6;i++)tick(w);assert.equal(w.players[0].alive,false);assert.equal(w.lastDeathCause,"burn");
  const press=w.hazards.find(h=>h.type==="crusher");carveExplosion(w,{x:press.bodyX,y:press.bodyY,radius:75});tick(w);
  assert.ok(press.done);const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  w.startRound();assert.ok(w.hazards.every(h=>!h.done));
});

test("ladles warn before pouring, kill only in the stream and stop after a mounting cut",()=>{
  const w=fixture("foundry"),h=w.hazards.find(h=>h.type==="ladle"),p=w.players[0];
  place(p,ladlePose({...h,age:6.5}).x,960);h.age=4.5;tick(w);assert.ok(h.warning>0&&!h.active);assert.equal(p.hp,100);
  h.age=6.5;place(w.players[1],730,960);tick(w);
  assert.equal(p.alive,true); // Pouring must travel from the mouth to the fighter.
  for(let i=0;i<100 && p.alive;i++)tick(w);
  assert.equal(p.alive,false);assert.equal(w.players[1].hp,100);assert.equal(w.ragdolls[0].effect,"burn");
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
  carveExplosion(w,{x:790,y:570,radius:75});tick(w);assert.ok(h.done&&!h.active);
  const s=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);assert.ok(s.hazards.find(q=>q.id===h.id).done);
  const bad=structuredClone(s);bad.hazards.find(q=>q.id===h.id).h=900;assert.equal(validSnapshot(bad),false);
  w.startRound();assert.ok(w.hazards.every(h=>!h.done));
});

test("fast shots collide with the passing train and cannot shoot through it",()=>{
  const w=fixture(),h=w.hazards[0];h.age=5.7;tick(w);
  w.projectiles.push({kind:"bullet",x:h.bodyX-h.w/2-70,y:TRAIN_Y-70,vx:30000,vy:0,r:3,life:Infinity,damage:20,force:200,owner:0,weapon:"blaster"});
  w.updateProjectiles(1/30);assert.equal(w.projectiles.length,0);
});

test("thin decks land from above, hold a hanging fighter, then release to solid floors",()=>{
  const w=fixture(),p=w.players[0],deck=w.platforms.find(s=>s.oneWay&&s.x===750);
  w.cover=[];place(p,870,deck.y-100,{vy:100});
  for(let i=0;i<60;i++)w.move(p,cleanInput({}),STEP);
  assert.equal(p.support,deck.id);const y=p.y;
  for(let i=0;i<80;i++)w.move(p,cleanInput({duck:true}),STEP);
  assert.equal(p.hangSupport,deck.id);assert.ok(Math.abs(p.y-(deck.y+deck.h+60))<12);
  assert.equal(p.ground,false);assert.equal(p.prone,false);
  w.move(p,cleanInput({}),STEP);
  for(let i=0;i<80;i++)w.move(p,cleanInput({duck:true}),STEP);
  assert.ok(p.y>y+200&&p.ground);assert.equal(p.y,TRAIN_Y-10);assert.equal(p.prone,true);
  // A solid floor always supports prone fighters, even while S is held.
  for(let i=0;i<60;i++)w.move(p,cleanInput({duck:true}),STEP);assert.equal(p.y,TRAIN_Y-10);
  place(p,870,deck.y+70,{vy:-700});
  for(let i=0;i<28;i++)w.move(p,cleanInput({}),STEP);assert.ok(p.y<deck.y-30);
});

test("guest prediction replays a hang and second press drop",()=>{
  const w=fixture(),p=w.players[1],deck=w.platforms.find(s=>s.oneWay&&s.x===750);
  place(p,870,deck.y-30,{ground:true,support:deck.id});
  const encoder=new RenderSnapshots(),prediction=new GuestPrediction(),s={...encoder.make(w.snapshot()),inputAcks:[0,0,0,0]};
  prediction.receive(s,1,1000);prediction.advance(cleanInput({duck:true}),1,1017);
  for(let i=0;i<2;i++)w.move(p,cleanInput({duck:true}),STEP);
  assert.equal(prediction.player.hangSupport,deck.id);assert.equal(prediction.player.y,p.y);
  for(let i=0;i<24;i++)w.move(p,cleanInput({}),STEP);
  assert.equal(p.hangSupport,deck.id);
  prediction.advance(cleanInput({}),2,1034);
  prediction.advance(cleanInput({duck:true}),3,1051);
  w.move(p,cleanInput({duck:true}),STEP);
  assert.equal(prediction.player.hangSupport,null);assert.equal(p.hangSupport,null);
  for(let i=0;i<24;i++)w.move(p,cleanInput({}),STEP);assert.ok(p.y>deck.y);
  const next=encoder.make(w.snapshot());assert.ok(validSnapshot(next));
  next.players[1].motion.dropThrough=-1;assert.equal(validSnapshot(next),false);
});

test("transmission cable tiles support hanging until a second S press",()=>{
  const w=fixture("transmission");for(let i=0;i<40;i++)updateCables(w,STEP);
  const tile=cableSolids(w).find(s=>s.x>1150),p=w.players[0];assert.ok(tile);
  place(p,tile.x+tile.w/2,tile.y-30,{ground:true,support:tile.id});const start=p.y;
  for(let i=0;i<20;i++)w.move(p,cleanInput({duck:true}),STEP);
  assert.equal(p.hangSupport,tile.id);assert.ok(p.y>start+55&&!p.ground);
  assert.ok(p.x>=tile.x&&p.x<=tile.x+tile.w);
  w.move(p,cleanInput({}),STEP);w.move(p,cleanInput({duck:true}),STEP);
  assert.equal(p.hangSupport,null);assert.ok(p.vy>0);
});

test("W climbs from a hang, respects headroom, and keeps the weapon belted",()=>{
  const w=fixture(),p=w.players[0],deck=w.platforms.find(s=>s.oneWay&&s.x===750);
  w.cover=[];place(p,870,deck.y-30,{ground:true,support:deck.id,weapon:"blaster",ammo:12});
  w.move(p,cleanInput({duck:true}),STEP);
  assert.equal(p.hangSupport,deck.id);assert.equal(p.weapon,"blaster");
  const ammo=p.ammo;w.attack(p);assert.equal(p.ammo,ammo);
  w.move(p,cleanInput({}),STEP);
  const ceiling={id:"ceiling",x:850,y:deck.y-60,w:50,h:15,material:"metal",hp:100};
  w.platforms.push(ceiling);
  w.move(p,cleanInput({jump:true}),STEP);
  assert.equal(p.hangSupport,deck.id,"a ceiling blocks the climb");
  w.move(p,cleanInput({}),STEP);w.platforms.pop();
  w.move(p,cleanInput({jump:true}),STEP);
  assert.equal(p.hangSupport,null);assert.equal(p.support,deck.id);
  assert.equal(p.y,deck.y-30);assert.equal(p.weapon,"blaster");
});

test("a broken hanging support releases the fighter",()=>{
  const w=fixture(),p=w.players[0],deck=w.platforms.find(s=>s.oneWay&&s.x===750);
  w.cover=[];place(p,870,deck.y-30,{ground:true,support:deck.id});
  w.move(p,cleanInput({duck:true}),STEP);
  deck.hp=0;w.move(p,cleanInput({}),STEP);
  assert.equal(p.hangSupport,null);assert.ok(p.vy>0);
});

test("a hanging fighter follows a moving deck and survives a hot-join snapshot",()=>{
  const w=fixture(),p=w.players[0],deck=w.platforms.find(s=>s.oneWay&&s.x===750);
  w.cover=[];place(p,870,deck.y-30,{ground:true,support:deck.id});
  w.move(p,cleanInput({duck:true}),STEP);
  const joined=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
  assert.equal(joined.players[0].hangSupport,deck.id);
  assert.equal(joined.players[0].motion.hangSupport,deck.id);
  const bad=structuredClone(joined);bad.players[0].hangSupport=42;
  assert.equal(validSnapshot(bad),false);
  for(let i=0;i<90;i++)w.move(p,cleanInput({}),STEP);
  const oldY=p.y;
  for(let i=0;i<30;i++){deck.y+=.4;deck.dy=.4;w.move(p,cleanInput({right:true}),STEP);}
  assert.ok(p.y>oldY+5);
  assert.ok(Math.abs(p.rig[4].y-deck.y-deck.h)<.01);
  assert.ok(p.x>870);
});

test("destruction preserves the thin surface flag and invalid wire flags are rejected",()=>{
  const w=fixture();carveExplosion(w,{x:870,y:930,radius:40});
  assert.ok(w.platforms.filter(p=>p.y===930).every(p=>p.oneWay));
  const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  s.platforms[0].oneWay="true";assert.equal(validSnapshot(s),false);
});


test("train impacts keep fresh and existing debris within snapshot motion limits",()=>{
  const w=fixture(),h=w.hazards[0];h.age=5.2;
  w.cover=[prepareProp({id:'track-crate',kind:'crate',x:1000,y:TRAIN_Y-60,w:50,h:60,hp:75,maxHp:75})];
  tick(w);assert.ok(w.chunks.length>0);
  assert.ok(w.chunks.every(b=>Math.abs(b.vx)<=1500));assert.ok(validSnapshot(w.snapshot()));
  tick(w);assert.ok(w.chunks.every(b=>Math.abs(b.vx)<=1500));assert.ok(validSnapshot(w.snapshot()));
});

test("a passing train derails into a physical fall when a wheel reaches missing track",()=>{
  const w=fixture(),h=w.hazards[0];
  carveExplosion(w,{x:1280,y:TRAIN_Y,radius:85});
  assert.ok(w.platforms.some(p=>p.y===TRAIN_Y&&p.x<1280&&p.x+p.w<1280));
  h.age=5.35;
  for(let i=0;i<30&&!h.derailed;i++)tick(w);
  assert.ok(h.derailed);assert.ok(h.active);assert.ok(Math.abs(h.vx)>1000);
  assert.equal(h.carriages.length,8);assert.equal(new Set(h.carriages.map(c=>c.id)).size,8);
  const start={y:h.bodyY,angles:h.carriages.map(c=>c.angle)};
  for(let i=0;i<90;i++)tick(w);
  const angles=h.carriages.map(c=>c.angle),ys=h.carriages.map(c=>c.y);
  assert.ok(Math.abs(h.vx)<1800);assert.ok(angles.some((angle,i)=>Math.abs(angle-start.angles[i])>.08));
  assert.ok(Math.max(...angles)-Math.min(...angles)>.25);assert.ok(Math.max(...ys)-Math.min(...ys)>25);
  assert.ok(validSnapshot(w.snapshot()));
  for(let i=0;i<110;i++)tick(w);
  assert.ok(h.carriages.slice(0,-1).some(car=>!car.coupled));
});

test("the derailed train has rotated collision, destroys platforms and wipes out matter in its path",()=>{
  const w=fixture(),h=w.hazards[0],p=w.players[0];
  carveExplosion(w,{x:1120,y:TRAIN_Y,radius:90});h.age=5.25;
  for(let i=0;i<20&&!h.derailed;i++)tick(w);
  assert.ok(h.derailed);
  for(const [i,car] of trainBodies(h).entries())Object.assign(car,{x:-1800-i*500,y:1600,angle:0,vx:0,vy:0,spin:0,onRail:false,coupled:false});
  Object.assign(h.carriages[3],{x:1280,y:710,vx:900,vy:500,angle:.42,spin:1.1});
  place(p,1280,710);w.drops.push({x:1420,y:750,vx:0,vy:0,type:"blaster",ammo:10,life:100});
  const before=w.platforms.length,box=trainBox(h);
  assert.ok(box.h>h.h*2);assert.ok(trainIntersects(h,playerBoxForTest(p)));
  for(let i=0;i<4;i++)tick(w);
  assert.equal(p.alive,false);assert.equal(w.lastDeathCause,"train");
  assert.ok(w.platforms.length!==before||w.platforms.some(q=>q.id?.startsWith("cut")));
  assert.ok(Math.abs(w.drops.at(-1).vx)>100);
});

test("derail state survives compact hot join, rejects malformed motion and resets next round",()=>{
  const w=fixture(),h=w.hazards[0];carveExplosion(w,{x:1280,y:TRAIN_Y,radius:85});h.age=5.35;
  for(let i=0;i<30&&!h.derailed;i++)tick(w);
  const s=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
  const train=s.hazards[0];assert.ok(train.derailed);assert.ok(Math.abs(train.angle-h.angle)<.01);assert.ok(Math.abs(train.vx-h.vx)<.01);
  assert.equal(train.carriages.length,8);assert.deepEqual(train.carriages.map(c=>c.id),h.carriages.map(c=>c.id));
  for(const [key,value] of [["angle",Math.PI+1],["vx",7000],["spin",8],["derailed","yes"]]){
    const bad=structuredClone(s);bad.hazards[0][key]=value;assert.equal(validSnapshot(bad),false,key);
  }
  for(const mutate of [
    train=>{train.carriages[0].crush=1.1;},
    train=>{train.carriages[0].energy=Infinity;},
    train=>{train.carriages[0].ruptured="yes";},
    train=>{train.carriages[0].fuse=-2;},
    train=>{train.carriages[0].x=9000;},
    train=>{train.carriages[0].coupled="yes";},
    train=>{train.carriages.pop();},
  ]){const bad=structuredClone(s);mutate(bad.hazards[0]);assert.equal(validSnapshot(bad),false);}
  const next=structuredClone(s);next.time+=STEP;next.hazards[0].carriages[0].angle+=.2;
  const blended=interpolateStates(s,next,.5).hazards[0];assert.ok(Math.abs(blended.carriages[0].angle-(train.carriages[0].angle+.1))<.001);
  w.startRound();assert.equal(w.hazards[0].derailed,false);assert.equal(w.hazards[0].angle,0);
});

function playerBoxForTest(p){return{x:p.x-18,y:p.y-28,w:36,h:56};}

test("an isolated tilted carriage loses impact energy and settles onto surviving track",()=>{
  const w=fixture(),h=w.hazards[0];carveExplosion(w,{x:1280,y:TRAIN_Y,radius:85});h.age=5.35;for(let i=0;i<30&&!h.derailed;i++)tick(w);
  for(const c of h.carriages)Object.assign(c,{x:-3000-c.id*300,y:3300,vx:0,vy:0,spin:0,coupled:false,onRail:false});
  const car=h.carriages[0];Object.assign(car,{x:600,y:TRAIN_Y-220,vx:140,vy:400,angle:.45,crush:.3,fuse:-1});
  for(let i=0;i<300;i++)tick(w);
  assert.ok(Math.abs(Math.sin(car.angle))<.15);assert.ok(Math.abs(car.vy)<50);
  assert.ok(car.y<TRAIN_Y&&car.y>TRAIN_Y-120);assert.ok(validSnapshot(w.snapshot()));
});

test("crash braking, ruptures and long-lived wrecks preserve surviving rail in both directions",()=>{
  for(const age of [5.35,16.35]){
    const w=fixture(),h=w.hazards[0];w.cover=[];
    carveExplosion(w,{x:1280,y:TRAIN_Y,radius:85});
    const rails=()=>w.platforms.filter(p=>p.y>=TRAIN_Y&&p.y<TRAIN_Y+90);
    const before=structuredClone(rails());h.age=age;for(let i=0;i<30&&!h.derailed;i++)tick(w);
    assert.ok(h.derailed);assert.ok(Math.abs(h.vx)<2400);
    let ruptured=false;
    for(let i=0;i<400;i++){
      tick(w);ruptured||=h.carriages.some(c=>c.ruptured&&c.energy>0);
      if(i%30===0)assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())),`direction ${h.dir}, tick ${i}`);
    }
    assert.ok(ruptured);assert.ok(h.carriages.some(c=>c.crush>.4));
    assert.ok(h.carriages.every(c=>c.energy>=0&&c.energy<=4));
    assert.deepEqual(rails(),before);
    const joined=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
    assert.deepEqual(joined.hazards[0].carriages,new RenderSnapshots().make(w.snapshot()).hazards[0].carriages);
  }
});

test("crushed equipment tears once without automatic explosions or an electrical damage aura",()=>{
  const w=fixture(),h=w.hazards[0];carveExplosion(w,{x:1280,y:TRAIN_Y,radius:85});h.age=5.35;for(let i=0;i<30&&!h.derailed;i++)tick(w);
  for(const [i,c] of h.carriages.entries())Object.assign(c,{x:-2000-i*300,y:2000,vx:0,vy:0,spin:0,angle:0,coupled:false,onRail:false,fuse:-1});
  const car=h.carriages[3];Object.assign(car,{x:1280,y:500,crush:.5,fuse:0});
  const before=w.events.filter(e=>e.type==='explosion').length;tick(w);
  assert.equal(w.events.filter(e=>e.type==='explosion').length,before);assert.ok(car.ruptured&&car.energy>3.9);
  const p=w.players[0];place(p,car.x,car.y-150);const hp=p.hp;car.shockWait=0;tick(w);
  assert.equal(p.hp,hp);assert.ok(!p.xray);
  const energy=car.energy;w.prediction=true;tick(w);assert.equal(car.energy,energy);
  w.prediction=false;car.fuse=0;tick(w);assert.equal(w.events.filter(e=>e.type==='explosion').length,before);
  assert.equal(w.events.filter(e=>e.kind==='train-metal').length,1);
});


test("a new service preserves the old wreck and its hot-join identity",()=>{
  const w=fixture(),h=w.hazards[0];carveExplosion(w,{x:1280,y:TRAIN_Y,radius:85});
  h.age=5.35;for(let i=0;i<30&&!h.derailed;i++)tick(w);
  const cars=structuredClone(h.carriages);h.age=TRAIN_CYCLE-STEP/2;tick(w);
  const wreck=w.hazards.find(q=>q.wreck);assert.ok(wreck&&wreck.id!==h.id);
  assert.deepEqual(wreck.carriages,cars);assert.ok(!h.derailed&&!h.done);
  h.age=14;tick(w);assert.ok(h.warning>0&&h.dir===-1);
  const s=expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);
  assert.ok(validSnapshot(s));assert.equal(s.hazards.find(q=>q.wreck).id,wreck.id);
  const bad=structuredClone(s);bad.hazards.find(q=>q.wreck).wreck="yes";assert.equal(validSnapshot(bad),false);
});

test("the guideway is the lowest surface and the slower service has clear overhead routes",()=>{
  const w=fixture();assert.equal(TRAIN_SPEED,6400*.8);
  assert.equal(TRAIN_Y,1380);assert.ok(w.platforms.every(p=>p.y<=TRAIN_Y));
  assert.ok(w.platforms.filter(p=>p.y!==TRAIN_Y).every(p=>p.y+p.h<=TRAIN_Y-150-40));
  assert.ok(w.arena.spawns.every(([,y])=>y<TRAIN_Y-150));
});


test("later services strike surviving wrecks with directional momentum",()=>{
  const w=fixture(),h=w.hazards[0];carveExplosion(w,{x:1280,y:TRAIN_Y,radius:85});
  h.age=5.35;for(let i=0;i<30&&!h.derailed;i++)tick(w);
  h.age=TRAIN_CYCLE-STEP/2;tick(w);const wreck=w.hazards.find(q=>q.wreck);
  for(const c of wreck.carriages)Object.assign(c,{x:-3000,y:3300,vx:0,vy:0,spin:0,coupled:false,onRail:false});
  const car=wreck.carriages[3];Object.assign(car,{x:2100,y:TRAIN_Y-75,angle:0,vx:0,vy:0,spin:0,crush:.4});
  h.age=16.12;tick(w);assert.ok(car.vx< -1000);assert.ok(car.crush>.4);
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});


test("a black hole cannot consume the signals or service clock",()=>{
  const w=fixture(),h=w.hazards[0];
  const f=blackholeField(w,{x:h.x,y:h.y,owner:0});f.age=.5;updateBlackhole(w,f,STEP);
  assert.equal(w.hazards[0],h);assert.ok(!h.done);
  h.age=14;tick(w);assert.ok(h.warning>0&&h.dir===-1);
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});
