import test from "node:test";
import assert from "node:assert/strict";
import {World,STEP,W,ARENAS} from "../src/engine.js";
import {NUCLEAR} from "../src/impact.js";
import {nuclearField,updateNuclear,carveRectangle} from "../src/nuclear.js";
import {updateFields} from "../src/specials.js";
import {RenderSnapshots,interpolateStates} from "../src/render-state.js";
import {validSnapshot} from "../src/network.js";
import {makeRig} from "../src/puppet.js";
import {combatFloor} from "./helpers.js";
const floor=(id,x,y,w,h=20)=>({id,x,y,w,h,baseX:x,baseY:y,dx:0,dy:0});
function world() {
  const w=new World({players:[0,1,2,3],shuffle:false});combatFloor(w);
  w.phase="fight";w.drops=[];w.hazards=[];w.cover=[];
  w.platforms=[floor("base",0,1200,W,30)];w.weaponTimer=999;
  for(const p of w.players){Object.assign(p,{x:400+p.id*500,y:1170,vx:0,vy:0,ground:true,support:"base"});p.rig=makeRig(p);}
  return w;
}
function detonate(w,x,y) {
  const p=w.players[0];p.weapon="nuke";p.ammo=1;w.attack(p);
  Object.assign(w.projectiles.at(-1),{x,y,vx:0,vy:0,life:.001});
  w.updateProjectiles(STEP);return w.fields.at(-1);
}
function advance(w,seconds){for(let n=0;n<Math.ceil(seconds/STEP);n++){w.time+=STEP;updateFields(w,STEP);w.updateRagdolls(STEP);}}

test("nuke is a 25% smaller circle: lethal through walls, owner included, no distant damage or afterstrikes",()=>{
  const w=world(),[owner,near,edge,outside]=w.players;
  Object.assign(owner,{x:800,y:600});Object.assign(near,{x:1000,y:600});
  Object.assign(edge,{x:1279,y:600});Object.assign(outside,{x:1281,y:600,vx:70,vy:0});
  for(const p of w.players)p.rig=makeRig(p);
  w.platforms.push(floor("wall",900,300,30,600));
  const f=detonate(w,800,600);advance(w,.3);
  assert.equal(NUCLEAR.coreRadius,640*.75);assert.equal(f.radius,NUCLEAR.coreRadius);
  assert.deepEqual(w.players.map(p=>p.alive),[false,false,false,true]);
  assert.equal(outside.hp,100);assert.equal(outside.vx,70);assert.equal(outside.vy,0);
  assert.equal(w.ragdolls.length,3);assert.ok(w.ragdolls.every(r=>r.ash&&r.life>2));
  advance(w,3.2);
  assert.equal(w.fields.length,0);assert.equal(w.events.filter(e=>e.type==="explosion").length,1);
  assert.equal(outside.hp,100);assert.equal(w.craters.length,1);
  assert.equal(w.craters[0].radius,480);assert.equal(w.ragdolls.length,0);
});

test("circle carves permanent floors, panels and tall walls while preserving the outside",()=>{
  const f={id:1,x:1000,y:700,radius:640};
  for(const s of [floor("wide",0,700,W),floor("wall",1000,0,30,1440),floor("edge",1600,600,150,300)]){
    const cut=carveRectangle(s,f);assert.notDeepEqual(cut,[s]);
    for(const p of cut){
      assert.ok(p.w>0&&p.h>0);
      const x=Math.max(p.x,Math.min(p.x+p.w,f.x)),y=Math.max(p.y,Math.min(p.y+p.h,f.y));
      assert.ok(Math.hypot(x-f.x,y-f.y)>=f.radius-.0001,"no collider remains inside the circle");
    }
    // Every sample more than eight units beyond the rim retains its surface.
    for(let y=s.y+.1;y<s.y+s.h;y+=13)for(let x=s.x+.1;x<s.x+s.w;x+=13){
      if(Math.hypot(x-f.x,y-f.y)<f.radius+8)continue;
      assert.ok(cut.some(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h),`missing exterior at ${x},${y}`);
    }
  }
  const distant=floor("safe",0,10,300);
  assert.equal(carveRectangle(distant,f)[0],distant);
});

test("melting removes hazards, props, pickups and live ordnance without remote chain explosions",()=>{
  const w=world();w.platforms.push({...floor("panel",650,600,250),destructible:true,panel:"wood",hp:100,maxHp:100});
  w.cover=[{id:"crate",x:650,y:530,w:70,h:70,hp:80,maxHp:80,kind:"crate"}];
  w.hazards=[{x:700,y:600,bodyX:700,bodyY:550},{x:2100,y:1200,bodyX:2100,bodyY:1170}];
  w.drops=[{x:750,y:590,type:"nuke",life:20},{x:2200,y:1100,type:"pistol",life:20}];
  const f=detonate(w,800,600);
  w.projectiles.push({x:850,y:600,kind:"grenade",nuclear:true,life:1},{x:2100,y:1100,kind:"rocket",life:1});
  const version=w.terrainVersion;advance(w,.3);
  assert.equal(f.melted,true);assert.ok(w.terrainVersion>version);
  assert.ok(!w.platforms.some(p=>p.id==="panel"));assert.equal(w.cover.length,0);
  assert.equal(w.hazards.length,1);assert.equal(w.hazards[0].x,2100);
  assert.deepEqual(w.drops.map(d=>d.type),["pistol"]);
  assert.deepEqual(w.projectiles.map(b=>b.kind),["rocket"]);
  assert.equal(w.craters.length,1);
});

