import { segmentBox } from "./collision.js";
import { carryImpulse } from "./impact.js";
import { impulseProp } from "./props.js";

export const PLANE = Object.freeze({ x: 1280, y: 710, rx: 830, ry: 594, innerX: 790, innerY: 550, radius: 520 });
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Collision strips enclose a continuous pressure vessel. Drawing uses these same
// surviving strips, so bullets and circular cuts open real passages to the sky.
export function planeHull() {
  const out = [], { x, y, rx, ry, innerX, innerY } = PLANE;
  for (let top = y - ry; top < y + ry; top += 12) {
    const bottom = Math.min(y + ry, top + 12);
    const near = Math.max(0, top - y, y - bottom);
    const far = Math.max(Math.abs(top - y), Math.abs(bottom - y));
    const outer = rx * Math.sqrt(Math.max(0, 1 - (near / ry) ** 2));
    const inner = innerX * Math.sqrt(Math.max(0, 1 - (far / innerY) ** 2));
    for (const side of [-1, 1]) out.push({
      x: side < 0 ? x - outer : x + inner, y: top, w: outer - inner, h: bottom - top,
      material: "metal", planeHull: true, boundary: top < 1170, destructible: true, panel: "metal", hp: 100, maxHp: 100,
    });
  }
  return out;
}

export function planeRoll(age, flight) {
  const at = flight?.failedAt ?? -1, t = at < 0 ? 0 : Math.max(0, age-at);
  // Continuous acceleration into a sustained roll. No orientation wrap at PI.
  const dir = flight?.rollDir || 1, ease = Math.exp(-t / 1.4);
  return { angle: dir * 1.55 * (t - 1.4 * (1-ease)),
    omega: dir * 1.55 * (1-ease), alpha: t > 0 ? dir * 1.55 / 1.4 * ease : 0,
    amount: 1-ease };
}

export function planePose(age, reduced = false, flight) {
  const roll=planeRoll(age,flight);
  const bank = .065 * Math.sin(age * .73) + .022 * Math.sin(age * 2.17);
  const angle=(reduced ? bank*.2 : bank)+roll.angle;
  // The camera follows the falling aircraft, keeping its cabin on screen even
  // when vertical. Wings deliberately extend outside this fixed arena view.
  return { angle, x: reduced ? 0 : 22*Math.sin(age*.87)+roll.amount*35*Math.sin(roll.angle),
    y: reduced ? 0 : 17*Math.sin(age*1.61)+roll.amount*24*Math.cos(roll.angle),
    scale: .94-roll.amount*(.10+.08*Math.sin(angle)**2) };
}

export function planeLocalPoint(point, age, reduced = false, flight) {
  const pose = planePose(age, reduced, flight), c = Math.cos(pose.angle), s = Math.sin(pose.angle);
  const x = (point.x - PLANE.x - pose.x) / pose.scale, y = (point.y - PLANE.y - pose.y) / pose.scale;
  return { x: PLANE.x + x * c + y * s, y: PLANE.y - x * s + y * c };
}

// Breaches are derived from collision, never trusted as a separate guest field.
// Sampling radial passages also distinguishes a dent from a through-hull cut.
export function planeBreaches(platforms) {
  const hull = platforms.filter(p => p.planeHull && p.hp !== 0);
  if (!platforms.some(p => p.planeHull)) return [];
  const openings = [];
  for (let i = 0; i < 128; i++) {
    const a = i * TAU / 128, c = Math.cos(a), s = Math.sin(a);
    const inner = { x: PLANE.x + c * (PLANE.innerX - 35), y: PLANE.y + s * (PLANE.innerY - 35) };
    const outer = { x: PLANE.x + c * (PLANE.rx + 35), y: PLANE.y + s * (PLANE.ry + 35) };
    if (!hull.some(p => segmentBox(inner.x, inner.y, outer.x, outer.y, p))) openings.push(i);
  }
  const groups = [];
  for (const i of openings) {
    const last = groups.at(-1);
    if (last && last.at(-1) === i - 1) last.push(i); else groups.push([i]);
  }
  if (groups.length > 1 && groups[0][0] === 0 && groups.at(-1).at(-1) === 127) {
    const end = groups.pop(); groups[0] = [...end.map(i => i - 128), ...groups[0]];
  }
  return groups.slice(0, 16).map(g => {
    // Use an actually open ray, not the average of a curved opening.
    const a = g[Math.floor(g.length / 2)] * TAU / 128, c = Math.cos(a), s = Math.sin(a);
    return { x: PLANE.x + c * (PLANE.rx - 12), y: PLANE.y + s * (PLANE.ry - 12),
      nx: c, ny: s, radius: PLANE.radius, width: Math.min(230, 32 + g.length * 24) };
  });
}

