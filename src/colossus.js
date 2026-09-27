import { playerBox } from './collision.js';
import { beamTouches } from './phaser.js';
import { bodyBounds, damageProp } from './props.js';

export const COLOSSUS = Object.freeze({
  cycle: 40, wake: 16, charge: 10, fire: 4.5, radius: 60, sweep: 380, separation: 320,
});
export const COLOSSUS_EYES = Object.freeze([{x:1274.5,y:628}, {x:1280.5,y:628}]);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function colossusPhase(age) {
  const phase = (age + 1e-9) % COLOSSUS.cycle;
  const charge = clamp((phase - COLOSSUS.wake) / COLOSSUS.charge, 0, 1);
  const firing = phase >= COLOSSUS.wake + COLOSSUS.charge &&
    phase < COLOSSUS.wake + COLOSSUS.charge + COLOSSUS.fire;
  return {phase, charge: phase < COLOSSUS.wake + COLOSSUS.charge ? charge : 0,
    firing, fire: clamp((phase - COLOSSUS.wake - COLOSSUS.charge) / COLOSSUS.fire, 0, 1),
    cooling: clamp(1 - (phase - COLOSSUS.wake - COLOSSUS.charge - COLOSSUS.fire) / 5, 0, 1)};
}
export function initialColossus() {
  return {gazeX:1280, gazeY:1100, attentionX:1280, attentionY:1100,
    strikeX:1280, eye:0, cycleId:0, cutX:null};
}
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// A slow articulated deformation of the original painted silhouette. Feet and
// the outside of the small mesh stay fixed; only the machine shifts in the valley.
export function colossusPose(age) {
  return {x:Math.sin(age*.055)*3.2, y:(Math.cos(age*.047)-1)*.65,
    head:Math.sin(age*.081)*4.5, tilt:Math.sin(age*.061)*.035,
    leftArm:Math.sin(age*.073)*.105, rightArm:Math.sin(age*.067)*-.09};
}
export function colossusPoint(h,x,y) {
  const p=colossusPose(h.age),dx=x-1278;
  const border=smooth(1234,1244,x)*(1-smooth(1310,1320,x))*
    smooth(617,622,y)*(1-smooth(707,717,y));
  const head=(1-smooth(635,650,y))*(1-smooth(7,22,Math.abs(dx)));
  const torso=smooth(3,25,Math.abs(dx))*smooth(637,661,y)*(1-smooth(699,718,y));
  const arm=p[dx<0?'leftArm':'rightArm'],length=Math.max(0,y-640);
  const look=clamp((h.gazeX-1280)/1280,-1,1)*2.5;
  return {x:x+border*(p.x+(p.head+look-(y-633)*p.tilt)*head+Math.sin(arm)*length*torso),
    y:y+border*(p.y+dx*p.tilt*head+(1-Math.cos(arm))*length*torso)};
}
export function colossusEye(h, eye = h.eye) {
  const e = COLOSSUS_EYES[eye],p=colossusPoint(h,e.x,e.y);
  return {x:p.x+(h.gazeX-1280)/1280*.7,y:p.y+(h.gazeY-1000)/700*.4};
}
export function colossusBeam(h, progress = colossusPhase(h.age).fire, index=h.eye) {
  const eye = colossusEye(h,index), dir = h.eye ? -1 : 1;
  const ex=h.strikeX + dir*(progress-.5)*COLOSSUS.sweep+(index-.5)*COLOSSUS.separation,ey=1510;
  return {...eye,eye:index,ex,ey,radius:COLOSSUS.radius,flare:Math.hypot(ex-eye.x,ey-eye.y)};
}
export function colossusBeams(h,progress=colossusPhase(h.age).fire) {
  return [colossusBeam(h,progress,0),colossusBeam(h,progress,1)];
}
export function beamX(beam, y) {
  return beam.x + (beam.ex-beam.x) * (y-beam.y)/(beam.ey-beam.y);
}
// Perspective narrows the ray to its remote eye. These same straight edges
// drive the warning, cuts and shared polygon/actor collision.
export function beamEdges(beam,y) {
  const length=Math.hypot(beam.ex-beam.x,beam.ey-beam.y);
  const nx=(beam.ey-beam.y)/length,ny=-(beam.ex-beam.x)/length;
  return [-1,1].map(side=>beam.x+(beam.ex+side*nx*beam.radius-beam.x)*
    Math.max(0,y-beam.y)/(beam.ey+side*ny*beam.radius-beam.y));
}
export function colossusZone(h, y) {
  const beams=[...colossusBeams(h,0),...colossusBeams(h,1)];
  const top=y == null ? Math.min(...beams.map(b=>b.y)) : y-60, bottom=y == null ? 1510 : y+60;
  const xs=beams.flatMap(b=>[...beamEdges(b,top),...beamEdges(b,bottom)]);
  return {x:Math.min(...xs)-25,y:top,w:Math.max(...xs)-Math.min(...xs)+50,h:bottom-top};
}
export function colossusDanger(h,x,y,padding=18) {
  if(h.done || (!h.active && h.warning<=0))return false;
  const z=colossusZone(h,y);
  return x+padding>z.x && x-padding<z.x+z.w;
}

