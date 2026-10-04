import { JOINTS, makeRig } from "./puppet.js";
import { collidePoint } from "./body-physics.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const thin = s => s.oneWay || s.material === "cable";
const weights = [0, 0, .35, 1, 0, 1, 0, 1, .8, 1, .8];
const smooth = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
const HAND_STEP = .28;

export function beginHang(p, support) {
  if (!p.rig) {
    p.rig = makeRig(p);
    for (const q of p.rig) { q.y -= 12; q.py -= 12; }
  }
  p.hangSupport = support.id;
  p.hangX = p.x;
  const spread=Math.min(13,support.w/2);
  const center=clamp(p.x-support.x,spread,support.w-spread);
  p.hangMotion={age:0,left:center-spread,right:center+spread,moving:-1,
    time:0,from:0,to:0,center:p.rig[0].x-support.x,startY:p.rig[0].y+18-support.y,climb:-1};
  p.ground = false; p.support = null; p.prone = false; p.coyote = 0;
}

export function climbFromHang(p, support) {
  if(p.hangMotion.climb>=0)return;
  p.hangMotion.climb=0;
  p.hangMotion.startY=p.rig[1].y-support.y;
}

// Hand positions are relative to the support. One grip stays planted while
// the other releases, reaches past it and catches again.
function handTargets(p,support,input,dt) {
  const s=p.hangMotion,dir=Number(input.right)-Number(input.left);
  s.age=Math.min(2,s.age+dt);
  if(s.age>=.5 && s.climb<0 && s.moving===-1 && dir) {
    const hand=dir>0?(s.left<s.right?0:1):(s.left>s.right?0:1);
    const from=hand===0?s.left:s.right, other=hand===0?s.right:s.left;
    const to=clamp(other+dir*26,2,support.w-2);
    if((to-from)*dir>6 && (to-other)*dir>6) {
      s.moving=hand;s.time=0;s.from=from;s.to=to;p.facing=dir;
    }
  }
  const y=support.y+support.h*(s.climb<0?smooth((s.age-.16)/.24):1-smooth(s.climb/.55));
  const targets=[{x:support.x+s.left,y},{x:support.x+s.right,y}];
  if(s.moving!==-1) {
    s.time=Math.min(.6,s.time+dt);
    // A blocked reach can return to its old grip when movement is released
    // or reversed, instead of trapping the fighter with one arm extended.
    if(s.time>.45 && dir!==Math.sign(s.to-s.from)) {
      s.from=clamp(p.rig[s.moving===0?4:6].x-support.x,0,support.w);
      s.to=s.moving===0?s.left:s.right;s.time=0;
    }
    const t=Math.min(1,s.time/HAND_STEP);
    targets[s.moving]={x:support.x+s.from+(s.to-s.from)*smooth(t),y:y+Math.sin(t*Math.PI)*14};
  }
  p.hangX=support.x+(s.left+s.right)/2;
  return targets;
}

