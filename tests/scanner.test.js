import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP } from "../src/engine.js";
import { createHazards, updateHazards } from "../src/hazards.js";
import { scannerFlicker } from "../src/scanner.js";
import { drawStatus } from "../src/death-art.js";
import { drawHazards } from "../src/trap-art.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { encodeState, decodeState, validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { combatFloor } from "./helpers.js";
import { makeRig } from "../src/puppet.js";

function lab(type="xray") {
  const w=new World({shuffle:false,random:()=>.5});combatFloor(w);w.phase="fight";w.botIds.clear();
  w.arena={...w.arena,traps:[{type,x:650,y:565,w:160,h:190,dir:1}]};
  w.hazards=createHazards(w);const h=w.hazards[0];h.active=true;h.duration=1.35;
  const p=w.players[0];Object.assign(p,{x:650,y:535,ground:true,vx:120,vy:0,weapon:null});p.rig=makeRig(p);
  Object.assign(w.players[1],{x:1500,y:535,ground:true});
  return {w,h,p};
}
const advance=(w,n)=>{for(let i=0;i<n;i++){w.time+=STEP;updateHazards(w,STEP);}};

for(const type of ["xray","magnet"]) test(`${type} gently scans through the whole active pass without interrupting movement`,()=>{
  const {w,h,p}=lab(type);const vx=p.vx,vy=p.vy,stun=p.stun;
  advance(w,1);assert.equal(p.hp,99);assert.equal(p.xrayType,"scanner");assert.equal(p.xray,.12);
  advance(w,Math.ceil(.4/STEP));assert.equal(p.hp,99);assert.equal(p.vx,vx);assert.equal(p.vy,vy);assert.equal(p.stun,stun);
  assert.equal(w.hitstop,0);assert.equal(p.flash,0);assert.equal(w.players[1].hp,100);
  advance(w,Math.ceil(.5/STEP));assert.equal(p.hp,98);assert.equal(p.xray,.12);
  advance(w,Math.ceil(.5/STEP));assert.equal(h.active,false);assert.equal(p.hp,98);
});

test("scanning respects walls, dead fighters, inactive fixtures and missing mountings",()=>{
  for(const mode of ["wall","dead","inactive","destroyed","mounting"]){
    const {w,h,p}=lab();
    if(mode==="wall"){p.x=700;w.platforms.push({id:"shield",x:670,y:370,w:12,h:195});}
    if(mode==="dead")p.alive=false;
    if(mode==="inactive"){h.active=false;h.warning=.8;}
    if(mode==="destroyed")h.done=true;
    if(mode==="mounting")w.platforms[0].hp=0;
    advance(w,1);assert.equal(p.hp,100,mode);assert.equal(p.xray,0,mode);
  }
});

test("scanner exposure ends on leaving, is restored on re-entry and resets next round",()=>{
  const {w,p}=lab();advance(w,1);p.x=900;
  for(let i=0;i<Math.ceil(.2/STEP);i++)w.step(STEP,{});
  assert.equal(p.xray,0);assert.equal(p.hp,99);
  p.x=650;p.y=535;p.vx=0;advance(w,1);assert.ok(p.xray>0);assert.equal(p.hp,99);
  w.startRound();assert.ok(w.players.every(p=>p.hp===100&&p.xray===0&&p.xrayType===null));
});

test("scanner does not overwrite an electrical weapon effect; its last HP preserves the death cause",()=>{
  const {w,p}=lab();p.xray=.3;p.xrayType="phaser";advance(w,1);
  assert.equal(p.xrayType,"phaser");assert.equal(p.xray,.3);
  const fatal=lab();fatal.p.hp=1;advance(fatal.w,1);
  assert.equal(fatal.p.alive,false);assert.equal(fatal.p.hp,0);assert.equal(fatal.w.lastDeathCause,"xray");
  assert.equal(fatal.w.ragdolls.length,1);
});

test("scanner status and flicker survive encoded guest snapshots, interpolation and hot join",async()=>{
  const {w,p}=lab(),snapshots=new RenderSnapshots();advance(w,1);
  const before=snapshots.make(w.snapshot());advance(w,3);
  const after=snapshots.make(w.snapshot());
  const wire=expandSnapshot(await decodeState(await encodeState(compactSnapshot(after))),validSnapshot);
  assert.ok(validSnapshot(wire));
  for(const s of [wire,interpolateStates(before,wire,.5)]){
    assert.equal(s.players[0].xrayType,"scanner");assert.ok(s.players[0].xray>0);assert.equal(s.players[0].hp,99);
    assert.equal(scannerFlicker(s.time,p.id),scannerFlicker(s.time,s.players[0].id));
  }
});

function artRecorder() {
  const calls=[];
  const c=new Proxy({globalAlpha:1,fillStyle:""},{get(target,key){
    if(key in target)return target[key];
    if(key==="createLinearGradient")return ()=>({addColorStop(){}});
    return (...args)=>calls.push([key,target.fillStyle,...args]);
  }});
  return {c,calls};
}

test("both scanner types layer only the front post over a passing body and keep complete break artwork",()=>{
  for(const type of ["xray","magnet"]){
    const {h}=lab(type),{c,calls}=artRecorder();
    drawHazards(c,[h],0,"hospital","back");const middle=calls.length;
    drawHazards(c,[h],0,"hospital","front");
    const postX=list=>list.filter(a=>a[0]==="fillRect"&&a[1]==="#d3ded5").map(a=>a[2]);
    assert.deepEqual(postX(calls.slice(0,middle)),[570]);assert.deepEqual(postX(calls.slice(middle)),[712]);
    calls.length=0;drawHazards(c,[h],0,"hospital");assert.deepEqual(postX(calls),[570,712]);
    calls.length=0;h.done=true;for(const layer of ["back","front","all"])drawHazards(c,[h],0,"hospital",layer);
    assert.equal(calls.length,0);
  }
});

test("scanner skeleton has visible and clear frames; reduced effects gives a steady faint exposure",()=>{
  const {p}=lab();p.xray=.12;p.xrayType="scanner";
  const {c,calls}=artRecorder(),r={ctx:c,line:()=>calls.push(["bone"]),circle:()=>calls.push(["joint"]),reduced:false};
  drawStatus(r,p,0);assert.ok(calls.some(a=>a[0]==="bone"));
  calls.length=0;drawStatus(r,p,.2);assert.equal(calls.length,0);
  r.reduced=true;drawStatus(r,p,.2);assert.ok(calls.some(a=>a[0]==="bone"));
  calls.length=0;p.xray=0;drawStatus(r,p,0);assert.equal(calls.length,0);
});
