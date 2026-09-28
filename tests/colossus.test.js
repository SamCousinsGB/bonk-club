import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {COLOSSUS,colossusPhase,colossusEye,colossusBeam,colossusBeams,beamX,updateColossus,carveColossusBeam} from '../src/colossus.js';
import {colossusRig,colossusEyeOpening,rigPoint,COLOSSUS_EYES,COLOSSUS_SCALE,COLOSSUS_LEGS,COLOSSUS_ARMS,COLOSSUS_NECK} from '../src/colossus-rig.js';
import {carveExplosion} from '../src/terrain.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
import {prepareProp} from '../src/props.js';
import {botDanger} from '../src/bot-danger.js';
import {navigation,routesFrom,surfaceAt} from '../src/navigation.js';
import {firePhaser} from '../src/phaser.js';
import {nuclearField,updateNuclear} from '../src/nuclear.js';
import {blackholeField,updateBlackhole} from '../src/blackhole.js';
import {colossusStand} from '../src/colossus-timing.js';
import {makeRig} from '../src/puppet.js';

function fixture(){const w=new World({arena:ARENAS.findIndex(a=>a.colossus),players:[0,1,2,3],shuffle:false,random:()=>.42});w.phase='fight';return w;}
function advance(w,seconds){for(let n=0;n<Math.round(seconds/STEP);n++){w.time+=STEP;updateColossus(w,w.hazards[0],STEP);}}
function transport(w){return expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot);}

test('eyes open gradually before the first charge and remain faintly awake between attacks',()=>{
  assert.equal(colossusEyeOpening(0),0);
  assert.ok(colossusEyeOpening(6)>0&&colossusEyeOpening(6)<colossusEyeOpening(7));
  assert.equal(colossusEyeOpening(10),1);
  for(const age of [16,26,32,40,60])assert.equal(colossusEyeOpening(age),1);
  assert.equal(colossusEyeOpening(0),0,"round reset closes the shutters");
});

test('first attack waits for a complete rise and eye opening; later random attacks keep him standing',()=>{
  const w=fixture(),h=w.hazards[0];w.cover=[];
  w.players.forEach(p=>{p.x=70;p.y=750;});w.hit=()=>{}; // Keep the timing/budget fixture alive through repeated targeted attacks.
  let draws=0;w.random=()=>[0,.5,.99][draws++%3];
  const start=colossusRig(h);
  advance(w,COLOSSUS.rise);
  assert.equal(colossusStand(h.age),1);assert.ok(colossusEyeOpening(h.age)<1e-8);
  assert.ok(start.head.y-colossusRig(h).head.y>85,"rise visibly above the ridge");
  const upright=colossusRig(h);
  assert.ok(upright.body.y<630&&upright.legs.every(l=>l.knee.y>685&&l.foot.y>740),
    'the torso emerges while the distant ridge hides the lower legs');
  advance(w,COLOSSUS.eyes);
  assert.equal(colossusEyeOpening(h.age),1);assert.equal(h.active,false);
  advance(w,COLOSSUS.charge);
  assert.equal(h.active,true);assert.equal(draws,0);
  const rests=[];let previousNext=null;
  for(let n=0;n<55/STEP;n++){
    advance(w,STEP);
    if(h.nextChargeAt!==null&&h.nextChargeAt!==previousNext){
      rests.push(h.nextChargeAt-h.chargeAt-COLOSSUS.charge-COLOSSUS.fire);
      previousNext=h.nextChargeAt;
      const joined=transport(w).hazards[0];
      assert.ok(Math.abs(joined.nextChargeAt-h.nextChargeAt)<.006);
      assert.ok(Math.abs(joined.chargeAt-h.chargeAt)<.006);
    }
    assert.equal(colossusStand(h.age),1);
    assert.equal(colossusEyeOpening(h.age),1);
  }
  assert.ok(rests.length>=3);assert.ok(Math.abs(rests[0]-3.5)<.001);
  assert.ok(Math.abs(rests[1]-6.5)<.001);assert.ok(Math.abs(rests[2]-9.44)<.001);
  assert.equal(draws,rests.length,"only the host samples once after each sweep");
  w.startRound();assert.equal(w.hazards[0].chargeAt,COLOSSUS.wake);
  assert.equal(w.hazards[0].nextChargeAt,null);assert.equal(colossusStand(w.hazards[0].age),0);
});

