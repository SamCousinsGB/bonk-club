import { JOINTS, makeRig } from "./puppet.js";
import { seedOrbit, orbitPoint, limitRope, springRope } from "./orbit.js";
import { collidePoint } from "./body-physics.js";

export function bodyStrands(points) {
  return JOINTS.map(([a, b, length]) => ({
    rest: length / 5,
    points: Array.from({ length: 6 }, (_, i) => i === 0 ? points[a] : i === 5 ? points[b] : {
      x: points[a].x + (points[b].x - points[a].x) * i / 5,
      y: points[a].y + (points[b].y - points[a].y) * i / 5,
      px: points[a].px + (points[b].px - points[a].px) * i / 5,
      py: points[a].py + (points[b].py - points[a].py) * i / 5,
    }),
  }));
}

export function captureFighter(p, f) {
  p.rig ||= makeRig(p);
  p.strands ||= bodyStrands(p.rig);
  p.capturedBy = f.riftId;
  p.targetX = f.x; p.targetY = f.y;
  p.captureAge = 0;
  p.knockdown = 1;
  p.block = false; p.swing = 0; p.freeze = 0; p.bubble = 0;
  p.prone = false; p.ground = false; p.support = null; p.jumpBuffer = 0;
  for (const q of new Set(p.strands.flatMap(s => s.points))) {
    seedOrbit(q, f, .45);
    // Off-centre capture twists the body and leaves hands/feet with their own
    // momentum. No pose motor is active while a fighter is captured.
    q.px += (q.y - p.y) * 4 / 120;
    q.py -= (q.x - p.x) * 4 / 120;
  }
}

// Every point follows the flow and collides, including the intermediate points
// along a limb. Shared endpoints keep the body connected as tidal shear curls it.
export function orbitBody(strands, center, solids, dt, drift = .45) {
  const points = [...new Set(strands.flatMap(s => s.points))];
  const origins = points.map(q => ({ x: q.x, y: q.y }));
  const carried = points.map(() => new Set());
  const left = Math.min(...points.map(q=>q.x))-35, right = Math.max(...points.map(q=>q.x))+35,
    top = Math.min(...points.map(q=>q.y))-35, bottom = Math.max(...points.map(q=>q.y))+35;
  const near = solids.filter(s => s.hp !== 0 && right>s.x && left<s.x+s.w && bottom>s.y && top<s.y+s.h);
  const cx = points.reduce((n,q)=>n+q.x,0)/points.length, cy = points.reduce((n,q)=>n+q.y,0)/points.length,
    distance = Math.max(1,Math.hypot(cx-center.x,cy-center.y)), nx=(cx-center.x)/distance, ny=(cy-center.y)/distance;
  for (const s of strands) springRope(s.points, s.rest, dt);
  for (const q of points) {
    // Differential acceleration across the body stretches the nearer limbs
    // toward the hole and the far side outward; orbit shear bends that strand.
    const tide = Math.max(-80,Math.min(80,(q.x-cx)*nx+(q.y-cy)*ny))*7;
    // Small eddies act differently along each limb. Tension and contacts still
    // resolve the resulting motion; this never assigns a bend angle or pose.
    const eddy = Math.sin((center.age || 0)*14 + q.x*.085 + q.y*.055)*1350;
    q.px -= (nx*tide - ny*eddy)*dt*dt;
    q.py -= (ny*tide + nx*eddy)*dt*dt;
    orbitPoint(q, center, dt, drift, center.life > 1.1 ? 180 : 0);
  }
  for (let n = 0; n < 3; n++) {
    for (const s of strands) limitRope(s.points, s.rest, 5);
    for (let i = 0; i < points.length; i++)
      collidePoint(points[i], near, i === 0 ? 9 : 2.5, origins[i], carried[i]);
  }
}

export function moveCaptured(p, world, solids, dt) {
  if (!p.capturedBy) return false;
  const f = world.fields.find(f => f.kind === "blackhole" && f.riftId === p.capturedBy && f.life > 0);
  if (!f) {
    delete p.capturedBy; delete p.strands;
    p.knockdown = .5;
    p.ragVx = p.vx; p.ragVy = p.vy;
    return false;
  }
  const x = p.x, y = p.y;
  p.captureAge += dt;
  p.knockdown = 1;
  p.stun = .05; p.block = false; p.swing = 0;
  orbitBody(p.strands, f, solids, dt, f.life < 1.1 ? 5 : .45);
  p.x = p.rig[2].x; p.y = p.rig[2].y;
  p.vx = p.ragVx = Math.max(-1800, Math.min(1800, (p.x - x) / dt));
  p.vy = p.ragVy = Math.max(-1500, Math.min(1500, (p.y - y) / dt));
  p.ground = false; p.support = null;
  return true;
}
