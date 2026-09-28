import { JOINTS, makeRig } from "./puppet.js";
import { collidePoint } from "./body-physics.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const thin = s => s.oneWay || s.material === "cable";
const weights = [.9, .4, .35, 1, 0, 1, 0, 1, .8, 1, .8];
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
    time:0,from:0,to:0,seatY:p.rig[2].y-support.y};
  p.ground = false; p.support = null; p.prone = false; p.coyote = 0;
}

// Hand positions are relative to the support. One grip stays planted while
// the other releases, reaches past it and catches again.
function handTargets(p,support,input,dt) {
  const s=p.hangMotion,dir=Number(input.right)-Number(input.left);
  s.age=Math.min(2,s.age+dt);
  if(s.age>=1 && s.moving===-1 && dir) {
    const hand=dir>0?(s.left<s.right?0:1):(s.left>s.right?0:1);
    const from=hand===0?s.left:s.right, other=hand===0?s.right:s.left;
    const to=clamp(other+dir*26,2,support.w-2);
    if((to-from)*dir>6 && (to-other)*dir>6) {
      s.moving=hand;s.time=0;s.from=from;s.to=to;p.facing=dir;
    }
  }
  const y=support.y+support.h*smooth((s.age-.55)/.18);
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

// After the brief seated entry, the hands carry the weight. The particles
// supply the visible pose, body position and release speed.
export function moveHanging(p, support, input, solids, dt) {
  const rig = p.rig, oldX = p.x, oldY = p.y;
  const targets=handTargets(p,support,input,dt),state=p.hangMotion;
  const sitting=1-smooth((state.age-.55)/.18);
  const mass=[...weights],free=state.moving===-1?-1:state.moving===0?4:6;
  if(free!==-1)mass[free]=1;
  const origins = rig.map(q => ({x:q.x, y:q.y}));
  const contacts = rig.map(() => new Set());
  const collision = solids.filter(s => !thin(s));
  const drag = Math.exp(-.65 * dt);
  for (const q of rig) {
    const vx = (q.x - q.px) * drag, vy = (q.y - q.py) * drag;
    q.px = q.x; q.py = q.y;
    q.x += vx; q.y += vy + 1800 * dt * dt;
  }
  // Hands first find the edge during the sit. A travelling hand is driven
  // by its arm muscles below, and carries no fixed constraint.
  const grips = [4, 6].map((index, i) => {
    const q = origins[index], {x,y} = targets[i];
    const reach = Math.min(1, 420 * dt / (Math.hypot(x-q.x,y-q.y) || 1));
    return {x:q.x+(x-q.x)*reach, y:q.y+(y-q.y)*reach};
  });
  if(free!==-1) {
    const hand=rig[free],target=targets[state.moving],motor=1-Math.exp(-65*dt);
    hand.x+=(target.x-hand.x)*motor;hand.y+=(target.y-hand.y)*motor;
    // Flex the supporting elbow enough for the free hand to reach the edge.
    const anchor=targets[1-state.moving],pull=1-Math.exp(-7*dt);
    rig[1].x+=(anchor.x+Math.sign(state.to-state.from)*9-rig[1].x)*pull;
    rig[1].y+=(anchor.y+24-rig[1].y)*pull;
  }
  const seatY=support.y+state.seatY+(-5-state.seatY)*smooth(state.age/.24);
  if(sitting>0) {
    const motor=(1-Math.exp(-20*dt))*sitting,f=p.facing;
    for(const [index,x,y] of [[1,-f*5,-23],[0,-f*6,-41],[7,f*16,7],
      [8,f*16,26],[9,f*23,9],[10,f*25,27]]) {
      rig[index].x+=(p.hangX+x-rig[index].x)*motor;
      rig[index].y+=(seatY+y-rig[index].y)*motor;
    }
  }
  // A relaxed neck keeps the head above the shoulders. Once the seat
  // releases, hips, knees and feet remain passive.
  const neck = rig[1], hip = rig[2], head = rig[0];
  const length = Math.hypot(neck.x-hip.x,neck.y-hip.y) || 1;
  const neckSpring = 1 - Math.exp(-12 * dt);
  head.x += (neck.x+(neck.x-hip.x)*18/length-head.x)*neckSpring;
  head.y += (neck.y+(neck.y-hip.y)*18/length-head.y)*neckSpring;
  for (let pass = 0; pass < 14; pass++) {
    for (const [ai, bi, length] of JOINTS) {
      const a = rig[ai], b = rig[bi], dx = b.x-a.x, dy = b.y-a.y;
      const d = Math.hypot(dx,dy) || 1, sum = mass[ai]+mass[bi];
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
    for (let i = 0; i < rig.length; i++) {
      if ((i === 4 || i === 6) && i!==free) continue;
      collidePoint(rig[i], collision, i === 0 ? 10 : 3,
        pass === 0 ? origins[i] : rig[i], contacts[i]);
    }
    for (const [i, index] of [4, 6].entries()) {
      if(index===free)continue;
      rig[index].x = grips[i].x; rig[index].y = grips[i].y;
    }
    if(sitting>0) {
      hip.x+=(p.hangX-hip.x)*.45*sitting;
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
}
