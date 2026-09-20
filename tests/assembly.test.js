import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { updateAssembly, carTiles, carBody, robotPose } from "../src/assembly.js";
import { updateProps } from "../src/props.js";
import { carveExplosion } from "../src/terrain.js";
import { validSnapshot } from "../src/network.js";
import { RenderSnapshots, interpolateStates, blend } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { welding, steamStrength } from "../src/assembly-geometry.js";
import { nuclearField, updateNuclear } from "../src/nuclear.js";

function fixture() {
  const w = new World({ arena: ARENAS.findIndex(a => a.assembly), players: [0, 1, 2, 3], shuffle: false, random: () => .4 });
  w.phase = "fight"; w.weaponTimer = 999; w.grenadeTimer = 999; w.drops = [];
  return w;
}
function advance(w, seconds, rider) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    w.time += STEP; w.movePlatforms(); updateAssembly(w, STEP); updateProps(w,STEP);
    if(rider)w.move(rider,cleanInput({}),STEP);
  }
}

test("one physical chassis retains its identity through stamping, welding and wheels", () => {
  const w=fixture(),car=w.assembly.cars[0],body=carBody(w,car);
  assert.equal(car.stage,0);assert.equal(body.h,32);
  advance(w,8);assert.equal(car.stage,1);assert.equal(body.h,70);
  advance(w,8);assert.equal(car.stage,2);assert.equal(body.h,134);
  advance(w,8);assert.equal(car.stage,3);assert.equal(carBody(w,car),body);
  assert.equal(body.carStage,3);assert.ok(w.assembly.completed>=4);assert.ok(validSnapshot(w.snapshot()));
});

test("belt runs continuously through tool work and bounded production feeds finished cars off the end",()=>{
  const w=fixture(),car=w.assembly.cars[3],b=carBody(w,car);
  advance(w,1.4);const x=b.x;advance(w,.3);assert.ok(b.x>x+15);assert.ok(w.hazards[2].active);
  advance(w,1);assert.equal(car.stage,3);
  advance(w,8.5);assert.ok(b.angle>.05&&b.y>1058,JSON.stringify(b));
  advance(w,2);assert.equal(carBody(w,car),undefined);
  advance(w,65);assert.ok(w.assembly.completed>=8);assert.ok(w.assembly.cars.length<=6);
  assert.ok(w.cover.filter(b=>b.kind==='car').length<=6);assert.ok(validSnapshot(w.snapshot()));
});

test("fighters ride the belt and shaped car roof, then jump clear",()=>{
  for(const roof of [false,true]){
    const w=fixture();advance(w,3);const p=w.players[0],car=w.assembly.cars[2];
    const surface=roof?carTiles(w,car.id).sort((a,b)=>a.y-b.y)[0]:w.platforms.find(b=>b.assemblyBelt&&b.x===300);
    Object.assign(p,{x:roof?surface.x+surface.w/2:350,y:surface.y-30,ground:true,support:surface.id,rig:null,vx:0,vy:0});
    const x=p.x;advance(w,.8,p);assert.ok(p.x>x+35,`${roof}: ${p.x-x}`);assert.ok(p.ground&&p.alive);
    w.move(p,cleanInput({jump:true}),STEP);assert.ok(p.vy<-400&&!p.ground);
  }
});

