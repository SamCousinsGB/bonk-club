import { meleePose } from "./melee-pose.js";
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
  if (!p.rig) p.rig = makeRig(p);
  if(p.knockdown>0)return;
  if(p.freeze>0 && p.freezePose) {
    p.rig=p.freezePose.map(q=>({x:p.x+q.x,y:p.y+q.y,px:p.x+q.x,py:p.y+q.y}));
    return;
  }
  const rig = p.rig,
    prone = !!p.prone;
  const desired = prone ? p.facing * 1.5 : clamp(p.vx * 0.00065, -0.27, 0.27);
  let a = p.bodyAngle || 0,
    av = p.angularVelocity || 0;
  const strength = p.stun > 0 ? 8 : prone ? 36 : p.ground ? 100 : 35;
  av += (Math.sin(desired - a) * strength - av * (p.stun > 0 ? 1.2 : 7)) * dt;
  a += av * dt;
  p.bodyAngle = a;
  p.angularVelocity = av;
  const rotate = ([x, y]) => [
    p.x + x * Math.cos(a) - y * Math.sin(a),
    p.y + x * Math.sin(a) + y * Math.cos(a),
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
  if (p.block) {
    handA = [neck[0] + dx * 29 - dy * 10, neck[1] + dy * 29 + dx * 10];
    handB = [neck[0] + dx * 28 + dy * 8, neck[1] + dy * 28 - dx * 8];
  } else if (melee) {
    // Drive both hands around the shoulder; the joints still respond to impacts.
    handB = [neck[0] + Math.cos(melee.armAngle) * 32,
      neck[1] + Math.sin(melee.armAngle) * 32];
    handA = [handB[0] - Math.cos(melee.angle) * 9,
      handB[1] - Math.sin(melee.angle) * 9];
  } else if (p.weapon) {
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
          ? 0.045
          : i < 3
            ? 0.23
            : i === 4 || i === 6
              ? 0.1
              : i >= 7 && p.ground
                ? 0.16
                : 0.065;
    q.x += (targets[i][0] - q.x) * motor;
    q.y += (targets[i][1] - q.y) * motor;
  }
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
    rig[2].x += (hip[0] - rig[2].x) * 0.65;
    rig[2].y += (hip[1] - rig[2].y) * 0.65;
    for (let i = 0; i < rig.length; i++) {
      const q = rig[i],
        radius = i === 0 ? 10 : 3;
      for (const s of platforms) {
        if (q.x < s.x || q.x > s.x + s.w) continue;
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
