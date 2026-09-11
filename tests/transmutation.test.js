import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, WEAPONS, cleanInput } from "../src/engine.js";
import { makeRig, JOINTS } from "../src/puppet.js";
import { combatFloor } from "./helpers.js";
import { validSnapshot } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { moveTransformed, TRANSMUTATION_WEAPONS } from "../src/transmutation.js";
import { WeaponRotation } from "../src/arsenal.js";
import { impactSpecial } from "../src/specials.js";
import { captureFighter } from "../src/singularity-body.js";
import { blackholeField } from "../src/blackhole.js";

function fixture() {
  const w = new World({players:[0,1,2,3],shuffle:false,random:()=>.4});
  combatFloor(w); w.phase="fight";w.arena={...w.arena,spikes:[]};
  w.players.forEach((p,i)=>{Object.assign(p,{x:500+i*250,y:535,ground:true,aimAngle:0});p.rig=makeRig(p);});
  return w;
}
function fire(w,type) {
  Object.assign(w.players[0],{weapon:type,ammo:WEAPONS[type].ammo,cooldown:0});w.attack(w.players[0]);
  return w.projectiles.at(-1);
}
function hit(w,type) {
  fire(w,type);for(let t=0;t<.5;t+=STEP)w.updateProjectiles(STEP);
  return w.players[1];
}
for(const [type,definition] of Object.entries(TRANSMUTATION_WEAPONS)) {
  test(`${type} transforms a living opponent, suppresses controls, recovers and resets`,()=>{
    const w=fixture(),q=hit(w,type),startHp=q.hp;
    assert.equal(q.morph,definition.kind);assert.ok(q.knockdown>0);assert.ok(startHp<100&&startHp>0);
    const wire=new RenderSnapshots();let previous=wire.make(w.snapshot());
    q.weapon="blaster";q.ammo=10;w.attack(q);assert.equal(q.ammo,10);
    impactSpecial(w,{kind:definition.kind,weapon:type},q,true);assert.equal(q.morphTime,1.6);
    w.platforms.push({id:"wall",x:1600,y:350,w:20,h:215,baseX:1600,baseY:350,dx:0,dy:0});
    for(let t=0;t<2.3;t+=STEP) {
      w.time+=STEP;w.move(q,cleanInput({right:true,jump:true,attack:true}),STEP);
      const next=wire.make(w.snapshot());assert.ok(validSnapshot(next),`${type} at ${t}`);
      assert.ok(validSnapshot(interpolateStates(previous,next,.5)));previous=next;
      assert.ok(q.rig.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    }
    assert.equal(q.alive,true);assert.equal(q.morph,null);assert.equal(q.knockdown,0);
    assert.equal(q.hp,startHp);w.startRound();assert.ok(w.players.every(p=>!p.morph&&p.morphTime===0));
  });
  test(`${type} is parried, stopped by cover, has a unique lethal effect and preserves ammo on throws`,()=>{
    const w=fixture(),q=w.players[1];q.block=true;q.blockTime=0;q.facing=-1;q.aimAngle=Math.PI;
    const b=fire(w,type);for(let t=0;t<.4&&b.owner===0;t+=STEP)w.updateProjectiles(STEP);
    assert.equal(b.owner,1);assert.equal(q.hp,100);assert.equal(q.morph,null);
    const blocked=fixture();blocked.platforms.push({id:"wall",x:630,y:400,w:20,h:165});
    hit(blocked,type);assert.equal(blocked.players[1].hp,100);
    const lethal=fixture();lethal.players[1].hp=20;hit(lethal,type);
    const rag=lethal.ragdolls[0];assert.equal(rag.effect,definition.kind);
    const initial=JSON.stringify(rag.points);const wire=new RenderSnapshots();
    for(let t=0;t<2;t+=STEP) {lethal.updateRagdolls(STEP);assert.ok(validSnapshot(wire.make(lethal.snapshot())));}
    assert.ok(rag.morphSplit);assert.notEqual(JSON.stringify(rag.points),initial);
    assert.ok(rag.points.every(p=>p.y<566),"pieces collide with the floor");
    for(let t=0;t<2.1;t+=STEP)lethal.updateRagdolls(STEP);assert.equal(lethal.ragdolls.length,0);
    const p=w.players[0];p.weapon=type;p.ammo=3;w.throwWeapon(p);assert.equal(w.drops.at(-1).ammo,3);
  });
}
test("jelly really rebounds, gold retains a rigid pose, and yarn draws the hands and feet together",()=>{
  const floor=[{id:"floor",x:0,y:100,w:1000,h:30}];
  const a=[{x:500,y:88,px:500,py:82}],b=structuredClone(a);
  moveTransformed(a,"jelly",0,floor,STEP,null,true);moveTransformed(b,"gold",0,floor,STEP,null,true);
  moveTransformed(a,"jelly",0,floor,STEP,null,true);moveTransformed(b,"gold",0,floor,STEP,null,true);
  assert.ok(a[0].y-a[0].py < -4,"rubber collision reverses normal velocity");
  const w=fixture(),q=hit(w,"midas"),rest=q.morphPose;
  for(let t=0;t<.4;t+=STEP)w.move(q,cleanInput({}),STEP);
  assert.ok(rest.every(([a,b,len])=>Math.abs(Math.hypot(q.rig[a].x-q.rig[b].x,q.rig[a].y-q.rig[b].y)-len)<5));
  const t=fixture(),p=hit(t,"tangle");for(let n=0;n<80;n++)t.move(p,cleanInput({}),STEP);
  for(const [a,b] of [[4,6],[8,10]])assert.ok(Math.hypot(p.rig[a].x-p.rig[b].x,p.rig[a].y-p.rig[b].y)<19);
});
test("new weapons enter the featured rotation and malformed transformation state is rejected",()=>{
  const bag=new WeaponRotation(()=>.4);const seen=new Set(Array.from({length:40},()=>bag.next()));
  for(const type of Object.keys(TRANSMUTATION_WEAPONS))assert.ok(seen.has(type));
  const w=fixture();fire(w,"midas");const wire=new RenderSnapshots();const state=wire.make(w.snapshot());
  assert.ok(validSnapshot(state));
  for(const patch of [s=>s.players[1].morph="bad",s=>s.players[1].morphTime=20,
    s=>s.players[1].morphAge=NaN,s=>s.projectiles[0].owner=5,s=>s.projectiles[0].kind="jelly",
    s=>s.projectiles[0].r=999,s=>s.projectiles[0].age=-1]) {
    const bad=structuredClone(state);patch(bad);assert.equal(validSnapshot(bad),false);
  }
});
test("ice replaces a transformation with a frozen pose and black holes retain their stretched-body capture",()=>{
  const w=fixture(),q=hit(w,"jelly");
  impactSpecial(w,{kind:"frost",chill:1.4},q,true);
  assert.equal(q.morph,null);assert.equal(q.knockdown,0);assert.ok(q.freeze>0);
  const pose=structuredClone(q.freezePose);w.move(q,cleanInput({right:true,jump:true}),STEP);
  assert.deepEqual(q.freezePose,pose);
  const other=fixture(),p=hit(other,"midas");const f=blackholeField(other,{x:1000,y:500,owner:0});other.fields=[f];
  captureFighter(p,f);assert.equal(p.morph,null);assert.equal(p.morphTime,0);assert.equal(p.strands.length,10);
  assert.ok(validSnapshot(new RenderSnapshots().make(other.snapshot())));
});
