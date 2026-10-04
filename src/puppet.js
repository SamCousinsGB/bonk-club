import { meleePose } from "./melee-pose.js";
import { collidePoint } from "./body-physics.js";
import { curlRotation, movementShape } from "./curl.js";
// An active ragdoll: eleven Verlet particles, ten distance joints and spring motors.
// Motors suggest a pose; inertia, joints, impacts and ground contacts determine it.
export const JOINTS = [
  [0, 1, 18],
  [1, 2, 23],
  [1, 3, 17],
  [3, 4, 19],
  [1, 5, 17],
  [5, 6, 19],
  [2, 7, 18],
  [7, 8, 19],
  [2, 9, 18],
  [9, 10, 19],
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function makeRig(p) {
  return [
    [0, -33],
    [0, -15],
    [0, 8],
    [-14, -2],
    [-20, 13],
    [14, -2],
    [20, 13],
    [-10, 22],
    [-15, 34],
    [10, 22],
    [15, 34],
  ].map(([x, y]) => ({
    x: p.x + x,
    y: p.y + y,
    px: p.x + x - p.vx / 120,
    py: p.y + y - p.vy / 120,
  }));
}
export function impulseRig(p, x, y, vx, vy) {
  if (!p.rig) p.rig = makeRig(p);
  for (const point of p.rig) {
    const influence =
      0.35 + 0.65 * Math.exp(-Math.hypot(point.x - x, point.y - y) / 40);
    point.px -= (vx / 120) * influence;
    point.py -= (vy / 120) * influence;
  }
  p.angularVelocity = (p.angularVelocity || 0) + clamp(vx * 0.009, -10, 10);
}
function elbow(a, b, l1, l2, side) {
  let dx = b[0] - a[0],
    dy = b[1] - a[1],
    d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01) || 1;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
    height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  return [
    a[0] + dx * along - dy * height * side,
    a[1] + dy * along + dx * height * side,
  ];
}
export function updateRig(p, dt, platforms, time) {
  if (p.dropThrough > 0) platforms = platforms.filter(s => !s.oneWay && s.material !== "cable");
  if (!p.rig) p.rig = makeRig(p);
  if(p.knockdown>0 || p.hangSupport)return;
  if(p.freeze>0 && p.freezePose) {
    p.rig=p.freezePose.map(q=>({x:p.x+q.x,y:p.y+q.y,px:p.x+q.x,py:p.y+q.y}));
    return;
  }
  if (p.curl) { updateCurlRig(p, dt, platforms); return; }
  p.curlRecovery = Math.max(0, (p.curlRecovery || 0) - dt);
  const unfold = 1 - p.curlRecovery / .18;
  const rig = p.rig,
    prone = !!p.prone;
  const desired = p.swimming && !p.ground ? (p.swimStroke ? (p.aimAngle??0)+Math.PI/2 : clamp(p.vx*.003,-.8,.8)) : prone ? p.facing * 1.5 : clamp(p.vx * 0.00065, -0.27, 0.27);
  let a = p.bodyAngle || 0,
    av = p.angularVelocity || 0;
  const strength = p.stun > 0 ? 8 : prone ? 150 : p.ground ? 100 : 35;
  av += (Math.sin(desired - a) * strength - av * (p.stun > 0 ? 1.2 : 7)) * dt;
  a += av * dt;
  p.bodyAngle = a;
  p.angularVelocity = av;
  const cos = Math.cos(a), sin = Math.sin(a);
  const rotate = ([x, y]) => [
    p.x + x * cos - y * sin,
    p.y + x * sin + y * cos,
  ];
  const compression = clamp(p.landing || 0, 0, 1) * 9;
  p.landing = Math.max(0, (p.landing || 0) - dt * 5);
  const speed = clamp(p.gaitSpeed || 0, 0, 1),
    stride = Math.sin(p.walk);
  // Leave enough leg reach for a full stride while keeping the torso upright.
  const bounce = p.ground && !prone ? speed * (5 + Math.cos(p.walk * 2) * 2) : 0;
  const hip = rotate([0, -4 + compression + bounce]),
    neck = rotate([0, -27 + compression + bounce]),
    head = rotate([p.facing * 1.5, -45 + compression + bounce]);
  let footA, footB;
  if (prone) {
    footA = rotate([-9, 33]);
    footB = rotate([10, 32]);
  } else if (p.ground) {
    // Half a cycle plants the foot as the hip passes over it; the other half
    // brings a lifted foot forward. Opposite phases give clear alternating steps.
    const foot = (phase, rest) => {
      const t = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
      const swing = Math.max(0, (t - 0.5) * 2);
      const ease = swing * swing * (3 - 2 * swing);
      const x = t < 0.5 ? 25 - t * 100 : -25 + ease * 50;
      return [p.x + rest * (1 - speed) + x * speed,
        p.y + 27 - Math.sin(swing * Math.PI) ** 2 * 23 * speed];
    };
    footA = foot(p.walk, -9);
    footB = foot(p.walk + Math.PI, 9);
  } else if(p.swimming) {
    const kick=Math.sin(time*8+p.id)*11;
    footA=rotate([-10+kick,27]);footB=rotate([10-kick,30]);
  } else {
    // Tuck during ascent, then extend for landing. Vertical motion, rather than
    // a wall-clock sine, determines the airborne pose.
    const tuck = clamp(-p.vy / 600, 0, 1);
    const fall = clamp(p.vy / 750, 0, 1);
    const drift = clamp(p.vx * 0.022, -16, 16);
    footA = rotate([-12 - drift, 22 - tuck * 20 + fall * 5]);
    footB = rotate([13 - drift * 0.6, 25 - tuck * 11 + fall * 3]);
  }
  const angle = p.aimAngle ?? (p.facing === 1 ? 0 : Math.PI),
    dx = Math.cos(angle),
    dy = Math.sin(angle);
  const progress = p.swing > 0 ? 1 - p.swing / (p.swingDuration || 0.22) : 0;
  const swing = p.swing > 0 ? Math.sin(progress * Math.PI) : 0;
  const kick = p.swing > 0 && p.meleeMove === "kick";
  const spin = p.swing > 0 && p.meleeMove === "spin";
  if (kick)
    footB = [
      hip[0] + dx * 36 * swing,
      hip[1] + dy * 36 * swing + 26 * (1 - swing),
    ];
  if (spin) {
    const turn = angle + progress * Math.PI * 2;
    footB = [hip[0] + Math.cos(turn) * 37, hip[1] + Math.sin(turn) * 26];
    footA = [hip[0] - Math.cos(turn) * 26, hip[1] + 25];
  }
  let handA, handB;
  const melee = meleePose(p);
  if (p.carryId && p.carryPoint) {
    const gx = p.carryPoint.x - neck[0], gy = p.carryPoint.y - neck[1];
    const reach = Math.min(1, 35 / (Math.hypot(gx, gy) || 1));
    handA = [neck[0] + gx * reach, neck[1] + gy * reach - 6];
    handB = [neck[0] + gx * reach, neck[1] + gy * reach + 6];
  } else if(p.swimming && p.swimStroke) {
    const stroke=time*7+p.id;
    handA=rotate([-25+Math.sin(stroke)*12,-16-Math.cos(stroke)*19]);
    handB=rotate([25-Math.sin(stroke)*12,-16+Math.cos(stroke)*19]);
  } else if (p.block) {
    handA = [neck[0] + dx * 29 - dy * 10, neck[1] + dy * 29 + dx * 10];
    handB = [neck[0] + dx * 28 + dy * 8, neck[1] + dy * 28 - dx * 8];
  } else if (melee) {
    // Drive both hands around the shoulder; the joints still respond to impacts.
    handB = [neck[0] + Math.cos(melee.armAngle) * 32,
      neck[1] + Math.sin(melee.armAngle) * 32];
    handA = [handB[0] - Math.cos(melee.angle) * 9,
      handB[1] - Math.sin(melee.angle) * 9];
  } else if (p.weapon && p.weapon !== "powerfist") {
    handA = [neck[0] + dx * 29 - dy * 5, neck[1] + dy * 29 + dx * 5];
    handB = [neck[0] + dx * (32 + swing * 4), neck[1] + dy * (32 + swing * 4)];
  } else {
    const runningA = rotate([-stride * 22, -5 + Math.abs(stride) * 4]);
    const runningB = rotate([stride * 22, -5 + Math.abs(stride) * 4]);
    const restA = rotate([-p.facing * 13, 7 + Math.cos(time * 3 + p.id) * 2]);
    const restB = [
      neck[0] + dx * (18 + (kick || spin ? 0 : swing * 20)),
      neck[1] + dy * (18 + (kick || spin ? 0 : swing * 20)) + 10 * (1 - swing),
    ];
    const armRun = p.ground && !prone && p.swing <= 0 ? speed : 0;
    handA = restA.map((v, i) => v + (runningA[i] - v) * armRun);
    handB = restB.map((v, i) => v + (runningB[i] - v) * armRun);
  }
  const targets = [
    head,
    neck,
    hip,
    elbow(neck, handA, 17, 19, p.facing),
    handA,
    elbow(neck, handB, 17, 19, -p.facing),
    handB,
    elbow(hip, footA, 18, 19, speed > 0.1 ? -p.facing : 1),
    footA,
    elbow(hip, footB, 18, 19, speed > 0.1 ? -p.facing : -1),
    footB,
  ];
  for (let i = 0; i < rig.length; i++) {
    const q = rig[i],
      vx = (q.x - q.px) * 0.9,
      vy = (q.y - q.py) * 0.9;
    q.px = q.x;
    q.py = q.y;
    q.x += vx;
    q.y += vy + 1250 * dt * dt;
    const motor =
      p.stun > 0
        ? 0.012
        : prone
          ? 0.14
          : i < 3
            ? 0.23
            : i === 4 || i === 6
              ? p.carryId ? 0.38 : 0.1
              : i >= 7 && p.ground
                ? 0.16
                : 0.065;
    q.x += (targets[i][0] - q.x) * motor * unfold;
    q.y += (targets[i][1] - q.y) * motor * unfold;
  }
  const nearby = [], { top, bottom } = movementShape(p);
  for (let n = 0; n < 7; n++) {
    for (const [ai, bi, len] of JOINTS) {
      const a = rig[ai],
        b = rig[bi],
        dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy) || 1,
        correction = ((d - len) / d) * 0.5;
      a.x += dx * correction;
      a.y += dy * correction;
      b.x -= dx * correction;
      b.y -= dy * correction;
    }
    rig[2].x += (hip[0] - rig[2].x) * 0.65 * unfold;
    rig[2].y += (hip[1] - rig[2].y) * 0.65 * unfold;
    // Contacts only change y. Select the exact horizontal candidates again
    // after each joint pass, retaining platform order and every solver pass.
    let left = Infinity, right = -Infinity;
    for (const q of rig) { left = Math.min(left, q.x); right = Math.max(right, q.x); }
    nearby.length = 0;
    for (const s of platforms) if (s.x <= right && s.x + s.w >= left) nearby.push(s);
    for (let i = 0; i < rig.length; i++) {
      const q = rig[i],
        radius = i === 0 ? 10 : 3;
      for (const s of nearby) {
        if (q.x < s.x || q.x > s.x + s.w) continue;
        // A limb clearing a ledge is not a landing. Until the gameplay body's
        // feet clear its top, jump-through floors must let the whole rig pass
        // back down too; otherwise they pin the head above a falling torso.
        if (p.y + bottom > s.y + 3) {
          if (!s.oneWay && s.material !== "cable" &&
              p.y - top >= s.y + s.h - 3 && q.y - radius < s.y + s.h) {
            q.y = s.y + s.h + radius;
            q.py = Math.min(q.py, q.y);
          }
          continue;
        }
        if (
          q.py + radius <= s.y + 12 &&
          q.y + radius > s.y &&
          q.y < s.y + s.h
        ) {
          q.y = s.y - radius;
          q.px = q.x - (q.x - q.px) * 0.55;
          q.py = q.y + (q.y - q.py) * 0.15;
        }
      }
    }
  }
  // Keep extreme impulses from separating a puppet from its gameplay body.
  for (const q of rig) {
    if (Math.hypot(q.x - p.x, q.y - p.y) > 145) {
      q.x = p.x + (q.x - p.x) * 0.6;
      q.y = p.y + (q.y - p.y) * 0.6;
      q.px = q.x;
      q.py = q.y;
    }
  }
}