// Slice only the swept beam/rectangle intersection. Horizontal collision strips
// retain their source identity so the renderer clips one continuous stone face.
// Cuts happen at bounded spatial intervals, with no pre-carved attack corridor.
export function carveColossusBeam(world, beam, previous = beam) {
  const out=[], impacts=[];
  let changed=false;
  const removedWreck = new Set();
  for(const p of world.platforms) {
    if(p.hp===0)continue;
    const xs=[...beamEdges(beam,p.y),...beamEdges(beam,p.y+p.h),...beamEdges(previous,p.y),...beamEdges(previous,p.y+p.h)];
    if(p.y+p.h<beam.y-beam.radius || p.y>beam.ey+beam.radius ||
      p.x+p.w<=Math.min(...xs) || p.x>=Math.max(...xs)) {out.push(p);continue;}
    if(p.wreckId){removedWreck.add(p.wreckId);changed=true;continue;}
    let touched=false;
    const slices=[];
    const add=(x,y,w,h)=>{
      if(w<.5||h<.5)return;
      slices.push({...p,id:`cut${++world.terrainSerial}`,sourceId:p.sourceId||p.id,
        x,y,w,h,baseX:x,baseY:y,dx:0,dy:0,move:undefined,travel:undefined,elevator:false});
    };
    for(let y=p.y;y<p.y+p.h;y+=8) {
      const height=Math.min(8,p.y+p.h-y);
      const xa=[...beamEdges(beam,y),...beamEdges(beam,y+height),...beamEdges(previous,y),...beamEdges(previous,y+height)];
      const left=clamp(Math.min(...xa),p.x,p.x+p.w), right=clamp(Math.max(...xa),p.x,p.x+p.w);
      if(right-left>.01)touched=true;
      add(p.x,y,left-p.x,height);add(right,y,p.x+p.w-right,height);
    }
    if(touched){out.push(...slices);changed=true;impacts.push({x:clamp(beamX(beam,p.y),p.x,p.x+p.w),y:p.y});}
    else out.push(p);
  }
  if(!changed)return false;
  world.platforms=out.filter(p=>!removedWreck.has(p.wreckId));
  if(removedWreck.size){world.wreckage=world.wreckage.filter(p=>!removedWreck.has(p.id));world.wreckDirty=true;}
  world.terrainVersion++;
  const ids=new Set(world.platforms.map(p=>p.id));
  for(const p of world.players)if(p.support&&!ids.has(p.support)){p.support=null;p.ground=false;p.coyote=0;}
  for(const hit of impacts.slice(0,6))for(let n=0;n<4;n++){
    const a=n*2.399+world.time;
    world.debris.push({x:hit.x,y:hit.y,vx:Math.cos(a)*230,vy:-100-Math.abs(Math.sin(a))*200,
      w:5+n*2,h:4+n,angle:a,spin:n-2,life:1.3+n*.15});
  }
  world.debris=world.debris.slice(-90);
  return true;
}