test("bullets damage and push a car, destroy it into matching physical metal pieces, and never rebuild it",()=>{
  const w=fixture(),car=w.assembly.cars[2],b=carBody(w,car),p=w.players[0];
  Object.assign(p,{x:b.x-65,y:b.y+30,rig:null,weapon:'blaster',ammo:100,aimAngle:0,facing:1});
  w.attack(p);for(let i=0;i<12;i++)w.updateProjectiles(STEP);
  assert.ok(b.hp<200&&b.hp>0);assert.ok(b.vx>0);
  advance(w,.1);assert.ok(car.damaged);assert.equal(car.stage,1);
  p.weapon='railgun';p.cooldown=0;p.ammo=10;w.attack(p);for(let i=0;i<12;i++)w.updateProjectiles(STEP);
  assert.equal(b.hp,0);assert.ok(w.chunks.length>=8);
  assert.ok(w.chunks.every(q=>q.kind==='car'&&q.material==='metal'&&q.carStage===1&&q.carPaint===b.carPaint&&q.sourceArt));
  advance(w,1);assert.equal(carTiles(w,car.id).length,0);assert.ok(!w.assembly.cars.includes(car));
  assert.ok(validSnapshot(w.snapshot()));
  advance(w,10);assert.equal(carBody(w,car),undefined);
  w.startRound();assert.equal(w.assembly.cars.length,4);assert.equal(w.assembly.completed,0);assert.equal(w.chunks.length,0);
});

test("a destroyed belt keeps driving cars into the gap, where they tip and fall instead of queuing",()=>{
  const w=fixture(),car=w.assembly.cars[0],b=carBody(w,car);
  carveExplosion(w,{x:420,y:1190,radius:170});
  advance(w,4);assert.ok(b.x+b.w/2>280);assert.ok(b.y>1190||Math.abs(b.angle)>.2,JSON.stringify(b));
  advance(w,8);assert.equal(carBody(w,car),undefined);assert.ok(w.assembly.cars.length<=6);assert.ok(validSnapshot(w.snapshot()));
});

test("blast damage retains impulse and prevents later assembly repairs",()=>{
  const w=fixture(),car=w.assembly.cars[2],b=carBody(w,car);
  w.explode({x:b.x-30,y:b.y+25,radius:120,damage:40,force:700});
  assert.ok(b.hp<200);assert.ok(b.vx>0);advance(w,10);
  assert.ok(car.damaged);assert.equal(car.stage,1);assert.ok(b.hp<200);assert.ok(validSnapshot(w.snapshot()));
});

test("press warning is safe; descending underside kills and its top, sides and return stroke are safe",()=>{
  const w=fixture(),h=w.hazards[0];advance(w,.9);assert.ok(h.warning>0);
  Object.assign(w.players[0],{x:640,y:1090,rig:null});
  Object.assign(w.players[1],{x:460,y:1000,rig:null});
  Object.assign(w.players[2],{x:640,y:850,rig:null});
  advance(w,.7);assert.equal(w.players[0].alive,false);assert.equal(w.players[1].hp,100);assert.equal(w.players[2].hp,100);
  assert.equal(w.lastDeathCause,'crusher');
  advance(w,.6);assert.ok(h.assemblyPhase>2.15);
  Object.assign(w.players[3],{x:640,y:h.bodyY-45,rig:null});
  const old=h.bodyY;advance(w,.4);assert.ok(h.bodyY<old);assert.equal(w.players[3].hp,100);
});

test("station destruction permanently disables work and never restores a press head",()=>{
  for(const station of [1,2,3]){
    const w=fixture(),h=w.hazards[station-1],car=w.assembly.cars[station];
    const mount=w.platforms.find(p=>p.assemblyMount===station);
    carveExplosion(w,{x:h.x,y:mount.y,radius:140});advance(w,3);
    assert.ok(h.done);assert.equal(car.stage,station-1);
    if(station===1)assert.ok(!w.platforms.some(p=>p.assemblyHead));assert.ok(validSnapshot(w.snapshot()));
  }
});

test("nuclear removal does not recreate consumed physical cars",()=>{
  const w=fixture(),id=w.assembly.cars[2].id,field=nuclearField(w,{x:1240,y:1100,owner:0});
  field.age=1;updateNuclear(w,field,STEP);advance(w,2);assert.equal(carTiles(w,id).length,0);assert.ok(validSnapshot(w.snapshot()));
});

test("countdown, results and prediction cannot advance production or apply belt traction",()=>{
  const w=fixture(),initial=structuredClone(w.assembly);
  for(const phase of ['countdown','result']){w.phase=phase;advance(w,2);assert.deepEqual(w.assembly,initial);}
  w.phase='fight';w.prediction=true;advance(w,2);assert.deepEqual(w.assembly,initial);
  assert.ok(w.cover.filter(b=>b.kind==='car').every(b=>Math.abs(b.x+b.w/2-initial.cars.find(c=>'car'+c.id===b.id).x)<1));
});

