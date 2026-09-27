import { playerBox } from './collision.js';
import { beamTouches } from './phaser.js';
import { bodyBounds, damageProp } from './props.js';
import { colossusRig } from './colossus-rig.js';
import {COLOSSUS,colossusPhase} from './colossus-timing.js';
export {COLOSSUS,colossusPhase} from './colossus-timing.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function initialColossus() {
  return {gazeX:1280, gazeY:1100, attentionX:1280, attentionY:1100,
    strikeX:1280, eye:0, cycleId:0, cutX:null,chargeAt:COLOSSUS.wake,nextChargeAt:null};
}
export function colossusEye(h, eye = h.eye) {
  return colossusRig(h).eyes[eye];
}
export function colossusBeam(h, progress = colossusPhase(h.age,h.chargeAt).fire, index=h.eye) {
  const eye = colossusEye(h,index), dir = h.eye ? -1 : 1;
  const ex=h.strikeX + dir*(progress-.5)*COLOSSUS.sweep+(index-.5)*COLOSSUS.separation,ey=1510;
  return {...eye,eye:index,ex,ey,radius:COLOSSUS.radius,flare:Math.hypot(ex-eye.x,ey-eye.y)};
}
export function colossusBeams(h,progress=colossusPhase(h.age,h.chargeAt).fire) {
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
  const before=colossusPhase(h.age,h.chargeAt), oldBeam=colossusBeam(h);
  h.age+=dt;
  const began=h.nextChargeAt!==null&&h.age+1e-9>=h.nextChargeAt;
  if(began){
    h.chargeAt=h.nextChargeAt;h.nextChargeAt=null;h.cycleId++;
    h.eye=h.cycleId%2;h.cutX=null;h.hitIds=[];
  }
  const now=colossusPhase(h.age,h.chargeAt);
  if(before.firing&&!now.firing){
    const rest=COLOSSUS.restMin+world.random()*(COLOSSUS.restMax-COLOSSUS.restMin);
    h.nextChargeAt=h.chargeAt+COLOSSUS.charge+COLOSSUS.fire+rest;
  }
  const living=world.players.filter(p=>p.alive);
  // Rotate through actual fighters, including idle humans and bots. Averaging
  // opponents sent attacks into empty space between widely separated players.
  const target=living[h.cycleId%living.length];
  if(target){
    const {x,y}=target;
    // Cascaded low-pass motion adds real delay and suppresses twitching when
    // opponents cross or die. The firing eye stays fixed during discharge.
    h.attentionX+=(clamp(x,0,2560)-h.attentionX)*(1-Math.exp(-dt/2.8));
    h.attentionY+=(clamp(y,0,1440)-h.attentionY)*(1-Math.exp(-dt/2.8));
    if(!now.firing){
      h.gazeX+=(h.attentionX-h.gazeX)*(1-Math.exp(-dt/3.6));
      h.gazeY+=(h.attentionY-h.gazeY)*(1-Math.exp(-dt/3.6));
    }
  }
  if(began || (before.phase<0 && now.phase>=0)){
    if(target){
      // strikeX is the far endpoint, not a player's screen X. Project through
      // the chosen fighter at their own height so outer/upper ledges are reached.
      // Lock at the start of the warning, leaving the full charge time to dodge.
      const pose={...h,age:h.chargeAt+COLOSSUS.charge+COLOSSUS.fire*.5};
      const eyes=colossusRig(pose).eyes,eye={x:(eyes[0].x+eyes[1].x)/2,y:(eyes[0].y+eyes[1].y)/2};
      const aimY=Math.max(eye.y+64,clamp(target.y-15,0,1440));
      h.strikeX=clamp(eye.x+(clamp(target.x,0,2560)-eye.x)*(1510-eye.y)/(aimY-eye.y),-24000,26560);
    }
    h.cutX=null;h.hitIds=[];
  }
  h.warning=now.charge>0 ? Math.max(0,COLOSSUS.charge-now.phase) : 0;
  h.active=now.firing;
  h.duration=now.firing ? Math.max(0,COLOSSUS.charge+COLOSSUS.fire-now.phase) : 0;
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
  if(h.type!=='colossus')return !['gazeX','strikeX','eye','cycleId','chargeAt','nextChargeAt'].some(k=>k in h);
  return arena?.colossus===true && h.x===1280 && h.y===1440 && h.w===320 && h.h===200 &&
    h.done===false && [h.gazeX,h.attentionX].every(v=>Number.isFinite(v)&&v>=0&&v<=2560) &&
    [h.gazeY,h.attentionY].every(v=>Number.isFinite(v)&&v>=0&&v<=1440) &&
    Number.isFinite(h.strikeX)&&h.strikeX>=-24000&&h.strikeX<=26560 && [0,1].includes(h.eye) &&
    Number.isInteger(h.cycleId)&&h.cycleId>=0&&h.cycleId<=1000000 &&
    Number.isFinite(h.chargeAt)&&h.chargeAt>=COLOSSUS.wake &&
    (h.cycleId===0?h.chargeAt===COLOSSUS.wake:h.chargeAt<=h.age+.01&&
      h.chargeAt>=COLOSSUS.wake+COLOSSUS.charge+COLOSSUS.fire+COLOSSUS.restMin-.01) &&
    (h.nextChargeAt===null || (Number.isFinite(h.nextChargeAt)&&
      h.nextChargeAt>=h.chargeAt+COLOSSUS.charge+COLOSSUS.fire+COLOSSUS.restMin-.01&&
      h.nextChargeAt<=h.chargeAt+COLOSSUS.charge+COLOSSUS.fire+COLOSSUS.restMax+.01&&h.nextChargeAt>=h.age-.01&&
      h.age>=h.chargeAt+COLOSSUS.charge+COLOSSUS.fire-.01)) &&
    h.eye===h.cycleId%2 && h.warning<=COLOSSUS.charge && h.duration<=COLOSSUS.fire;
}