test('colossus terraces connect every spawn to contested weapons with the distant mech above play',()=>{
  const w=fixture(),solids=w.solids(),graph=navigation(solids,{time:0,spikes:[]});
  assert.ok(w.platforms.every(p=>p.y>=870));
  for(const p of w.players){
    const paths=routesFrom(graph,solids,surfaceAt(solids,p),p.x,new Map(),0);
    for(const [x,y] of w.arena.weapons)assert.ok(paths.has(surfaceAt(solids,{x,y})?.id),`${p.id} -> ${x},${y}`);
    assert.equal(p.weapon,null);
  }
  assert.ok(validSnapshot(w.snapshot()));
});

test('gaze has mechanical lag, stays bounded, and follows players without moving the locked attack',()=>{
  const w=fixture(),h=w.hazards[0];
  w.hit=()=>{}; // Measure tracking independently of the now-targeted stationary fighters dying.
  w.players.forEach(p=>{p.x=2300;p.y=1000;});advance(w,.1);
  assert.ok(h.gazeX>1280&&h.gazeX<1282);
  const untracked=colossusEye({...h,gazeX:1280});
  assert.ok(Math.abs(colossusEye(h).x-untracked.x)<.02);
  advance(w,12);assert.ok(h.gazeX>2050&&h.gazeX<2300);
  h.age=COLOSSUS.wake-STEP;advance(w,STEP);const target=h.strikeX;
  w.players.forEach(p=>p.x=200);advance(w,3);
  assert.equal(h.strikeX,target);assert.ok(h.gazeX<2150);
  assert.ok(h.warning>0&&!h.active);assert.ok(validSnapshot(transport(w)));
});

test('four second charge does no damage or terrain edits, then lethal contact respects the visible beam',()=>{
  const w=fixture(),h=w.hazards[0];h.age=COLOSSUS.wake;h.strikeX=1280;
  const original=structuredClone(w.platforms);advance(w,COLOSSUS.charge-STEP);
  assert.ok(h.warning>0&&!h.active);assert.deepEqual(w.platforms,original);
  assert.ok(w.players.every(p=>p.hp===100));
  const beam=colossusBeam(h,0),p=w.players[0],safe=w.players[1];
  Object.assign(p,{x:beamX(beam,1010),y:1010,spawnShield:0});
  Object.assign(safe,{x:p.x-220,y:p.y,spawnShield:0});
  advance(w,STEP*2);
  assert.ok(h.active);assert.equal(p.alive,false);assert.equal(safe.hp,100);
  assert.equal(w.lastDeathCause,'colossus');assert.ok(w.terrainVersion>0);
  assert.ok(w.platforms.some(p=>p.sourceId));assert.ok(validSnapshot(w.snapshot()));
});

test('each warning targets an actual idle fighter at their own height, including outer and upper ledges',()=>{
  for(const [x,y] of [[70,750],[2490,750],[100,1320],[2460,1320],[400,610],[2200,610]]){
    const w=fixture(),h=w.hazards[0];
    Object.assign(w.players[0],{x,y,spawnShield:0,vx:0,vy:0});
    // Far-away opponents must not pull the attack into the empty group average.
    w.players.slice(1).forEach(p=>Object.assign(p,{x:2560-x,y:1320}));
    advance(w,COLOSSUS.wake+STEP);
    const joined=transport(w).hazards[0];
    assert.ok(Math.abs(joined.strikeX-h.strikeX)<.006,'off-screen endpoints survive compact hot join');
    let nearest=Infinity;
    for(let n=0;n<=120;n++){
      const progress=n/120,pose={...h,age:h.chargeAt+COLOSSUS.charge+progress*COLOSSUS.fire};
      for(const b of colossusBeams(pose,progress))nearest=Math.min(nearest,Math.abs(beamX(b,y-15)-x));
    }
    assert.ok(nearest<12,`sweep misses idle fighter at ${x},${y}: ${nearest}`);
    advance(w,COLOSSUS.charge+COLOSSUS.fire);
    assert.equal(w.players[0].alive,false,`idle fighter at ${x},${y} is exposed to the real beam`);
  }
});