// Muscle-driven tuck, with separate head, arms and bent legs. Springs fold the
// existing particles into the pose without resetting their velocities. Contacts
// and distance joints can still bend/displace each limb independently.
const curlScratch = new WeakMap();
function updateCurlRig(p, dt, platforms) {
  curlRotation(p, dt);
  const rig = p.rig, f = p.facing, a = p.bodyAngle;
  const c = Math.cos(a), s = Math.sin(a);
  const rotate = ([x,y]) => [p.x+x*f*c-y*s, p.y+x*f*s+y*c];
  const head = rotate([7,-13]), neck = rotate([-10,-7]), hip = rotate([-8,16]);
  const footA = rotate([14,-1]), footB = rotate([20,7]);
  const handA = rotate([15,3]), handB = rotate([17,11]);
  const targets = [head,neck,hip,elbow(neck,handA,17,19,-f),handA,
    elbow(neck,handB,17,19,-f),handB,
    elbow(hip,footA,18,19,f),footA,elbow(hip,footB,18,19,f),footB];
  let work = curlScratch.get(rig);
  if (!work) {
    work = {origins:rig.map(()=>({x:0,y:0})), contacts:rig.map(()=>new Set())};
    curlScratch.set(rig,work);
  }
  for (const [i,q] of rig.entries()) {
    const origin=work.origins[i]; origin.x=q.x;origin.y=q.y;work.contacts[i].clear();
    const vx=(q.x-q.px)*.84,vy=(q.y-q.py)*.84;
    q.px=q.x;q.py=q.y;q.x+=vx;q.y+=vy+1800*dt*dt;
    const motor=1-Math.exp(-(i<3?29:23)*dt);
    q.x+=(targets[i][0]-q.x)*motor;q.y+=(targets[i][1]-q.y)*motor;
  }
  // Jump-through floors only catch limbs approaching their upper face.
  const nearby=platforms.filter(b => b.x<p.x+85 && b.x+b.w>p.x-85 && b.y<p.y+85 && b.y+b.h>p.y-85);
  const collisions=rig.map((q,i)=>nearby.filter(b => !b.oneWay && b.material!=='cable' ||
    work.origins[i].y+(i===0?10:3)<=b.y+3 && p.vy>=0));
  for(let pass=0;pass<7;pass++) {
    for(const [ai,bi,length] of JOINTS) {
      const q=rig[ai],r=rig[bi],dx=r.x-q.x,dy=r.y-q.y;
      const d=Math.hypot(dx,dy)||1,k=(d-length)/d*.5;
      q.x+=dx*k;q.y+=dy*k;r.x-=dx*k;r.y-=dy*k;
    }
    for(const [i,q] of rig.entries()) {
      const radius=i===0?10:3,origin=work.origins[i];
      collidePoint(q,collisions[i],radius,pass===0?origin:q,work.contacts[i]);
    }
  }
}
export function collideRigs(a, b) {
  if (
    !a.rig ||
    !b.rig ||
    !a.alive ||
    !b.alive ||
    Math.hypot(a.x - b.x, a.y - b.y) > 110
  )
    return;
  for (let i = 0; i < a.rig.length; i++)
    for (let j = 0; j < b.rig.length; j++) {
      const p = a.rig[i],
        q = b.rig[j],
        dx = q.x - p.x,
        dy = q.y - p.y,
        d = Math.hypot(dx, dy) || 0.01,
        r = (i === 0 ? 10 : 3) + (j === 0 ? 10 : 3);
      if (d < r) {
        const force = (r - d) * 0.5;
        p.x -= (dx / d) * force;
        p.y -= (dy / d) * force;
        q.x += (dx / d) * force;
        q.y += (dy / d) * force;
      }
    }
}
