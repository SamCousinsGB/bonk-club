import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP,cleanInput} from '../src/engine.js';
import {SPILLS} from '../src/barrels.js';
import {swimPlayer,swimmingWaterAt} from '../src/ship.js';
import {refineryLiquids} from '../src/refinery.js';
import {updateReactions} from '../src/reactions.js';
import {GuestPrediction} from '../src/guest-prediction.js';
import {RenderSnapshots} from '../src/render-state.js';
import {validSnapshot} from '../src/network.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
import {fighterStatuses} from '../src/status-effects.js';

function fixture(kind){
  const w=new World({arena:0,players:[0,1],shuffle:false,random:()=>.4});w.phase='fight';
  Object.assign(w,{platforms:[{id:'pool-floor',x:0,y:1100,w:2560,h:20,material:'stone',baseX:0,baseY:1100,dx:0,dy:0}],cover:[],chunks:[],hazards:[],water:[],spills:[]});
  const q={id:++w.reactionSerial,x:800,y:850,w:32,h:250,vx:25,vy:0,grounded:true,spark:0,charge:0,fallDistance:0};
  if(kind==='water'){q.frozen=0;w.water.push(q);}else w.spills.push({...q,kind,life:SPILLS[kind].life,fire:0,cold:0});
  Object.assign(w.players[0],{x:816,y:1010,rig:null,vx:0,vy:0,ground:false,oxygen:12,invuln:0});return w;
}
for(const kind of ['water',...Object.keys(SPILLS)])test(`${kind} supports swimming, head-based breath and unchanged guest-owned state`,()=>{
  const w=fixture(kind),p=w.players[0],input=cleanInput({attack:true,aim:-Math.PI/2});
  const snap=new RenderSnapshots().make(w.snapshot());snap.inputAcks=[0,0,0,0];
  const copy=expandSnapshot(compactSnapshot(snap),validSnapshot);assert.ok(validSnapshot(copy));
  const saved=structuredClone(copy),guest=new GuestPrediction();guest.receive(copy,0,1000);guest.advance(input,1,1017);
  for(let n=0;n<2;n++){w.move(p,input,STEP);if(p.cooldown<=0)w.attack(p);}
  assert.ok(p.swimming&&p.submerged&&p.swimStroke&&p.vy<0);assert.ok(p.oxygen<12);
  assert.ok(Math.abs(p.x-guest.player.x)<.05&&Math.abs(p.y-guest.player.y)<.05,JSON.stringify({host:[p.x,p.y,p.vx,p.vy],guest:[guest.player.x,guest.player.y,guest.player.vx,guest.player.vy]}));
  assert.equal(guest.player.oxygen,12);assert.equal(guest.player.hp,100);assert.deepEqual(copy,saved);
  Object.assign(p,{x:816,y:950,rig:null});swimPlayer(w,p,{},12);assert.equal(p.oxygen,0);assert.ok(!p.alive);
  const air=fixture(kind),a=air.players[0];Object.assign(a,{y:885,oxygen:3});swimPlayer(air,a,{attack:true},.1);
  assert.ok(a.swimming&&!a.submerged&&a.oxygen>3);a.x=1200;swimPlayer(air,a,{},.1);
  assert.ok(!a.swimming&&!a.submerged&&!a.swimStroke);
});
test('shallow films and frozen water do not enable swimming; head contact still uses actual geometry',()=>{
  const w=fixture('water'),p=w.players[0];w.water[0].frozen=2;swimPlayer(w,p,{},.1);assert.ok(!p.swimming&&!p.submerged);
  Object.assign(w.water[0],{frozen:0,y:1095,h:5});p.y=1080;swimPlayer(w,p,{},.1);assert.ok(!p.swimming&&!p.submerged);
  assert.equal(swimmingWaterAt(w,790,1097),null);
});
test('swimming preserves burning fuel and material hazards, while water and coolant extinguish',()=>{
  for(const kind of ['water','coolant','oil','petrol','tar','acid','glue']){
    const w=fixture(kind),p=w.players[0];p.burn=3;swimPlayer(w,p,{},.05);
    assert.equal(p.burn,['water','coolant'].includes(kind)?0:3,kind);
  }
  for(const kind of ['acid','molten','oil']){
    const w=fixture(kind),p=w.players[0];if(kind==='oil')w.spills[0].fire=7;
    swimPlayer(w,p,{},.05);updateReactions(w,.05);
    assert.ok(kind==='oil'?p.burn>0:!p.alive||p.hp<100,kind);
  }
  const w=fixture('oil'),p=w.players[0];p.soaked=2;swimPlayer(w,p,{},.05);
  assert.equal(fighterStatuses(w,p).find(s=>s.id==='wet').seconds,2);
  assert.ok(fighterStatuses(w,p).some(s=>s.id==='air'));
});
test('refinery vessel contents support shared swimming and reset restores breath',()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.refinery),players:[0,1],shuffle:false});w.phase='fight';
  const q=refineryLiquids(w.refinery)[0],p=w.players[0];Object.assign(p,{x:q.x+50,y:q.y+85,rig:null});
  swimPlayer(w,p,{attack:true,aim:-Math.PI/2},.05);assert.ok(p.swimming&&p.submerged&&p.oxygen<12);
  const s=new RenderSnapshots().make(w.snapshot());s.inputAcks=[0,0,0,0];const guest=new GuestPrediction();guest.receive(s,0,1000);guest.step({attack:true,aim:-Math.PI/2});assert.ok(guest.player.swimming);
  w.startRound();assert.equal(w.players[0].oxygen,12);assert.ok(!w.players[0].swimming&&!w.players[0].submerged);
});