test('repeat attacks rotate through living fighters and keep a stable, escapable warning',()=>{
  const w=fixture(),h=w.hazards[0];w.hit=()=>{};
  w.players.forEach((p,i)=>Object.assign(p,{x:200+i*720,y:1260}));
  const locked=[];
  for(let n=0;n<45/STEP;n++){
    const previous=h.cycleId;advance(w,STEP);
    if(h.cycleId!==previous){
      const target=w.players.filter(p=>p.alive)[h.cycleId%w.players.filter(p=>p.alive).length];
      const beam=colossusBeam({...h,age:h.chargeAt+5.5},.5,0);
      assert.ok(Math.abs(beamX({...beam,ex:h.strikeX},target.y-15)-target.x)<12);
      const strike=h.strikeX;target.x+=80;advance(w,1);assert.equal(h.strikeX,strike);
      locked.push(strike);if(locked.length===1)w.players[0].alive=false;
    }
  }
  assert.ok(locked.length>=2&&new Set(locked).size===locked.length);
});

test('beam carves only its swept contact, releases removed supports and destroys contacted physical props',()=>{
  const w=fixture(),h=w.hazards[0];h.age=12;
  const beam=colossusBeam(h),near=beamX(beam,1100);
  w.platforms=[{id:'near',x:near-200,y:1100,w:400,h:32,material:'stone'},
    {id:'far',x:100,y:1100,w:220,h:32,material:'stone'}];
  w.players[0].support='near';w.players[0].ground=true;
  const far=w.platforms[1];assert.ok(carveColossusBeam(w,beam));
  assert.ok(w.platforms.includes(far));assert.equal(w.players[0].support,null);
  assert.ok(!w.platforms.some(p=>p.x<near&&p.x+p.w>near&&p.y<=1110&&p.y+p.h>=1110));
  w.cover=[prepareProp({id:'hit',kind:'crate',x:near-36,y:1040,w:72,h:64,hp:75,maxHp:75}),
    prepareProp({id:'safe',kind:'crate',x:100,y:1040,w:72,h:64,hp:75,maxHp:75})];
  advance(w,STEP);assert.equal(w.cover[0].hp,0);assert.equal(w.cover[1].hp,75);
  assert.ok(w.chunks.length>0&&w.chunks.length<=96);
});

test('the distant beam narrows with perspective and cannot hit outside its visible cone',()=>{
  const w=fixture(),h=w.hazards[0];h.age=12;h.strikeX=1280;
  const beam=colossusBeam(h),nearEye=w.players[0],foreground=w.players[1];
  Object.assign(nearEye,{x:beamX(beam,800)-50,y:800,spawnShield:0});
  Object.assign(foreground,{x:beamX(beam,1300)+20,y:1300,spawnShield:0});
  advance(w,STEP);
  assert.equal(nearEye.hp,100);assert.equal(foreground.alive,false);
});

test('both moving eyes fire together, damage both paths and leave the space between them intact',()=>{
  const w=fixture(),h=w.hazards[0];h.age=12;h.strikeX=1280;
  const beams=colossusBeams(h),xs=beams.map(b=>beamX(b,1300)),middle=(xs[0]+xs[1])/2;
  assert.equal(beams.length,2);assert.ok(beams[1].x>beams[0].x);
  beams.forEach((b,i)=>assert.deepEqual({x:b.x,y:b.y},colossusEye(h,i)));
  for(let i=0;i<2;i++)Object.assign(w.players[i],{x:xs[i],y:1300,spawnShield:0});
  Object.assign(w.players[2],{x:middle,y:1300,spawnShield:0});
  w.platforms=[{id:'test-floor',x:200,y:1320,w:2160,h:32,material:'stone'}];
  advance(w,STEP);
  assert.ok(w.players.slice(0,2).every(p=>!p.alive));assert.equal(w.players[2].hp,100);
  const solidAt=x=>w.platforms.some(p=>x>p.x&&x<p.x+p.w&&1324>=p.y&&1324<p.y+p.h);
  for(const b of colossusBeams(h))assert.equal(solidAt(beamX(b,1324)),false);
  assert.ok(solidAt(middle));assert.ok(validSnapshot(transport(w)));
});

