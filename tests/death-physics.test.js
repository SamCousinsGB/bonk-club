import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP } from "../src/engine.js";
import { makeRig, JOINTS } from "../src/puppet.js";
import { deathJoints, deathSegments } from "../src/death-effects.js";
import { nuclearField, updateNuclear } from "../src/nuclear.js";
import { validSnapshot } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { combatFloor } from "./helpers.js";

const effects = [null, "burn", "plasma", "tesla", "phaser", "ice", "blast", "slice", "gib"];
function fixture(effect, { x = 500, y = 400, vx = 240, vy = 120 } = {}) {
  const w = new World({ players: [0,1,2,3], shuffle: false });
  combatFloor(w); w.phase = "fight"; w.cover = []; w.hazards = [];
  w.platforms = []; w.drops = []; w.weaponTimer = 999;
  const p = w.players[0]; Object.assign(p,{x,y,vx,vy}); p.rig = makeRig(p);
  const pose = structuredClone(p.rig);
  w.kill(p,{ effect, ash: effect === null || ["burn","plasma","tesla","phaser"].includes(effect) });
  return { w, rag: w.ragdolls[0], pose };
}
function advance(w, seconds) {
  for(let n=0;n<Math.ceil(seconds/STEP);n++) { w.time += STEP; w.updateRagdolls(STEP); }
}
const center = points => points.reduce((s,p)=>({x:s.x+p.x/points.length,y:s.y+p.y/points.length}),{x:0,y:0});
const solid = (id,x,y,w,h) => ({id,x,y,w,h,baseX:x,baseY:y,dx:0,dy:0});

test("nuclear, charred, energy, frozen and violent deaths retain motion from the first tick",()=>{
  for(const effect of effects) {
    const {w,rag,pose}=fixture(effect);
    if(!["blast","slice","gib"].includes(effect)) assert.deepEqual(rag.points,pose,effect);
    const before=center(rag.points); advance(w,.25); const after=center(rag.points);
    assert.ok(after.x>before.x+20,`${effect}: horizontal momentum continues`);
    assert.ok(after.y>before.y+30,`${effect}: gravity acts during the effect`);
    assert.ok(rag.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  }
});

test("dead bodies and crumbled pieces collide with walls and thin floors",()=>{
  for(const effect of effects) {
    const {w,rag}=fixture(effect,{vx:900,vy:350});
    w.platforms=[solid("wall",600,0,12,900),solid("floor",0,600,1600,12)];
    advance(w,1.25);
    assert.ok(rag.points.every(p=>p.x<=597.01),`${effect}: wall blocks all pieces`);
    assert.ok(rag.points.every(p=>p.y<=597.01),`${effect}: thin floor catches all pieces`);
    assert.ok(rag.points.some(p=>p.y>580),`${effect}: remains reach the floor`);
  }
});

test("nuclear and burned skeletons shed joints without stretching detached bone art",()=>{
  for(const effect of [null,"burn","plasma","tesla","phaser"]) {
    const {w,rag}=fixture(effect);
    assert.equal(deathJoints(rag).length,10);
    advance(w,effect==="burn"?1:.8);
    assert.ok(deathJoints(rag).length>0&&deathJoints(rag).length<10);
    advance(w,.5);assert.equal(deathJoints(rag).length,0);
    const before=center(rag.points);advance(w,.1);
    assert.ok(center(rag.points).y>before.y);
    assert.ok(deathSegments(rag).every(([a,b])=>Math.hypot(a.x-b.x,a.y-b.y)<=6.01));
  }
});

test("ice retains a rigid moving pose until it breaks into falling physical shards",()=>{
  const {w,rag,pose}=fixture("ice");advance(w,.3);
  for(const [a,b] of JOINTS)
    assert.ok(Math.abs(Math.hypot(rag.points[a].x-rag.points[b].x,rag.points[a].y-rag.points[b].y)-
      Math.hypot(pose[a].x-pose[b].x,pose[a].y-pose[b].y))<.1);
  advance(w,.15);assert.equal(deathJoints(rag).length,0);
  const before=center(rag.points);advance(w,.2);assert.ok(center(rag.points).y>before.y+30);
});

test("nuclear heat releases existing deaths without resetting their velocity",()=>{
  for(const effect of ["burn","ice","slice","gib"]) {
    const {w,rag}=fixture(effect);advance(w,.15);
    const velocities=rag.points.slice(0,11).map(p=>[p.x-p.px,p.y-p.py]);
    const f=nuclearField(w,{...center(rag.points),owner:0});updateNuclear(w,f,.15);
    assert.equal(rag.ash,true);assert.equal(rag.effect,undefined);
    assert.deepEqual(rag.points.map(p=>[p.x-p.px,p.y-p.py]),velocities);
    const before=center(rag.points);advance(w,.1);assert.ok(center(rag.points).y>before.y);
  }
});

test("moving remains transfer impact momentum through solid contacts",()=>{
  const {w}=fixture("burn",{vx:900,vy:0}); let impulse=0;
  w.solids=()=>[{...solid("crate",570,0,30,900),onContact:(x,y,ix,iy)=>{impulse+=Math.hypot(ix,iy);}}];
  advance(w,.2);assert.ok(impulse>100);
});

test("falling and crumbling deaths interpolate, validate for hot join, expire and reset",()=>{
  for(const effect of effects) {
    const {w,rag}=fixture(effect);const wire=new RenderSnapshots();advance(w,.2);
    const a=wire.make(w.snapshot());advance(w,.15);const b=wire.make(w.snapshot());
    assert.ok(validSnapshot(a),`${effect}: initial`);assert.ok(validSnapshot(b),`${effect}: moving`);
    const mid=interpolateStates(a,b,.5).ragdolls[0];
    assert.equal(mid.netId,a.ragdolls[0].netId);
    assert.ok(mid.points[2].y>a.ragdolls[0].points[2].y&&mid.points[2].y<b.ragdolls[0].points[2].y);
    advance(w,.9);const hot=JSON.parse(JSON.stringify(wire.make(w.snapshot())));
    assert.ok(validSnapshot(hot),`${effect}: crumbled hot join`);
    if(rag.ash)assert.equal(deathJoints(hot.ragdolls[0]).length,deathJoints(rag).length);
    const bad=structuredClone(hot);bad.ragdolls[0].points[0].x=Infinity;assert.equal(validSnapshot(bad),false);
    advance(w,5);assert.equal(w.ragdolls.length,0);w.startRound();assert.equal(w.ragdolls.length,0);
  }
});