test("hot join preserves damaged falling cars, angular state and physical debris",()=>{
  const w=fixture(),car=w.assembly.cars[0],b=carBody(w,car),snapshots=new RenderSnapshots();
  w.damageCover(b,20,200,0);carveExplosion(w,{x:420,y:1190,radius:170});advance(w,2);
  const a=snapshots.make(w.snapshot()),received=expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(a))),validSnapshot);
  assert.ok(received);assert.deepEqual(received.assembly,a.assembly);assert.deepEqual(received.cover,JSON.parse(JSON.stringify(a.cover)));
  assert.ok(Math.abs(b.angle)>.05||b.y>1190);advance(w,.1);const next=snapshots.make(w.snapshot()),view=interpolateStates(a,next,.5);
  const old=a.cover.find(q=>q.id===b.id),latest=next.cover.find(q=>q.id===b.id),middle=view.cover.find(q=>q.id===b.id);
  assert.ok(middle.x>=Math.min(old.x,latest.x)&&middle.x<=Math.max(old.x,latest.x));assert.ok(validSnapshot(next));
});

test("wire validation rejects malformed production, car appearance, motion and machine phases",()=>{
  const w=fixture();
  for(const patch of [{clock:NaN},{completed:-1},{completed:99},{serial:Infinity},{cars:Array(7).fill(w.snapshot().assembly.cars[0])}]){
    const s=structuredClone(w.snapshot());Object.assign(s.assembly,patch);assert.equal(validSnapshot(s),false);
  }
  for(const patch of [{stage:4},{x:Infinity},{damaged:'yes'},{blocked:1},{id:0}]){
    const s=structuredClone(w.snapshot());Object.assign(s.assembly.cars[0],patch);assert.equal(validSnapshot(s),false);
  }
  for(const patch of [{carStage:4},{carPaint:-1},{angle:NaN},{vx:Infinity}]){
    const s=structuredClone(w.snapshot());Object.assign(s.cover.find(b=>b.kind==='car'),patch);assert.equal(validSnapshot(s),false);
  }
  for(const patch of [{assemblyWork:-1},{assemblyFault:'boom'},{assemblyPhase:NaN},{assemblyPhase:4},{assemblyOffset:Infinity}]){
    const s=structuredClone(w.snapshot());Object.assign(s.hazards[0],patch);assert.equal(validSnapshot(s),false);
  }
  const missing=structuredClone(w.snapshot());delete missing.assembly;assert.equal(validSnapshot(missing),false);
});

test("empty stations remain parked without sparks, steam or damage",()=>{
  const w=fixture();w.cover=w.cover.filter(b=>b.kind!=='car');w.assembly.cars=[];
  const home=robotPose(w.hazards[1],0);Object.assign(w.players[0],{x:640,y:1090,rig:null});
  for(let i=0;i<360;i++){
    advance(w,STEP);assert.deepEqual(robotPose(w.hazards[1],w.hazards[1].assemblyPhase),home);
    assert.ok(w.hazards.every(h=>h.assemblyFault==='empty'&&!h.active&&!h.warning));
    assert.equal(welding(w.hazards[1],w.hazards[1].assemblyPhase),false);assert.equal(steamStrength(w.hazards[0],w.hazards[0].assemblyPhase),0);
  }
  assert.equal(w.assembly.completed,0);assert.equal(w.players[0].hp,100);
});

