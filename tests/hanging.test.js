import test from "node:test";
import assert from "node:assert/strict";
import {World, ARENAS, STEP, cleanInput} from "../src/engine.js";
import {JOINTS, updateRig} from "../src/puppet.js";
import {RenderSnapshots, interpolateStates} from "../src/render-state.js";
import {GuestPrediction} from "../src/guest-prediction.js";
import {validSnapshot, encodeState, decodeState} from "../src/network.js";
import {compactSnapshot, expandSnapshot} from "../src/snapshot-wire.js";
import {carveExplosion} from "../src/terrain.js";
import {knockDown} from "../src/knockdown.js";

function fixture() {
  const w = new World({arena:ARENAS.findIndex(a=>a.theme==="railway"), players:[0], shuffle:false, random:()=>.4});
  w.phase="fight";w.cover=[];w.hazards=[];w.drops=[];
  const p=w.players[0], deck=w.platforms.find(s=>s.oneWay&&s.x===750);
  Object.assign(p,{x:870,y:deck.y-30,vx:0,vy:0,ground:true,support:deck.id,rig:null});
  const advance=(n,input={})=>{
    for(let i=0;i<n;i++){w.time+=STEP;w.move(p,cleanInput(input),STEP);updateRig(p,STEP,w.solids(p),w.time);}
  };
  advance(30);
  return {w,p,deck,advance};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test("hanging starts from the walking pose and falls continuously into a grip",()=>{
  const {p,deck,advance}=fixture(), before=structuredClone(p);
  advance(1,{duck:true});
  assert.equal(p.hangSupport,deck.id);
  assert.ok(distance(p,before)<4,"no instantaneous relocation below the platform");
  assert.ok(p.rig.every((q,i)=>distance(q,before.rig[i])<7),"no snapping limbs");
  let maxStep=0, old=structuredClone(p);
  for(let i=0;i<120;i++){
    advance(1,{duck:true});maxStep=Math.max(maxStep,distance(old,p));old=structuredClone(p);
    assert.ok(p.rig.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)));
  }
  assert.ok(maxStep<9);
  assert.ok(p.y>deck.y+45&&p.y<deck.y+80);
  for(const i of [4,6])assert.ok(Math.abs(p.rig[i].y-deck.y-deck.h)<.001);
  assert.ok(JOINTS.every(([a,b,len])=>Math.abs(distance(p.rig[a],p.rig[b])-len)<1));
});

test("shimmying pulls the hands and leaves the torso and feet swinging after release",()=>{
  const {p,advance}=fixture();advance(180,{duck:true});advance(55,{right:true});
  for(let i=0;i<120&&p.hangMotion.moving!==-1;i++)advance(1);
  assert.equal(p.hangMotion.moving,-1);advance(2);
  const grip=p.hangX, x=[], leg=[];
  for(let i=0;i<240;i++){
    advance(1);x.push(p.rig[2].x-grip);leg.push(p.rig[8].x-p.rig[2].x);
    assert.ok([4,6].every(i=>Math.abs(Math.abs(p.rig[i].x-grip)-13)<4));
  }
  assert.ok(Math.min(...x)<-5&&Math.max(...x)>5,"body swings through the grip");
  assert.ok(Math.min(...leg)<-10&&Math.max(...leg)>10,"legs lag and swing relative to the torso");
  assert.ok(Math.abs(p.bodyAngle-Math.atan2(p.rig[1].x-p.rig[2].x,p.rig[2].y-p.rig[1].y))<.001);
});

test("an individual foot impulse bends its knee without imposing a matching leg pose",()=>{
  const {p,advance}=fixture();advance(200,{duck:true});
  p.rig[8].px-=Math.sign(p.rig[8].x-p.rig[10].x)*3;p.rig[8].py+=2;
  advance(12);
  assert.ok(distance(p.rig[8],p.rig[10])>10);
  const legLength=distance(p.rig[2],p.rig[8]);
  assert.ok(legLength<35,"the knee bends instead of keeping a rigid straight leg");
  assert.ok(Math.abs(p.x-p.rig[2].x)<.001,"gameplay position follows the physical hips");
});

