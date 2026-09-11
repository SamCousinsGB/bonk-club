import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { RenderSnapshots } from "../src/render-state.js";
import { GuestPrediction } from "../src/guest-prediction.js";
import { validSnapshot } from "../src/network.js";
import { prepareProp } from "../src/props.js";

function fixture(weapon, extra={}) {
  const w=new World({players:[0,1],random:()=>.5});
  Object.assign(w,{phase:'fight',time:1,cover:[],chunks:[],hazards:[],drops:[],weaponTimer:999});
  w.platforms=[{id:'floor',x:0,y:500,w:2560,h:40,baseX:0,baseY:500,dx:0,dy:0}];
  w.spikes=()=>[];
  for(const p of w.players)Object.assign(p,{x:p.id===1?400:2000,y:470,vx:0,vy:0,ground:true,support:'floor',rig:null});
  Object.assign(w.players[1],{weapon,ammo:10,...extra});
  if(extra.carryId)w.cover=[prepareProp({id:extra.carryId,kind:'crate',x:425,y:420,w:40,h:40,hp:80,maxHp:80})];
  const encoder=new RenderSnapshots(), prediction=new GuestPrediction();
  const snapshot=(ack=0)=>({...encoder.make(w.snapshot()),inputAcks:[0,ack,0,0]});
  const s=snapshot();prediction.receive(s,1,1000);
  return {w,s,prediction,snapshot};
}

for(const [weapon,input,list,count] of [
  ['blaster',{attack:true},'projectiles',1],['shotgun',{block:true},'projectiles',10],
  ['nuke',{throw:true},'projectiles',1],['rocket',{throw:true},'drops',1],
  ['phaser',{attack:true},'fields',1],
]) test(`${weapon} responds before confirmation without changing host state`,()=>{
  const {w,s,prediction:p,snapshot}=fixture(weapon),saved=structuredClone(s),host=structuredClone(w.snapshot());
  p.advance(cleanInput({...input,aim:0}),1,1017);
  const view=p.sample(s,1020);
  assert.equal(view[list].length,count);
  assert.equal(view.players[1].weapon,list==='drops'?null:weapon);
  assert.equal(view.players[1].ammo,10,'ammunition display remains authoritative');
  assert.ok(view[list].every(b=>b.action===`${w.round}:${w.players[1].occupant}:1:1`));
  assert.deepEqual(s,saved);assert.deepEqual(w.snapshot(),host);
  assert.equal(p.context.projectiles.length,0);
  const events=p.weapons.takeEvents();assert.ok(events.some(e=>e.type==='shoot'||e.type==='throw'));
  p.sample(s,1025);w.time+=STEP;p.receive(snapshot(),1,1030);
  assert.equal(p.weapons.takeEvents().length,0,'replay/lookahead cannot repeat effects');
});

test('host confirmation replaces a preview once, while hit/removal and rejection clear it',()=>{
  const {w,s,prediction:p,snapshot}=fixture('blaster');
  const input=cleanInput({attack:true,aim:0});p.advance(input,1,1017);
  const preview=p.sample(s,1020).projectiles[0];
  w.step(STEP,{1:input});w.step(STEP,{1:input});
  const confirmed=snapshot(1);assert.equal(confirmed.projectiles[0].action,preview.action);
  p.receive(confirmed,1,1100);assert.equal(p.sample(confirmed,1105).projectiles.length,1);
  assert.equal(p.sample(s,1105).projectiles.length,1,'confirmation cannot create a gap before the buffered birth');
  const shot=confirmed.events.find(e=>e.type==='shoot');assert.equal(p.weapons.acceptEvent(shot),false);
  assert.equal(p.weapons.acceptEvent({...shot,action:'1:1:0:20'}),true);
  w.projectiles=[];w.time+=1/30;const hit=snapshot(1);p.receive(hit,1,1120);
  assert.equal(p.sample(hit,1121).projectiles.length,0);assert.equal(p.weapons.pending.size,0);
  assert.equal(p.sample(confirmed,1121).projectiles.length,0,'buffered state cannot resurrect an authoritative impact');
  const unrelated={...confirmed,drops:[{x:300,y:400,type:'rocket'}],projectiles:[{...preview,owner:0}]};
  assert.equal(p.sample(unrelated,1121).drops.length,1,'ownerless pickups remain visible');
  assert.equal(p.sample(unrelated,1121).projectiles.length,1,'a reflected shot belongs to its new owner');
  const rejected=fixture('blaster');rejected.prediction.advance(input,1,1017);
  rejected.w.time+=STEP;rejected.prediction.receive(rejected.snapshot(1),1,1040);
  assert.equal(rejected.prediction.weapons.pending.size,0);
});