test("cut elevators become fixed fragments; uncut elevators still move",()=>{
  const w=world(),far={...floor("far",2000,600,200),move:"y",travel:200,elevator:true};
  w.platforms=[{...floor("lift",0,600,W),move:"y",travel:200,elevator:true},far];
  detonate(w,900,600);advance(w,.3);
  assert.equal(w.platforms.find(p=>p.id==="far"),far);
  assert.ok(w.platforms.filter(p=>p!==far).every(p=>!p.move&&!p.elevator&&p.baseX===p.x&&p.baseY===p.y));
});

test("ash preserves momentum, falls immediately, crumbles away, and drops no weapon",()=>{
  const w=world(),p=w.players[0];p.weapon="rocket";p.ammo=3;
  Object.assign(p,{y:600,vx:240,vy:100});p.rig=makeRig(p);
  const pose=structuredClone(p.rig);w.kill(p,{ash:true,sourceX:p.x-100});
  assert.equal(w.drops.length,0);assert.equal(w.ragdolls[0].ashDirection,1);
  assert.deepEqual(w.ragdolls[0].points,pose);
  for(let n=0;n<30;n++)w.updateRagdolls(STEP);
  const center=pts=>pts.reduce((sum,p)=>sum+p.y,0)/pts.length;
  assert.ok(center(w.ragdolls[0].points)>center(pose)+30);
  assert.ok(w.ragdolls[0].points[2].x>pose[2].x+35);
  for(let n=0;n<300;n++)w.updateRagdolls(STEP);
  assert.equal(w.ragdolls.length,0);
});

test("cooled craters are traversable, remove spikes, persist for hot join and reset next round",()=>{
  const w=world();w.arena={...w.arena,spikes:[{x:0,y:700,w:W}]};
  const f=detonate(w,1000,700);advance(w,.4);
  const spikes=w.spikes();assert.ok(spikes.some(s=>s.x===0));
  assert.ok(!spikes.some(s=>s.x<1000&&s.x+s.w>1000));
  const survivor=w.players[3];Object.assign(survivor,{x:1000,y:700,hp:100,alive:true});
  advance(w,.5);assert.equal(survivor.hp,100);
  const wire=new RenderSnapshots();assert.ok(validSnapshot(wire.make(w.snapshot())));
  const guest=JSON.parse(JSON.stringify(wire.make(w.snapshot())));
  assert.equal(guest.craters[0].x,1000);assert.ok(Math.abs(guest.craters[0].y-f.y)<.1);assert.equal(guest.craters[0].radius,480);
  w.startRound();assert.equal(w.craters.length,0);assert.equal(w.craterSerial,0);
});

test("round scoring waits for the flash and ash to finish",()=>{
  const w=world();w.players.slice(0,3).forEach((p,i)=>{p.x=600+i*300;p.rig=makeRig(p);});detonate(w,900,1170);
  for(let n=0;n<Math.floor(3/STEP);n++)w.step(STEP);
  assert.deepEqual(w.scores,[0,0,0,0]);
  assert.ok(w.fields.length>0);
  for(let n=0;n<60;n++)w.step(STEP);
  assert.equal(w.phase,"result");assert.equal(w.fields.length,0);
});

test("online interpolation never drags surviving floors across a newly cut hole",()=>{
  const w=world(),wire=new RenderSnapshots(),a=wire.make(w.snapshot());
  detonate(w,900,1170);advance(w,.3);const b=wire.make(w.snapshot());
  assert.ok(validSnapshot(b));const mid=interpolateStates(a,b,.5);
  assert.deepEqual(mid.platforms,b.platforms);assert.deepEqual(mid.craters,b.craters);
  for(const change of [s=>s.craters[0].radius=641,s=>s.craters[0].born=Infinity,s=>s.ragdolls[0].ashAge=-1]){
    const bad=structuredClone(b);change(bad);assert.equal(validSnapshot(bad),false);
  }
});

test("every arena remains finite and guest-valid after repeated circular destruction",()=>{
  const wire=new RenderSnapshots();let peak=0;
  for(let arena=0;arena<ARENAS.length;arena++){
    const w=new World({players:[0,1,2,3],arena,shuffle:false,random:()=>.4});w.phase="fight";
    for(let n=0;n<10;n++){
      const f=nuclearField(w,{x:300+(n*397)%2100,y:200+(n*283)%1100,owner:0});w.fields=[f];
      w.time+=.3;updateNuclear(w,f,.3);w.updateRagdolls(.01);
      peak=Math.max(peak,w.platforms.length);
      assert.ok(validSnapshot(wire.make(w.snapshot())),`${w.arena.name}: ${w.platforms.length} fragments`);
    }
    assert.equal(new Set(w.platforms.map(p=>p.id)).size,w.platforms.length);
  }
  assert.ok(peak<300,`fragment count remains small: ${peak}`);
});