export function updateColossus(world,h,dt) {
  if(world.prediction || world.phase!=='fight')return;
  const before=colossusPhase(h.age), oldBeam=colossusBeam(h);
  h.age+=dt;
  const now=colossusPhase(h.age), cycle=Math.floor((h.age+1e-9)/COLOSSUS.cycle);
  if(cycle!==h.cycleId){h.cycleId=cycle;h.eye=cycle%2;h.cutX=null;h.hitIds=[];}
  const living=world.players.filter(p=>p.alive);
  if(living.length){
    const x=living.reduce((n,p)=>n+p.x,0)/living.length,y=living.reduce((n,p)=>n+p.y,0)/living.length;
    // Cascaded low-pass motion adds real delay and suppresses twitching when
    // opponents cross or die. The firing eye stays fixed during discharge.
    h.attentionX+=(clamp(x,0,2560)-h.attentionX)*(1-Math.exp(-dt/2.8));
    h.attentionY+=(clamp(y,0,1440)-h.attentionY)*(1-Math.exp(-dt/2.8));
    if(!now.firing){
      h.gazeX+=(h.attentionX-h.gazeX)*(1-Math.exp(-dt/3.6));
      h.gazeY+=(h.attentionY-h.gazeY)*(1-Math.exp(-dt/3.6));
    }
  }
  if(before.phase<COLOSSUS.wake && now.phase>=COLOSSUS.wake){
    h.strikeX=clamp(h.gazeX,450,2110);h.cutX=null;h.hitIds=[];
  }
  h.warning=now.charge>0 ? COLOSSUS.wake+COLOSSUS.charge-now.phase : 0;
  h.active=now.firing;
  h.duration=now.firing ? COLOSSUS.wake+COLOSSUS.charge+COLOSSUS.fire-now.phase : 0;
  const beam=colossusBeam(h),beams=colossusBeams(h);
  h.bodyX=beam.ex;h.bodyY=beam.ey;
  if(!now.firing)return;
  if(!before.firing)world.event('hazard',{x:beam.ex,y:1150,kind:'colossus'});
  const sweepPad=before.firing?Math.abs(beam.ex-oldBeam.ex):0;
  for(const p of world.players){
    if(!p.alive || h.hitIds.includes(p.id))continue;
    const hit=beams.find(b=>beamTouches(playerBox(p),{...b,radius:b.radius+sweepPad}));
    if(!hit)continue;
    h.hitIds.push(p.id);
    world.hit(p,{x:hit.x,y:hit.y,vx:0,vy:0},1000,1050,Math.sign(p.x-hit.x)||1,.3,
      {blast:true,effect:'plasma',cause:'colossus',hitstop:0});
  }
  for(const p of [...world.cover,...world.chunks])if(p.hp>0&&beams.some(b=>beamTouches(bodyBounds(p),{...b,radius:b.radius+sweepPad})))
    damageProp(world,p,1000,(Math.sign(p.x-beam.x)||1)*420,-260);
  // Carve at most once per 14 units of sweep; the preceding beam closes the
  // gap exactly. Bounded chunks/debris use the shared physical-world budgets.
  if(h.cutX===null||Math.abs(beam.ex-h.cutX)>=14||h.duration<=dt*1.1){
    for(const b of beams)carveColossusBeam(world,b,h.cutX===null?b:
      {...b,ex:h.cutX+(b.eye-h.eye)*COLOSSUS.separation});
    h.cutX=beam.ex;
  }
}

export function validColossus(h,arena) {
  if(h.type!=='colossus')return !['gazeX','strikeX','eye','cycleId'].some(k=>k in h);
  return arena?.colossus===true && h.x===1280 && h.y===1440 && h.w===320 && h.h===200 &&
    h.done===false && [h.gazeX,h.attentionX].every(v=>Number.isFinite(v)&&v>=0&&v<=2560) &&
    [h.gazeY,h.attentionY].every(v=>Number.isFinite(v)&&v>=0&&v<=1440) &&
    Number.isFinite(h.strikeX)&&h.strikeX>=450&&h.strikeX<=2110 && [0,1].includes(h.eye) &&
    Number.isInteger(h.cycleId)&&h.cycleId>=0&&h.cycleId<=1000000 &&
    h.eye===h.cycleId%2 && h.warning<=COLOSSUS.charge && h.duration<=COLOSSUS.fire;
}