// Lowering and climbing share a continuous shoulder path. Once hanging,
// the head stays level while the waist and legs swing below the shoulders.
export function moveHanging(p, support, input, solids, dt) {
  const rig = p.rig, oldX = p.x, oldY = p.y;
  const targets=handTargets(p,support,input,dt),state=p.hangMotion;
  if(state.climb>=0)state.climb=Math.min(.95,state.climb+dt);
  const rising=state.climb>=0,stand=rising?smooth((state.climb-.55)/.4):0;
  const sitting=rising?smooth(state.climb/.5):1-smooth((state.age-.16)/.28);
  const mass=[...weights],free=state.moving===-1?-1:state.moving===0?4:6;
  if(free!==-1)mass[free]=1;
  const origins = rig.map(q => ({x:q.x, y:q.y}));
  const contacts = rig.map(() => new Set());
  const collision = solids.filter(s => !thin(s));
  const drag = Math.exp(-.65 * dt);
  for (const [index,q] of rig.entries()) {
    const damping=index>=7?drag*Math.exp(-20*sitting*dt):drag;
    const vx = (q.x - q.px) * damping, vy = (q.y - q.py) * damping;
    q.px = q.x; q.py = q.y;
    if(index>1){q.x += vx; q.y += vy + 1800 * dt * dt;}
  }
  const neck=rig[1],hip=rig[2],head=rig[0];
  const center=(targets[0].x+targets[1].x)/2-support.x;
  state.center+=(center-state.center)*(1-Math.exp(-14*dt));
  neck.x=support.x+state.center;
  if(rising){
    // Reversing an unfinished drop must not lower the head before rising.
    const seat=Math.min(-28,state.startY);
    neck.y=support.y+(state.climb<.55
      ? state.startY+(seat-state.startY)*smooth(state.climb/.55)
      : seat+(-57-seat)*stand);
  }else{
    neck.y=support.y+(state.age<.16
      ? state.startY+(-28-state.startY)*smooth(state.age/.14)
      : -28+(support.h+52)*smooth((state.age-.16)/.34));
  }
  collidePoint(neck,collision,3,origins[1],contacts[1]);
  head.x=neck.x;head.y=neck.y-18;
  collidePoint(head,collision,10,origins[0],contacts[0]);
  neck.x=head.x;neck.y=head.y+18;
  state.center=neck.x-support.x;
  // Hands first find the edge during the sit. A travelling hand is driven
  // by its arm muscles below, and carries no fixed constraint.
  const grips = [4, 6].map((index, i) => {
    const q = origins[index];
    let {x,y}=targets[i];
    if(stand>0){
      const restX=neck.x+(i===0?-p.facing*13:p.facing*18),restY=neck.y+(i===0?34:10);
      x+=(restX-x)*stand;y+=(restY-y)*stand;
    }
    // Hands meet/release the edge within arm reach as the shoulders lower/rise.
    const armReach=Math.min(1,35.8/(Math.hypot(x-neck.x,y-neck.y)||1));
    x=neck.x+(x-neck.x)*armReach;y=neck.y+(y-neck.y)*armReach;
    const reach = Math.min(1, 420 * dt / (Math.hypot(x-q.x,y-q.y) || 1));
    return {x:q.x+(x-q.x)*reach, y:q.y+(y-q.y)*reach};
  });
  if(free!==-1) {
    const hand=rig[free],target=targets[state.moving],motor=1-Math.exp(-65*dt);
    hand.x+=(target.x-hand.x)*motor;hand.y+=(target.y-hand.y)*motor;
  }
  const seatY=neck.y+23;
  if(sitting>0) {
    const motor=(1-Math.exp(-36*dt))*sitting,f=p.facing;
    const legStand=rising?stand:1-smooth(state.age/.14);
    for(const [index,x,y] of [[7,f*16,7],
      [8,f*16,26],[9,f*23,9],[10,f*25,27]]) {
      const restX=index<9?-9:9,restY=index%2?18:31;
      rig[index].x+=(neck.x+x+(restX-x)*legStand-rig[index].x)*motor;
      rig[index].y+=(seatY+y+(restY-y)*legStand-rig[index].y)*motor;
    }
  }
  for (let pass = 0; pass < 14; pass++) {
    for (const [ai, bi, length] of JOINTS) {
      const a = rig[ai], b = rig[bi], dx = b.x-a.x, dy = b.y-a.y;
      const d = Math.hypot(dx,dy) || 1, sum = mass[ai]+mass[bi];
      if(!sum)continue;
      const correction = (d-length)/d;
      a.x += dx*correction*mass[ai]/sum;
      a.y += dy*correction*mass[ai]/sum;
      b.x -= dx*correction*mass[bi]/sum;
      b.y -= dy*correction*mass[bi]/sum;
    }
    // The two knees and boots have volume, so resting legs do not collapse
    // into one line. They still swing and bend independently under gravity.
    for (const [ai, bi, radius] of [[7, 9, 6], [8, 10, 5]]) {
      const a = rig[ai], b = rig[bi], dx = b.x-a.x, dy = b.y-a.y;
      const d = Math.hypot(dx,dy);
      if (d < radius) {
        const x = d > .001 ? dx/d : 1, y = d > .001 ? dy/d : 0;
        a.x -= x*(radius-d)*.5; a.y -= y*(radius-d)*.5;
        b.x += x*(radius-d)*.5; b.y += y*(radius-d)*.5;
      }
    }
    // Keep a little knee flexion so a hanging leg cannot lock into one rod.
    for(const index of [8,10]){
      const foot=rig[index],dx=foot.x-hip.x,dy=foot.y-hip.y,d=Math.hypot(dx,dy);
      if(d>36){
        const correction=(d-36)/d,sum=mass[2]+mass[index];
        hip.x+=dx*correction*mass[2]/sum;hip.y+=dy*correction*mass[2]/sum;
        foot.x-=dx*correction*mass[index]/sum;foot.y-=dy*correction*mass[index]/sum;
      }
    }
    for (let i = 2; i < rig.length; i++) {
      if ((i === 4 || i === 6) && i!==free) continue;
      collidePoint(rig[i], collision, i === 0 ? 10 : 3,
        pass === 0 ? origins[i] : rig[i], contacts[i]);
    }
    for (const [i, index] of [4, 6].entries()) {
      if(index===free)continue;
      rig[index].x = grips[i].x; rig[index].y = grips[i].y;
    }
    if(sitting>0) {
      hip.x+=(neck.x-hip.x)*.45*sitting;
      hip.y+=(seatY-hip.y)*.45*sitting;
    }
  }
  if(free!==-1 && state.time>=HAND_STEP &&
      Math.hypot(rig[free].x-targets[state.moving].x,rig[free].y-targets[state.moving].y)<4) {
    if(state.moving===0)state.left=state.to;else state.right=state.to;
    state.moving=-1;
  }
  p.x = hip.x; p.y = hip.y + 4;
  p.vx = clamp((p.x-oldX)/dt, -1800, 1800);
  p.vy = clamp((p.y-oldY)/dt, -1500, 1500);
  const angle = Math.atan2(neck.x-hip.x, hip.y-neck.y);
  p.angularVelocity = Math.atan2(Math.sin(angle-(p.bodyAngle||0)),
    Math.cos(angle-(p.bodyAngle||0))) / dt;
  p.bodyAngle = angle;
  return rising && state.climb>=.95 && Math.abs(neck.y-(support.y-57))<.1 &&
    Math.abs(hip.y-(support.y-34))<.2;
}