test('PHASER authorization on the fast stream keeps its preview until the world field arrives',()=>{
  const {w,s,prediction:p,snapshot}=fixture('phaser');
  const input=cleanInput({attack:true,aim:0});p.advance(input,1,1017);
  w.step(STEP,{1:input});w.step(STEP,{1:input});
  const confirmed=snapshot(1),actors={...confirmed,fields:[]};
  p.receive(actors,1,1100);assert.equal(p.sample(s,1105).fields.length,1);
  w.time+=1/30;const world=snapshot(1);p.receive(world,1,1140);
  assert.equal(p.sample(s,1145).fields.length,1);
  w.fields=[];w.time+=1/30;p.receive(snapshot(1),1,1180);
  assert.equal(p.sample(world,1185).fields.length,0);
});

test('fresh authority with a slower input round trip keeps a bounded preview moving until acknowledgement',()=>{
  const {w,s,prediction:p,snapshot}=fixture('blaster');p.advance(cleanInput({attack:true,aim:0}),1,1017);
  const positions=[];
  for(const now of [1100,1200,1300,1400]){
    w.time+=.1;p.receive(snapshot(),1,now);positions.push(p.sample(s,now+1).projectiles[0].x);
  }
  assert.ok(positions.every((x,i)=>!i||x>positions[i-1]));
  w.time+=.1;p.receive(snapshot(1),1,1450);
  assert.equal(p.sample(s,1451).projectiles.length,0,'an applied rejection still clears immediately');
});

test('denied actions, reflections, round changes and stale connections cannot retain previews',()=>{
  for(const [weapon,extra] of [['blaster',{ammo:0}],['blaster',{cooldown:1}],['machinegun',{prone:false}],
    ['blaster',{freeze:1}],['blaster',{knockdown:1}],['blaster',{carryId:'crate'}]]) {
    const {s,prediction:p}=fixture(weapon,extra);p.advance(cleanInput({attack:true,aim:0}),1,1017);
    assert.equal(p.sample(s,1020).projectiles.length,0,JSON.stringify(extra));
  }
  for(const change of ['reflect','round','stale']) {
    const {w,s,prediction:p,snapshot}=fixture('blaster');p.advance(cleanInput({attack:true,aim:0}),1,1017);
    const shot=p.sample(s,1020).projectiles[0];
    if(change==='stale'){assert.equal(p.sample(s,1400).projectiles.length,0);continue;}
    if(change==='round')w.round++;
    else w.projectiles=[{...shot,owner:0,vx:-shot.vx}];
    w.time+=STEP;const next=snapshot(1);p.receive(next,1,1040);
    assert.equal(p.weapons.pending.size,0);
  }
});

test('preview contact has no damage and malformed action metadata is rejected',()=>{
  const {w,snapshot,prediction:p}=fixture('blaster');
  w.platforms.push({id:'wall',x:470,y:380,w:20,h:120,baseX:470,baseY:380,dx:0,dy:0});w.time+=STEP;const s=snapshot();p.receive(s,1,1001);
  p.advance(cleanInput({attack:true,aim:0}),1,1017);
  const view=p.sample(s,1100);assert.ok(view.projectiles[0].x<=470);
  assert.equal(w.players[0].hp,100);assert.equal(w.platforms.length,2);
  assert.ok(validSnapshot(s));
  for(const action of [null,{},'x'.repeat(10000),'1:1:4:1','1:1:1:9007199254740993']) {
    const bad=structuredClone(s);bad.events=[{id:1,type:'shoot',action}];assert.equal(validSnapshot(bad),false);
  }
  const bad=structuredClone(s);bad.players[1].actionSerial=-1;assert.equal(validSnapshot(bad),false);
});