const cache = new WeakMap();
export const planeHullKey = platforms => platforms.filter(p=>p.planeHull&&p.hp!==0).map(p=>`${p.x},${p.y},${p.w},${p.h}`).join(";");
const breachCache=new Map();
export function cachedPlaneBreaches(platforms) {
  const key=planeHullKey(platforms);
  if(!breachCache.has(key)) {
    if(breachCache.size>=4)breachCache.delete(breachCache.keys().next().value);
    breachCache.set(key,planeBreaches(platforms));
  }
  return breachCache.get(key);
}
export function worldBreaches(world) {
  let entry = cache.get(world);
  if (!entry || entry.version !== world.terrainVersion || entry.platforms !== world.platforms) {
    entry = { version: world.terrainVersion, platforms: world.platforms, breaches: cachedPlaneBreaches(world.platforms) };
    cache.set(world, entry);
  }
  return entry.breaches;
}

export function breachForce(point, breaches, hull) {
  let ax = 0, ay = 0;
  for (const b of breaches) {
    const dx = b.x - point.x, dy = b.y - point.y, d = Math.hypot(dx, dy);
    if (d >= b.radius) continue;
    // No force through the surviving opposite wall of a narrow opening.
    if (hull.some(p => p.hp !== 0 && segmentBox(point.x, point.y, b.x, b.y, p))) continue;
    const outside = (point.x - b.x) * b.nx + (point.y - b.y) * b.ny > -25;
    const strength = 8500 * (1 - d / b.radius) ** 1.25;
    ax += (outside ? b.nx : dx / Math.max(1, d)) * strength;
    ay += (outside ? b.ny : dy / Math.max(1, d)) * strength;
  }
  const length = Math.hypot(ax, ay), limit = Math.min(1, 10500 / (length || 1));
  return { x: ax * limit, y: ay * limit };
}

export function planeForces(age, flight) {
  const roll=planeRoll(age,flight), pose=planePose(age,false,flight);
  return {omega: .065*.73*Math.cos(age*.73)+.022*2.17*Math.cos(age*2.17)+roll.omega,
    alpha: -.065*.73**2*Math.sin(age*.73)-.022*2.17**2*Math.sin(age*2.17)+roll.alpha,
    x:1500*Math.sin(pose.angle)+22*.87**2*Math.sin(age*.87),
    y:1500*(Math.cos(pose.angle)-1)+17*1.61**2*Math.sin(age*1.61)};
}
export function turbulenceForce(point, age, flight, frame=planeForces(age,flight)) {
  const {omega,alpha}=frame;
  const x = point.x - PLANE.x, y = point.y - PLANE.y;
  return { x: frame.x + alpha*y+omega*omega*x, y:frame.y-alpha*x+omega*omega*y };
}