test('climb plants each hand, then settles into stillness with restrained head movement',()=>{
  const h=fixture().hazards[0],a=colossusRig({...h,age:1.4}),b=colossusRig({...h,age:2.8});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert.ok(a.body.y-b.body.y>60,'the torso pulls past the stationary handholds');
  for(let i=0;i<2;i++){
    assert.ok(distance(a.arms[i].hand,b.arms[i].hand)<.01,'planted hands cannot slide up with the torso');
    assert.ok(distance(a.arms[i].elbow,b.arms[i].elbow)>25,'elbows articulate during the pull');
  }
  const leftFirst=colossusRig({...h,age:1.1});
  assert.equal(leftFirst.arms[0].grip,1);assert.ok(leftFirst.arms[1].grip<1);
  const standing=colossusRig({...h,age:5.5}),tilted=colossusRig({...h,age:6.7});
  const tilt=Math.abs(Math.atan2(standing.head.b,standing.head.a)-Math.atan2(tilted.head.b,tilted.head.a));
  assert.ok(tilt>.01&&tilt<.07,'small deliberate head turn instead of a sideways puppet cock');
  assert.ok(standing.arms.every(a=>a.grip===0));
  const restA=colossusRig({...h,age:18}),restB=colossusRig({...h,age:20.5});
  const relative=r=>({x:r.arms[0].hand.x-r.body.x,y:r.arms[0].hand.y-r.body.y});
  assert.ok(distance(relative(restA),relative(restB))<.01,'relaxed arms hold their weight between attacks');
  const charged=colossusRig({...h,age:11.8});
  assert.ok(distance(relative(restA),relative(charged))<.01,'charging does not spread or float the arms');
  assert.ok(distance(restA.head,restB.head)<.5,'the body breathes slowly without bobbing');
});

test('articulated climb and attack poses keep solid limbs, an attached neck and continuous beam origins',()=>{
  const h=fixture().hazards[0],start=colossusRig(h),later=colossusRig({...h,age:6});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert.ok(rigPoint(start.head,0,-120).y>710,"even the crown begins below the foreground ridge");
  // At the ordinary 1600px desktop camera, head travel exceeds 10px and a
  // hand travels over 10px. This is intentionally visible in normal gameplay.
  assert.ok(distance(start.head,later.head)*1600/2560>10);
  assert.ok(Math.max(...start.arms.map((a,i)=>distance(a.hand,later.arms[i].hand)))*1600/2560>10);
  for(let age=0;age<180;age+=.1){
    const r=colossusRig({...h,age}),next=colossusRig({...h,age:age+.1});
    for(const arm of r.arms){
      assert.ok(Math.abs(distance(arm.shoulder,arm.elbow)-COLOSSUS_ARMS.upper*COLOSSUS_SCALE)<1e-8);
      assert.ok(Math.abs(distance(arm.elbow,arm.hand)-COLOSSUS_ARMS.lower*COLOSSUS_SCALE)<1e-8);
    }
    r.legs.forEach((leg,i)=>{
      if(age>=6)assert.ok(Math.abs(leg.foot.x-leg.hip.x)<9,'extended legs stay beneath the hips after the climb');
      assert.ok(Math.abs(distance(leg.hip,leg.knee)-COLOSSUS_LEGS.upper*COLOSSUS_SCALE)<1e-8);
      assert.ok(Math.abs(distance(leg.knee,leg.foot)-COLOSSUS_LEGS.lower*COLOSSUS_SCALE)<1e-8);
    });
    const collar=rigPoint(r.body,COLOSSUS_NECK.x,COLOSSUS_NECK.y);
    assert.ok(distance(r.head,collar)<1e-8,"head rotates around the attached neck collar");
    for(const gazeX of [0,2560]){
      const looking=colossusRig({...h,age,gazeX});
      assert.ok(distance(looking.head,rigPoint(looking.body,COLOSSUS_NECK.x,COLOSSUS_NECK.y))<1e-8);
    }
    assert.ok(distance(r.head,next.head)<13,`head continuity at ${age}`);
    r.arms.forEach((arm,i)=>assert.ok(distance(arm.hand,next.arms[i].hand)<30,`hand continuity at ${age}`));
    COLOSSUS_EYES.forEach((e,i)=>assert.deepEqual(colossusEye({...h,age},i),rigPoint(r.head,e.x,e.y)));
  }
  for(const age of [COLOSSUS.wake+COLOSSUS.charge,COLOSSUS.wake+COLOSSUS.charge+COLOSSUS.fire]){
    const a=colossusRig({...h,age:age-.001}),b=colossusRig({...h,age:age+.001});
    assert.ok(distance(a.eyes[0],b.eyes[0])<.2,'charge/fire/cooldown cannot snap the beam origin');
    a.arms.forEach((arm,i)=>assert.ok(distance(arm.hand,b.arms[i].hand)<.2));
  }
});

