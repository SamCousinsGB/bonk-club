import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, emptyInput } from "../src/engine.js";
import { makeRig } from "../src/puppet.js";
import { blackholeField, updateWreckage } from "../src/blackhole.js";
import { updateFields } from "../src/specials.js";
import { collectMatter, packMatter, MATTER_LIMIT } from "../src/accretion.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";

const appearance = { color: "#55baff", hair: "Ponytail", hairColor: "#dc7b3e",
  facialHair: "Full beard", accessory: "Glasses", facing: -1 };
function fixture() {
  const w = new World({ players: [0,1,2,3], shuffle: false, random: () => .4 });
  w.phase = "fight"; w.botIds.clear(); w.weaponTimer = 999;
  for (const key of ["platforms","cover","chunks","hazards","drops"]) w[key] = [];
  for (const p of w.players) place(p,1800 + p.id*140,500);
  return w;
}
function place(p,x,y) {
  Object.assign(p,{x,y,vx:0,vy:0,knockdown:0,ground:false,prone:false}); p.rig=makeRig(p);
}
function closedCore(w) {
  const f=blackholeField(w,{x:1000,y:800,owner:0});
  for(let i=0;i<12;i++) collectMatter(w,f,{x:1000,y:800,w:50,h:30},"debris");
  f.life=0;packMatter(f,0);w.wreckage.push(f.matter);w.wreckDirty=true;updateWreckage(w);
  return f.matter;
}
const headOf = c => c.items.find(q=>q.kind==="fighter");
const cosmetics = q => Object.fromEntries(Object.keys(appearance).map(k=>[k,q[k]]));

test("live capture preserves all head customisations through compression, transport and another black hole",async()=>{
  const w=fixture(),p=w.players[0],f=blackholeField(w,{x:1000,y:800,owner:1});
  Object.assign(p,appearance);place(p,1000,800);w.fields=[f];
  for(let t=0;t<5.6;t+=STEP)updateFields(w,STEP);
  const core=w.wreckage.find(q=>q.kind==="matter");
  assert.equal(p.alive,false);assert.deepEqual(cosmetics(headOf(core)),appearance);
  const wire=new RenderSnapshots(),a=wire.make(w.snapshot());
  const guest=expandSnapshot(await decodeState(await encodeState(compactSnapshot(a))),validSnapshot);
  assert.ok(validSnapshot(guest));assert.deepEqual(cosmetics(headOf(guest.wreckage[0])),appearance);
  Object.assign(p,{hair:"None",facialHair:"None",accessory:"None"});
  assert.deepEqual(cosmetics(headOf(core)),appearance,"later occupant changes cannot alter a collected head");
  const other=blackholeField(w,{x:core.x,y:core.y,owner:1});
  collectMatter(w,other,core,"debris");other.life=0;packMatter(other,0);
  assert.deepEqual(cosmetics(headOf(other.matter)),appearance);
  assert.deepEqual(other.matter.totals,core.totals);
  assert.ok(validSnapshot(interpolateStates(a,wire.make(w.snapshot()),.5)));
  w.startRound();assert.equal(w.wreckage.length,0);
});

test("captured corpses preserve their hair, beard, accessory and facing",()=>{
  const w=fixture(),p=w.players[0];Object.assign(p,appearance);place(p,1000,800);
  w.kill(p,{effect:"gib"});w.fields=[blackholeField(w,{x:1000,y:800,owner:1})];
  for(let t=0;t<5.6;t+=STEP)updateFields(w,STEP);
  const core=w.wreckage.find(q=>q.kind==="matter");
  assert.equal(core.totals[3],1);assert.deepEqual(cosmetics(headOf(core)),appearance);
});