export function updatePlane(world, h, dt) {
  if (!h || world.prediction) return;
  h.age += dt;
  if(world.arena.cargoPlane)updatePlaneWings(world,h);
  const frame=planeForces(h.age,h);
  const breaches = worldBreaches(world), hull = world.platforms.filter(p => p.planeHull);
  const wasActive = h.active;
  h.active = breaches.length > 0; h.warning = 0;
  h.bodyX = breaches[0]?.x ?? PLANE.x; h.bodyY = breaches[0]?.y ?? PLANE.y;
  if (h.active && !wasActive) world.event("hazard", { x: h.bodyX, y: h.bodyY, kind: "airflow" });
  const force = p => {
    const bank = turbulenceForce(p, h.age,h,frame), air = breachForce(p, breaches, hull);
    return { x: bank.x + air.x, y: bank.y + air.y, air: Math.hypot(air.x, air.y) };
  };
  for (const p of world.players) if (p.alive) applyPlanePlayer(p, h.age, breaches, hull, dt,h,frame);
  for (const b of [...world.cover, ...world.chunks]) if (b.hp > 0) {
    const f = force({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    if (b.strapped && f.air > 700) {
      b.strapHp = Math.max(0, b.strapHp - dt * f.air / 55);
      if (!b.strapHp) { b.strapped = false; world.event("break", { x: b.x, y: b.y, color: "#e2b75e" }); }
    }
    impulseProp(b, f.x * b.mass * dt, f.y * b.mass * dt);
  }
  for (const list of [world.drops, world.projectiles, world.debris, world.blood, world.gas]) {
    for (const p of list || []) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const f = force(p);
      if (Number.isFinite(p.vx) && Number.isFinite(p.vy)) {
        p.vx += f.x * dt; p.vy += f.y * dt;
        // Existing snapshot bounds apply to drops and finite fluid particles.
        if (list !== world.projectiles) {
          const limit = list === world.gas ? 500 : 1500;
          p.vx = clamp(p.vx, -limit, limit); p.vy = clamp(p.vy, -limit, limit);
        }
      } else if (f.air > 0) { p.x += f.x * dt * dt; p.y += f.y * dt * dt; }
    }
  }
  for (const list of [world.water, world.spills]) for (const p of list) {
    if (p.frozen > 0) continue;
    const f = breachForce({x:p.x+p.w/2,y:p.y+p.h/2},breaches,hull);
    if (Math.hypot(f.x,f.y)<100) continue;
    p.x += f.x * .12 * dt; p.y += f.y * .12 * dt;
    p.grounded=false; p.vy=clamp(p.vy+f.y*dt,0,1000);
  }
  world.water=world.water.filter(p=>p.x>=0&&p.x<=2528&&p.y>=-200&&p.y<=1590);
  world.spills=world.spills.filter(p=>p.x>=0&&p.x<=2528&&p.y>=-200&&p.y<=1590);
  for (const rag of world.ragdolls) for (const p of rag.points || []) {
    const f = force(p); p.px -= f.x * dt * dt; p.py -= f.y * dt * dt;
  }
  for (const b of world.wreckage) {
    const f = force(b);
    if (Number.isFinite(b.vx)) b.vx = clamp(b.vx + f.x * dt, -1500, 1500);
    if (Number.isFinite(b.vy)) b.vy = clamp(b.vy + f.y * dt, -1500, 1500);
  }
}

export function applyPlanePlayer(p, age, breaches, hull, dt, flight, frame) {
  const bank = turbulenceForce(p, age,flight,frame), air = breachForce(p, breaches, hull);
  const x = bank.x + air.x, y = bank.y + air.y;
  p.vx += x * dt; p.vy += y * dt;
  if (p.knockdown > 0) for (const q of p.rig || []) { q.px -= x * dt * dt; q.py -= y * dt * dt; }
  if (Math.hypot(air.x, air.y) > 100 || bank.y < -1500) { carryImpulse(p, .2); p.ground = false; p.support = null; }
}

export function planeWings() {
  return [-1,1].flatMap(side=>[[170,320,96],[-600,770,68],[-1500,900,38]].map(([x,w,h])=>({
    x:side<0?x:2560-x-w,y:700,w,h,material:"metal",planeWing:side,
    boundary:true,
  })));
}
const touches=(a,b)=>a.x<=b.x+b.w+.05&&a.x+a.w>=b.x-.05&&a.y<=b.y+b.h+.05&&a.y+a.h>=b.y-.05;
const wingChecks=new WeakMap();
function updatePlaneWings(world,h) {
  if(h.failedAt===undefined)Object.assign(h,{failedAt:-1,rollDir:1,leftWingAt:-1,rightWingAt:-1});
  // Props change the navigation revision frequently; only airframe topology
  // invalidates the structural search. A dent retains connectivity.
  const key=world.platforms.filter(p=>(p.planeHull||p.planeWing)&&!p.wingLoose&&p.hp!==0)
    .map(p=>`${p.id}:${p.x},${p.y},${p.w},${p.h}`).join(";");
  if(wingChecks.get(world)===key)return;
  wingChecks.set(world,key);
  const hull=world.platforms.filter(p=>p.planeHull&&p.hp!==0);
  // A loose island of hull plating is not a fuselage attachment. Trace back to
  // the central crown/keel so cuts around a mounting can sever it too.
  const anchored=new Set(hull.filter(p=>p.x<1780&&p.x+p.w>780));
  const hullQueue=[...anchored];
  for(let i=0;i<hullQueue.length;i++)for(const p of hull)if(!anchored.has(p)&&touches(hullQueue[i],p)){anchored.add(p);hullQueue.push(p);}
  for(const side of [-1,1]) {
    const wings=world.platforms.filter(p=>p.planeWing===side&&!p.wingLoose&&p.hp!==0);
    const attached=new Set(wings.filter(p=>hullQueue.some(q=>touches(p,q))));
    const queue=[...attached];
    for(let i=0;i<queue.length;i++)for(const p of wings)if(!attached.has(p)&&touches(queue[i],p)){attached.add(p);queue.push(p);}
    const loose=wings.filter(p=>!attached.has(p));
    if(!loose.length)continue;
    const field=side<0?"leftWingAt":"rightWingAt";
    if(h[field]<0)h[field]=h.age;
    if(h.failedAt<0) { h.failedAt=h.age;h.rollDir=side;world.event("break",{x:side<0?470:2090,y:745,color:"#d6e1df"}); }
    for(const p of loose) {p.wingLoose=true;p.wingAt=h.age;}
    for(const engine of world.hazards.filter(e=>e.type==="turbine"&&e.planeWing===side&&!e.done&&!e.wingLoose)) {
      if(![...attached].some(p=>p.x<=engine.x&&p.x+p.w>=engine.x)) {
        engine.wingLoose=true;engine.wingAt=h.age;
      }
    }
    world.terrainVersion++;
  }
}

export function wingFall(age,at,side) {
  const t=Math.max(0,age-at);
  return {x:side*200*t,y:Math.min(3000,100*t+280*t*t)};
}

// Falling wing sections remain collision surfaces until they leave the arena.
// Incremental offsets preserve new blast cuts on an already falling wing.
export function movePlaneWings(world,age) {
  if(!world.platforms.some(p=>p.wingLoose)&&!world.hazards.some(h=>h.wingLoose&&!h.done))return;
  for(const p of world.platforms)if(p.wingLoose&&p.hp!==0) {
    const offset=wingFall(age,p.wingAt,p.planeWing);
    const dx=offset.x-(p.wingX||0),dy=offset.y-(p.wingY||0);
    p.x+=dx;p.y+=dy;p.dx=dx;p.dy=dy;p.wingX=offset.x;p.wingY=offset.y;
  }
  world.platforms=world.platforms.filter(p=>!p.wingLoose||p.y<3200);
  for(const h of world.hazards)if(h.type==="turbine"&&h.wingLoose&&!h.done) {
    const offset=wingFall(age,h.wingAt,h.planeWing);
    h.bodyX=h.x+offset.x;h.bodyY=h.y-30+offset.y;
    if(h.bodyY>3200){h.done=true;h.active=false;}
  }
}