test('joining during the climb, head tilt or attack reconstructs the pose from transported state',()=>{
  const w=fixture(),h=w.hazards[0],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  for(const age of [1.6,2.7,5,6.8,9.25,12.2,15.5]){
    h.age=age;h.active=colossusPhase(age,h.chargeAt).firing;
    h.gazeX=1876.123;h.gazeY=1017.654;
    const source=colossusRig(h),joined=colossusRig(transport(w).hazards[0]);
    assert.ok(distance(source.head,joined.head)<.01);
    for(let i=0;i<2;i++){
      assert.ok(distance(source.arms[i].hand,joined.arms[i].hand)<.01);
      assert.ok(distance(source.legs[i].knee,joined.legs[i].knee)<.01);
      assert.ok(distance(source.eyes[i],joined.eyes[i])<.01);
    }
  }
  w.startRound();assert.equal(w.hazards[0].age,0);
  assert.deepEqual(colossusRig(w.hazards[0]),colossusRig(fixture().hazards[0]));
});

test('distant mech cannot be destroyed by local blasts; only host fight state advances it',()=>{
  const w=fixture(),h=w.hazards[0];
  carveExplosion(w,{x:h.bodyX,y:h.bodyY,radius:480});assert.equal(h.done,false);
  const state=structuredClone(h);w.prediction=true;advance(w,2);assert.deepEqual(h,state);
  w.prediction=false;w.phase='countdown';advance(w,2);assert.deepEqual(h,state);
  w.phase='result';advance(w,2);assert.deepEqual(h,state);
});

test('phaser, nuclear cuts and black hole capture cannot remove the remote eye controller',()=>{
  for(const weapon of ['phaser','nuclear','blackhole']){
    const w=fixture(),h=w.hazards[0],p=w.players[0];
    if(weapon==='phaser'){
      Object.assign(p,{x:h.bodyX-300,y:h.bodyY+10,weapon:'phaser',rig:null});firePhaser(w,p,1,0);
    }else if(weapon==='nuclear'){
      const field=nuclearField(w,{x:h.bodyX,y:h.bodyY,owner:p.id});
      for(let n=0;n<120;n++)updateNuclear(w,field,STEP);
    }else{
      const field=blackholeField(w,{x:h.bodyX,y:h.bodyY,owner:p.id});w.fields.push(field);
      for(let n=0;n<120;n++)updateBlackhole(w,field,STEP);
    }
    assert.ok(w.hazards.includes(h),weapon);assert.equal(h.done,false,weapon);
    advance(w,.1);assert.ok(h.age>0,weapon);
  }
});

test('an unarmed bot walks out of the warning on surviving terrain and survives the sweep',()=>{
  const w=fixture(),h=w.hazards[0],p=w.players[0];
  w.ids=[0,1];w.players=w.players.slice(0,2);w.botIds=new Set([0]);p.bot=true;
  w.cover=[];w.drops=[];w.weaponTimer=Infinity;w.grenadeTimer=Infinity;
  Object.assign(p,{x:1280,y:1290,vx:0,vy:0,ground:true,support:'floor0'});p.rig=makeRig(p);
  Object.assign(w.players[1],{x:2400,y:1290,vx:0,vy:0,ground:true,support:'floor0'});w.players[1].rig=makeRig(w.players[1]);
  h.age=8;h.strikeX=1280;
  let escaped=false;
  // Isolate the dodge from a melee victory ending the round: use the actual
  // controller's movement through shared physics, with a stationary opponent.
  for(let n=0;n<120*7;n++){
    w.time+=STEP;const input=w.ai.inputs(w,STEP)[p.id];w.move(p,input,STEP);updateColossus(w,h,STEP);
    if(h.age<12&&!botDanger(w.hazards,p.x,p.y))escaped=true;
  }
  assert.ok(escaped);assert.ok(p.alive);assert.ok(p.y<1400);assert.ok(validSnapshot(w.snapshot()));
});