test("hanging limbs collide with solid scenery while hands follow a moving support",()=>{
  const {w,p,deck,advance}=fixture();advance(150,{duck:true});
  const wall={id:"hang-wall",x:905,y:deck.y+20,w:100,h:160,hp:100,material:"metal"};
  w.platforms.push(wall);
  for(let i=0;i<90;i++){
    deck.x+=.2;deck.dx=.2;deck.y+=.15;deck.dy=.15;advance(1,{right:true});
    assert.ok(p.rig.slice(7).every(q=>q.x<=wall.x-2.9||q.y<wall.y-3),"loose legs cannot pass through a wall");
  }
  assert.ok(p.hangX>=887&&p.hangX<915,"the moving deck carries the planted hand up to the obstruction");
  assert.ok([4,6].some(i=>Math.abs(p.rig[i].y-deck.y-deck.h)<.01));
});

test("the fighter sits with bent knees before releasing the hips into the drop",()=>{
  const {p,deck,advance}=fixture();
  advance(36,{duck:true});
  const seated=p.rig[2].y;
  assert.ok(Math.abs(seated-(deck.y-5))<3,"hips rest on the platform");
  assert.ok(p.rig[0].y<deck.y-30&&p.rig[8].y>deck.y+10);
  assert.ok(distance(p.rig[2],p.rig[8])<35,"legs bend over the edge");
  advance(24,{duck:true});
  assert.ok(Math.abs(p.rig[2].y-seated)<2,"brief seated pause");
  advance(70,{duck:true});
  assert.ok(p.rig[2].y>deck.y+40,"the body then drops below the grip");
});

test("both directions alternate hands while each supporting grip stays fixed",()=>{
  for(const dir of [-1,1]){
    const {p,deck,advance}=fixture();advance(160,{duck:true});
    const start=p.x,sequence=[];let previous=-1,airborneReach=false;
    for(let i=0;i<150;i++){
      advance(1,{left:dir<0,right:dir>0});
      const s=p.hangMotion;
      if(s.moving===-1)continue;
      if(s.moving!==previous){sequence.push(s.moving);previous=s.moving;}
      const held=s.moving===0?6:4,offset=s.moving===0?s.right:s.left;
      assert.ok(Math.abs(p.rig[held].x-deck.x-offset)<.001);
      assert.ok(Math.abs(p.rig[held].y-deck.y-deck.h)<.001);
      airborneReach ||= p.rig[s.moving===0?4:6].y>deck.y+deck.h+8;
    }
    assert.ok(sequence.length>=3&&sequence.every((hand,i)=>!i||hand!==sequence[i-1]));
    assert.ok((p.x-start)*dir>50&&airborneReach);
    advance(90,{left:dir>0,right:dir<0});
    assert.ok(p.hangMotion.moving!==-1,"reversal starts a new reach");
  }
});

test("a blocked reaching hand returns to its grip when movement stops",()=>{
  const {w,p,deck,advance}=fixture();advance(170,{duck:true});
  w.platforms.push({id:"hand-obstruction",x:890,y:deck.y+14,w:100,h:120,hp:100,material:"metal"});
  advance(90,{right:true});assert.notEqual(p.hangMotion.moving,-1);
  advance(120);assert.equal(p.hangMotion.moving,-1);
  assert.ok([4,6].every(i=>Math.abs(p.rig[i].y-deck.y-deck.h)<.01));
});

test("reaching the end of a deck leaves two distinct grips on the surviving support",()=>{
  for(const dir of [-1,1]){
    const {p,deck,advance}=fixture();advance(170,{duck:true});
    advance(360,{left:dir<0,right:dir>0});
    assert.equal(p.hangMotion.moving,-1);
    assert.ok(Math.abs(p.hangMotion.left-p.hangMotion.right)>6);
    assert.ok([4,6].every(i=>p.rig[i].x>=deck.x&&p.rig[i].x<=deck.x+deck.w));
  }
});