test("all four customised heads remain inside a full core and survive the visual sample limit",()=>{
  const w=fixture(),f=blackholeField(w,{x:1000,y:800,owner:0});
  for(let i=0;i<400;i++)collectMatter(w,f,{x:1000,y:800,w:50,h:30},"debris");
  for(const p of w.players)collectMatter(w,f,{...p,...appearance},"fighter");
  f.life=0;packMatter(f,0);
  const heads=f.matter.items.filter(q=>q.kind==="fighter");
  assert.equal(heads.length,4);assert.equal(f.matter.items.length,MATTER_LIMIT);
  assert.equal(f.matter.totals[6],400);
  for(const q of heads) {
    assert.deepEqual(cosmetics(q),appearance);
    assert.ok(Math.hypot(q.x-f.x,q.y-f.y)+24<=f.matter.w/2);
  }
  assert.equal(new Set(heads.map(q=>`${q.x},${q.y}`)).size,4);
});

for(const direction of ["left","right","above","below","prone"]) test(`final sphere kills on ${direction} contact and retains the victim`,()=>{
  const w=fixture(),core=closedCore(w),p=w.players[0],r=core.w/2;
  Object.assign(p,appearance);
  const x=direction==="left"?core.x-r-15:direction==="right"?core.x+r+15:
    direction==="prone"?core.x-r-34:core.x;
  const y=direction==="above"?core.y-r-29:direction==="below"?core.y+r+27:core.y;
  place(p,x,y);p.prone=direction==="prone";p.rig=makeRig(p);
  Object.assign(p,{weapon:"rocket",ammo:3,block:true,invuln:10});
  w.step(STEP,{[p.id]:{...emptyInput(),duck:p.prone,block:true}});
  assert.equal(p.alive,false);assert.equal(p.hp,0);assert.equal(w.lastDeathCause,"singularity");
  assert.deepEqual(cosmetics(headOf(core)),appearance);
  assert.equal(core.totals[3],1);assert.equal(core.totals[4],1);
  assert.equal(w.ragdolls.length,0);
  w.step(STEP,{});assert.equal(core.totals[3],1,"contact cannot count the same victim twice");
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});

test("knocked-down fighters die when a limb touches, but empty body bounds and nearby corners stay safe",()=>{
  const w=fixture(),core=closedCore(w),p=w.players[0];
  place(p,core.x,core.y);p.knockdown=1;
  // Every actual limb stays above the sphere although the bounds enclose it.
  for(const q of p.rig)Object.assign(q,{x:core.x-100,y:core.y-100,px:core.x-100,py:core.y-100});
  Object.assign(p.rig[10],{x:core.x+100,px:core.x+100});
  updateWreckage(w);assert.equal(p.alive,true);
  Object.assign(p.rig[4],{x:core.x-core.w/2-3,px:core.x-core.w/2-3,y:core.y,py:core.y});
  updateWreckage(w);assert.equal(p.alive,false);
  const q=w.players[1];place(q,core.x+core.w/2+30,core.y-core.w/2-45);
  updateWreckage(w);assert.equal(q.alive,true);
});

test("only a completed, intact sphere kills and reset removes its lethal collision",()=>{
  const w=fixture(),core=closedCore(w),p=w.players[0];place(p,core.x,core.y);
  core.packing=.99;updateWreckage(w);assert.equal(p.alive,true);
  core.packing=1;core.hp=0;w.wreckDirty=true;updateWreckage(w);assert.equal(p.alive,true);
  assert.ok(!w.platforms.some(s=>s.wreckId===core.id));
  w.startRound();place(w.players[0],core.x,core.y);w.phase="fight";
  updateWreckage(w);assert.equal(w.players[0].alive,true);assert.equal(w.wreckage.length,0);
});

test("collected head wire data rejects unsupported, missing and oversized customisations",async()=>{
  const w=fixture(),core=closedCore(w),f={x:core.x,y:core.y,matter:core};
  collectMatter(w,f,{...w.players[0],...appearance},"fighter");
  const state=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(state));
  for(const [key,value] of [["hair","invalid"],["hairColor","#000000"],["facialHair","x".repeat(10000)],
    ["accessory",{}],["facing",0],["hair",undefined]]) {
    const bad=structuredClone(state);headOf(bad.wreckage[0])[key]=value;
    assert.equal(validSnapshot(bad),false,`${key} must be validated`);
    const bytes=await encodeState(compactSnapshot(bad));
    const received=await decodeState(bytes);
    assert.throws(()=>expandSnapshot(received,validSnapshot),/Invalid snapshot/);
  }
});