test("robot links remain rigid and follow the moving car during each weld",()=>{
  const w=fixture();advance(w,1.35);const h=w.hazards[1],first=robotPose(h,h.assemblyPhase)[2];
  assert.ok(welding(h,h.assemblyPhase));advance(w,.2);const next=robotPose(h,h.assemblyPhase)[2];assert.ok(next.x>first.x+10);
  for(let phase=0;phase<3.1;phase+=.01){const [a,b,c]=robotPose(h,phase);
    assert.ok(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-215)<1e-6);assert.ok(Math.abs(Math.hypot(c.x-b.x,c.y-b.y)-220)<1e-6);
  }
  const reset=blend({...h,assemblyWork:1,assemblyPhase:3.1},{...h,assemblyWork:5,assemblyPhase:.1},.5);assert.equal(reset.assemblyPhase,.1);
});

test("damage immediately cuts welding, reports a fault and cannot rebuild the shell",()=>{
  const w=fixture();advance(w,1.4);const h=w.hazards[1],car=w.assembly.cars[2];assert.ok(welding(h,h.assemblyPhase));
  w.damageCover(carBody(w,car),20);advance(w,STEP);assert.equal(h.assemblyFault,'damaged');assert.equal(h.active,false);
  advance(w,1);assert.equal(car.stage,1);assert.ok(validSnapshot(w.snapshot()));
});

test("steam and active tools kill at contact while bypasses and distant belt riders remain safe",()=>{
  for(const station of [1,2,3]){
    const w=fixture();advance(w,1.4);const h=w.hazards[station-1],tip=robotPose(h,h.assemblyPhase)[2];
    Object.assign(w.players[0],{x:station===1?840:tip.x,y:station===1?1120:tip.y,rig:null});
    Object.assign(w.players[1],{x:h.x,y:700,rig:null});Object.assign(w.players[2],{x:950,y:1160,rig:null});
    advance(w,.7);assert.equal(w.players[0].alive,false,station);assert.equal(w.players[1].hp,100);assert.equal(w.players[2].hp,100);
    assert.ok(w.platforms.filter(p=>p.assemblyBelt).every(p=>!(p.charge>0)));
  }
});


test("black holes retain the appearance of captured cars and never respawn them",async()=>{
  const {blackholeField}=await import('../src/blackhole.js'),{updateFields}=await import('../src/specials.js');
  const w=fixture(),car=w.assembly.cars[3],b=carBody(w,car);
  const f=blackholeField(w,{x:b.x+b.w/2,y:b.y+b.h/2,owner:0});w.fields=[f];
  for(let t=0;t<.5;t+=STEP){w.time+=STEP;updateFields(w,STEP);}
  const wreck=w.wreckage.find(q=>q.sourceKind==='car'&&q.carPaint===b.carPaint);
  assert.ok(wreck);assert.equal(wreck.carStage,b.carStage);assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
  for(let t=0;t<5.5;t+=STEP){w.time+=STEP;updateFields(w,STEP);}
  const core=w.wreckage.find(q=>q.kind==='matter'),item=core.items.find(q=>q.sourceKind==='car'&&q.carPaint===b.carPaint);
  assert.ok(item);assert.equal(item.carStage,b.carStage);advance(w,.1);assert.equal(carBody(w,car),undefined);
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});

test("PHASER consumes car bodies without leaving collision or rebuilding them",()=>{
  const w=fixture(),car=w.assembly.cars[2],b=carBody(w,car),p=w.players[0];
  Object.assign(p,{x:b.x-100,y:b.y+30,rig:null,weapon:'phaser',ammo:2,aimAngle:0});
  w.attack(p);advance(w,.1);assert.equal(carBody(w,car),undefined);assert.equal(carTiles(w,car.id).length,0);assert.ok(validSnapshot(w.snapshot()));
});


test("interpolated assembly growth keeps the car bottom on the belt",()=>{
  for(const [before,after] of [[0,1],[1,2]]) {
    const oldHeight=before===0?32:70,newHeight=after===1?70:134;
    const a={kind:'car',carStage:before,x:100,y:1190-oldHeight,w:250,h:oldHeight};
    const b={...a,carStage:after,x:101,y:1190-newHeight,h:newHeight};
    for(const t of [0,.25,.5,.75,1]) {
      const view=blend(a,b,t);assert.equal(view.y+view.h,1190);assert.equal(view.x,100+t);
    }
  }
});