test("late joins during the seated pause and a reaching hand resume without mutating received state",async()=>{
  for(const stage of ["sit","reach"]){
    const {w,p,advance}=fixture();advance(stage==="sit"?42:170,{duck:true});
    if(stage==="reach")advance(14,{right:true});
    const state={...new RenderSnapshots().make(w.snapshot()),inputAcks:[0,0,0,0]};
    const joined=expandSnapshot(await decodeState(await encodeState(compactSnapshot(state))),validSnapshot);
    const original=structuredClone(joined),prediction=new GuestPrediction();
    prediction.receive(joined,0,1000);
    for(let i=1;i<=9;i++){
      const input=stage==="reach"?{right:true}:{};
      advance(2,input);prediction.advance(cleanInput(input),i,1000+i*1000/60);
    }
    assert.deepEqual(joined,original,"prediction owns a copy of grip and reach state");
    assert.ok(distance(prediction.player,p)<1,stage);
    assert.ok(p.rig.every((q,i)=>distance(q,prediction.player.rig[i])<1),stage);
  }
});

test("letting go retains swing momentum and broken supports, hits, death and reset release the hands",()=>{
  const f=fixture();f.advance(150,{duck:true});f.advance(45,{right:true});
  const vx=f.p.vx, before=structuredClone(f.p);
  f.advance(1,{duck:true});
  assert.equal(f.p.hangSupport,null);assert.ok(f.p.vx*vx>0&&Math.abs(f.p.vx)>20);
  assert.ok(distance(f.p,before)<25);
  for(const kind of ["break","hit","knockdown","death","reset"]){
    const {w,p,deck,advance}=fixture();advance(120,{duck:true});
    if(kind==="break")carveExplosion(w,{x:p.hangX,y:deck.y,radius:85});
    if(kind==="hit")w.hit(p,5,240,100,1);
    if(kind==="knockdown")knockDown(p,"hammer");
    if(kind==="death")w.kill(p);
    if(kind==="reset")w.startRound();
    advance(1);
    assert.equal(w.players[0].hangSupport,null,kind);
  }
});

test("compact late joins preserve independent limb velocities and predict the same swinging body",async()=>{
  const {w,p,advance}=fixture();advance(140,{duck:true});advance(40,{right:true});
  const encoder=new RenderSnapshots();
  const state={...encoder.make(w.snapshot()),inputAcks:[0,0,0,0]};
  const joined=expandSnapshot(await decodeState(await encodeState(compactSnapshot(state))),validSnapshot);
  assert.ok(validSnapshot(joined));
  assert.deepEqual(joined.players[0].motion.hangVelocity,state.players[0].motion.hangVelocity);
  const prediction=new GuestPrediction();prediction.receive(joined,0,1000);
  for(let n=1;n<=10;n++){advance(2);prediction.advance(cleanInput({}),n,1000+n*1000/60);}
  assert.ok(distance(prediction.player,p)<1);
  assert.ok(p.rig.every((q,i)=>distance(q,prediction.player.rig[i])<1),"late join preserves leg motion");
  const next=encoder.make(w.snapshot()), mid=interpolateStates(joined,next,.5);
  assert.ok(distance(mid.players[0].rig[8],joined.players[0].rig[8])>1);
  for(const mutate of [
    m=>m.hangX=Infinity,m=>m.hangVelocity.pop(),m=>m.hangVelocity[8].x=Infinity,
    m=>m.hangVelocity[3].y=101,m=>m.hangVelocity="bad",m=>m.hangVelocity=null,
    m=>m.hangMotion=null,m=>m.hangMotion.moving=2,m=>m.hangMotion.age=3,
    m=>m.hangMotion.time=Infinity,m=>m.hangMotion.left=-1,
  ]){
    const bad=structuredClone(joined);mutate(bad.players[0].motion);assert.equal(validSnapshot(bad),false);
  }
});