test('a full sweep, second eye and repeated attacks remain bounded and round reset restores everything',()=>{
  const w=fixture(),h=w.hazards[0];
  w.players.forEach((p,i)=>{p.x=400+i*590;p.y=1280;});w.hit=()=>{}; // Exercise cuts across occupied terraces throughout the budget fixture.
  for(let n=0;n<120*121;n++){
    w.time+=STEP;updateColossus(w,h,STEP);
    if(n%120===0){assert.ok(validSnapshot(w.snapshot()),`invalid at ${h.age}`);assert.ok(w.platforms.length<450);}
  }
  assert.equal(h.eye,h.cycleId%2);assert.ok(h.cycleId>=7);assert.ok(w.terrainVersion>0);
  assert.ok(w.debris.length<=90&&w.chunks.length<=96);
  w.startRound();assert.equal(w.hazards[0].age,0);assert.equal(w.hazards[0].eye,0);
  assert.equal(w.platforms.length,w.arena.platforms.length);assert.ok(w.platforms.every(p=>!p.sourceId));
  assert.ok(validSnapshot(w.snapshot()));
});

test('damaged-world hot join carries exact optical pose, charge, beam and collision; invalid state is rejected',()=>{
  const w=fixture(),h=w.hazards[0];h.age=11;advance(w,2.5);
  const s=transport(w),q=s.hazards[0];
  assert.ok(q.active&&s.platforms.some(p=>p.sourceId));
  assert.ok(Math.abs(colossusBeam(q).ex-colossusBeam(h).ex)<.02);
  for(let i=0;i<2;i++){
    const a=colossusBeams(h)[i],b=colossusBeams(q)[i];
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.02);assert.ok(Math.abs(a.ex-b.ex)<.02);
  }
  assert.equal(q.eye,h.eye);assert.ok(s.platforms.length===w.platforms.length);
  for(const patch of [{gazeX:Infinity},{gazeY:-1},{attentionX:3000},{strikeX:-24001},{strikeX:26561},{strikeX:NaN},{eye:2},{eye:1},
    {cycleId:-1},{cycleId:1.5},{chargeAt:NaN},{chargeAt:9},{chargeAt:-1},
    {nextChargeAt:1},{nextChargeAt:Infinity},{nextChargeAt:999},{warning:11},{duration:9},{done:true},{x:10}]){
    const bad=structuredClone(s);Object.assign(bad.hazards[0],patch);assert.equal(validSnapshot(bad),false,JSON.stringify(patch));
  }
  const bad=structuredClone(s);bad.arenaIndex=0;assert.equal(validSnapshot(bad),false);
});

test('guest interpolation smooths slow eyes but never blends across firing or cycle boundaries',()=>{
  const w=fixture(),h=w.hazards[0];h.age=11;advance(w,.1);const a=transport(w);
  advance(w,.3);h.gazeX+=100;const b=transport(w),mid=interpolateStates(a,b,.5);
  assert.equal(mid.hazards[0].gazeX,(a.hazards[0].gazeX+b.hazards[0].gazeX)/2);
  advance(w,1);const fired=transport(w),transition=interpolateStates(b,fired,.01);
  assert.equal(transition.hazards[0],fired.hazards[0]);assert.equal(transition.hazards[0].active,true);
});

test('AI avoids the whole upcoming sweep at its own height while safe terraces remain usable',()=>{
  const w=fixture(),h=w.hazards[0];h.age=9;advance(w,STEP);
  const beam=colossusBeam(h,.5),x=beamX(beam,1000);
  assert.ok(botDanger(w.hazards,x,1000));assert.equal(botDanger(w.hazards,100,1000),false);
  h.age=35;advance(w,STEP);assert.equal(botDanger(w.hazards,x,1000),false);
  assert.equal(colossusPhase(0).firing,false);
});
