import { H, W } from "./scale.js";
import { playerBox } from "./collision.js";
import { carryImpulse } from "./impact.js";
import { knockDown } from "./knockdown.js";
import { propFragments } from "./prop-fracture.js";

// Mass is relative to a 55 kg fighter. Surface friction and inertia, rather than
// a movement clamp, determine how far a hit moves furniture and loose rubble.
export const PROP_TYPES = {
  table:   { mass: 28, material: "wood" },
  crate:   { mass: 36, material: "wood" },
  log:     { mass: 65, material: "wood" },
  stone:   { mass: 180, material: "stone" },
  sofa:    { mass: 85, material: "fabric" },
  bed:     { mass: 70, material: "metal" },
  cabinet: { mass: 58, material: "metal" },
  barrel:  { mass: 48, material: "metal" },
  canister: { mass: 32, material: "metal" },
  oilBarrel: { mass: 60, material: "metal" },
  glueBarrel: { mass: 72, material: "metal" },
  tarBarrel: { mass: 95, material: "metal" },
  waterTank: { mass: 78, material: "metal" },

  trolley: { mass: 32, material: "metal" },
  generator: { mass: 105, material: "metal" },
  planter: { mass: 55, material: "stone" },
  pallet: { mass: 24, material: "wood" },
};
export const PROP_MATERIALS = {
  wood:   { friction: .48, bounce: .12, color: "#b48660" },
  stone:  { friction: .65, bounce: .08, color: "#89939e" },
  metal:  { friction: .3, bounce: .24, color: "#94b3bf" },
  fabric: { friction: .72, bounce: .04, color: "#a98598" },
  glass:  { friction: .23, bounce: .18, color: "#97d9df" },
};
export const CHUNK_LIMIT = 96;
const GRAVITY = 1400, MAX_SPEED = 1500, MAX_SPIN = 18;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const cache = new WeakMap(), hitTimes = new WeakMap(), resting = new WeakMap();
const center = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const inertia = b => b.mass * (b.w * b.w + b.h * b.h) / 12;
const cross = (x, y, nx, ny) => x * ny - y * nx;

export function prepareProp(c, id = c.id) {
  const type = PROP_TYPES[c.kind];
  if (!type) return c;
  c.id = id;
  c.mass ??= type.mass;
  c.material ??= type.material;
  c.vx ??= 0; c.vy ??= 0; c.angle ??= 0; c.spin ??= 0;
  c.dx ??= 0; c.dy ??= 0;
  return c;
}

export function bodyPoints(b) {
  const p = center(b), c = Math.cos(b.angle || 0), s = Math.sin(b.angle || 0);
  const shape = b.shape || [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
  return shape.map(([x, y]) => ({
    x: p.x + x * b.w * c - y * b.h * s,
    y: p.y + x * b.w * s + y * b.h * c,
  }));
}
export function bodyBounds(b) {
  const ps = bodyPoints(b), x = Math.min(...ps.map(p => p.x)), y = Math.min(...ps.map(p => p.y));
  return { x, y, w: Math.max(...ps.map(p => p.x)) - x, h: Math.max(...ps.map(p => p.y)) - y };
}
export function bodyInBlast(b, f) {
  const ps = bodyPoints(b);
  let positive = false, negative = false;
  for (let n = 0; n < ps.length; n++) {
    const a = ps[n], p = ps[(n+1)%ps.length], dx = p.x-a.x, dy = p.y-a.y;
    const side = cross(dx,dy,f.x-a.x,f.y-a.y);
    positive ||= side > 0; negative ||= side < 0;
    const t = clamp(((f.x-a.x)*dx+(f.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
    if (Math.hypot(a.x+dx*t-f.x,a.y+dy*t-f.y) <= f.radius) return true;
  }
  return !(positive && negative);
}
const overlaps = (a, b, margin = 0) => a.x + a.w + margin > b.x && a.x - margin < b.x + b.w &&
  a.y + a.h + margin > b.y && a.y - margin < b.y + b.h;

// Thin strips let the existing swept bullets, feet, ragdoll particles and bot
// traces share the actual rotated silhouette. They never enter the wire state.
export function propSolids(b) {
  if (b.hp <= 0) return [];
  prepareProp(b);
  const key = [b.x, b.y, b.angle, b.dx, b.dy, b.hp].join(":");
  const old = cache.get(b);
  if (old?.key === key) return old.tiles;
  let tiles;
  if (!b.shape && Math.abs(b.angle) < .001) tiles = [b];
  else {
    const ps = bodyPoints(b), bounds = bodyBounds(b);
    const count = Math.max(1, Math.min(b.chunk ? 4 : 12, Math.ceil(bounds.w / 10))), width = bounds.w / count;
    tiles = [];
    for (let n = 0; n < count; n++) {
      const x = bounds.x + n * width, right = x + width, ys = [];
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i], p = ps[(i + 1) % ps.length];
        if (a.x >= x && a.x <= right) ys.push(a.y);
        for (const edge of [x, right]) {
          const t = (edge - a.x) / (p.x - a.x);
          if (t >= 0 && t <= 1) ys.push(a.y + (p.y - a.y) * t);
        }
      }
      if (!ys.length) continue;
      const y = Math.min(...ys);
      tiles.push({ id: `${b.id}:t${n}`, propId: b.id, chunk: !!b.chunk,
        kind: b.kind, material: b.material, x, y, w: width, h: Math.max(.2, Math.max(...ys) - y),
        dx: b.dx, dy: b.dy, get hp() { return b.hp; }, maxHp: b.maxHp });
    }
  }
  for (const tile of tiles) Object.defineProperty(tile, "onContact", { configurable: true, enumerable: false,
    value: (x,y,jx,jy) => impulseProp(b,jx,jy,x,y) });
  cache.set(b, { key, tiles });
  return tiles;
}
export function propFor(world, s) {
  if (!s) return null;
  const id = s.propId || s.id;
  return world.cover.find(c => c.id === id) || world.chunks.find(c => c.id === id) || null;
}

// jx/jy are impulses (mass * velocity); hits at an edge also apply torque.
export function impulseProp(b, jx, jy, x = b.x + b.w / 2, y = b.y + b.h / 2) {
  if (b.hp <= 0) return;
  prepareProp(b);
  const p = center(b);
  b.vx = clamp(b.vx + jx / b.mass, -MAX_SPEED, MAX_SPEED);
  b.vy = clamp(b.vy + jy / b.mass, -MAX_SPEED, MAX_SPEED);
  b.spin = clamp(b.spin + cross(x - p.x, y - p.y, jx, jy) / inertia(b), -MAX_SPIN, MAX_SPIN);
  resting.delete(b);
}

function project(ps, x, y) {
  let min = Infinity, max = -Infinity;
  for (const p of ps) { const d = p.x * x + p.y * y; min = Math.min(min, d); max = Math.max(max, d); }
  return [min, max];
}

// Convex SAT with a contact at the shared face. Contact location matters: a bed
// balanced over an edge must tip, while a flat box resting on a floor must settle.
function contact(a, b) {
  const ap = bodyPoints(a), bp = bodyPoints(b);
  let depth = Infinity, nx = 0, ny = 0;
  const ac = center(a), bc = center(b);
  for (const ps of [ap, bp]) for (let n = 0; n < ps.length; n++) {
    const q = ps[n], r = ps[(n + 1) % ps.length], len = Math.hypot(r.x - q.x, r.y - q.y);
    if (!len) continue;
    let x = -(r.y - q.y) / len, y = (r.x - q.x) / len;
    if ((ac.x - bc.x) * x + (ac.y - bc.y) * y < 0) { x = -x; y = -y; }
    const aa = project(ap, x, y), bb = project(bp, x, y);
    if (aa[1] < bb[0] || bb[1] < aa[0]) return null;
    const d = bb[1] - aa[0];
    if (d < depth) { depth = d; nx = x; ny = y; }
  }
  const aa = project(ap, nx, ny), bb = project(bp, nx, ny);
  // Use only the touching features, rather than the full bounding projections.
  const af = ap.filter(p => p.x * nx + p.y * ny < aa[0] + .6);
  const bf = bp.filter(p => p.x * nx + p.y * ny > bb[1] - .6);
  const at = project(af, -ny, nx), bt = project(bf, -ny, nx);
  const t = (Math.max(at[0], bt[0]) + Math.min(at[1], bt[1])) / 2;
  const normal = (aa[0] + bb[1]) / 2;
  return { nx, ny, depth, x: nx * normal - ny * t, y: ny * normal + nx * t };
}

function resolve(a, b, hit, dt, dynamic = false) {
  const { nx, ny, x, y } = hit, ac = center(a), bc = center(b);
  const ax = x - ac.x, ay = y - ac.y, bx = x - bc.x, by = y - bc.y;
  const ia = 1 / a.mass, ib = dynamic ? 1 / b.mass : 0;
  const ra = cross(ax, ay, nx, ny), rb = cross(bx, by, nx, ny);
  const avx = a.vx - a.spin * ay, avy = a.vy + a.spin * ax;
  const bvx = dynamic ? b.vx - b.spin * by : (b.dx || 0) / dt;
  const bvy = dynamic ? b.vy + b.spin * bx : (b.dy || 0) / dt;
  const speed = (avx - bvx) * nx + (avy - bvy) * ny;
  const mat = PROP_MATERIALS[a.material], other = PROP_MATERIALS[b.material] || mat;
  const depth = Math.max(0, hit.depth - .03) * .85 / (ia + ib);
  a.x += nx * depth * ia; a.y += ny * depth * ia;
  if (dynamic) { b.x -= nx * depth * ib; b.y -= ny * depth * ib; }
  if (speed >= 0) return 0;
  const bounce = speed < -100 ? Math.min(mat.bounce, other.bounce) : 0;
  const j = -(1 + bounce) * speed / (ia + ib + ra * ra / inertia(a) + (dynamic ? rb * rb / inertia(b) : 0));
  impulseProp(a, j * nx, j * ny, x, y);
  if (dynamic) impulseProp(b, -j * nx, -j * ny, x, y);
  const tx = -ny, ty = nx, ta = cross(ax, ay, tx, ty), tb = cross(bx, by, tx, ty);
  const tangent = (a.vx - a.spin * ay - (dynamic ? b.vx - b.spin * by : bvx)) * tx +
    (a.vy + a.spin * ax - (dynamic ? b.vy + b.spin * bx : bvy)) * ty;
  const friction = b.ice ? .025 : Math.sqrt(mat.friction * other.friction);
  const f = clamp(-tangent / (ia + ib + ta * ta / inertia(a) + (dynamic ? tb * tb / inertia(b) : 0)), -j * friction, j * friction);
  impulseProp(a, f * tx, f * ty, x, y);
  if (dynamic) impulseProp(b, -f * tx, -f * ty, x, y);
  return -speed;
}

// Collision strips forward the hit to one body, so a wide blast or a saw cannot
// apply the same impulse twelve times to a rotated object.
export function damageProp(world, b, damage, vx = 0, vy = 0, point) {
  if (b.hp <= 0) return;
  prepareProp(b);
  damage = world.reactPropDamage?.(b, damage) ?? damage;
  impulseProp(b, vx * 22, vy * 22, point?.x, point?.y);
  b.hp = Math.max(0, b.hp - damage);
  world.event(b.hp ? "coverhit" : "break", { ...center(b), color: PROP_MATERIALS[b.material].color });
  if (!b.hp) {
    if (!b.chunk) fractureProp(world, b);
    world.terrainVersion++;
  }
}

export function fractureProp(world, b) {
  const spec = propFragments(b, () => world.random()), area = spec.reduce((sum, p) => sum + p.area, 0);
  const origin = center(b), cos = Math.cos(b.angle), sin = Math.sin(b.angle);
  for (const {x, y, w, h, material, shape, sourceArt, area: shardArea} of spec) {
    const rx = x + w / 2 - b.w / 2, ry = y + h / 2 - b.h / 2;
    const dx = rx * cos - ry * sin, dy = rx * sin + ry * cos;
    const width = w, height = h;
    const chunk = { id: `chunk${++world.chunkSerial}`, chunk: true, kind: b.kind, material,
      x: origin.x + dx - width / 2, y: origin.y + dy - height / 2, w: width, h: height,
      mass: b.mass * shardArea / area, hp: 24, maxHp: 24, shape, sourceArt,
      vx: clamp(b.vx - b.spin * dy + dx * 1.3, -MAX_SPEED, MAX_SPEED),
      vy: clamp(b.vy + b.spin * dx + dy * 1.3 - 35, -MAX_SPEED, MAX_SPEED),
      angle: b.angle, spin: clamp(b.spin + (world.random() - .5) * 6, -MAX_SPIN, MAX_SPIN),
      dx: 0, dy: 0,
    };
    world.inheritPropReaction?.(b, chunk);
    world.chunks.push(chunk);
  }
  // Keep substantial wreckage until round reset, with a strict network/CPU cap.
  while (world.chunks.length > CHUNK_LIMIT) {
    let index = world.chunks.findIndex(c => c.hp <= 0);
    if (index < 0) index = world.chunks.findIndex(c => resting.has(c));
    world.chunks.splice(Math.max(0, index), 1);
  }
}

export function contactProp(world, p, s, nx, ny, dt) {
  const b = propFor(world, s);
  if (!b || b.hp <= 0) return;
  prepareProp(b);
  const q = center(b);
  const x = clamp(p.x, s.x, s.x + s.w), y = ny < 0 ? s.y : ny > 0 ? s.y + s.h : clamp(p.y, s.y, s.y + s.h);
  const rx = x - q.x, ry = y - q.y;
  const vx = b.vx - b.spin * ry, vy = b.vy + b.spin * rx;
  const closing = (vx - p.vx) * nx + (vy - p.vy) * ny;
  if (closing <= 0) return;
  const r = cross(rx, ry, nx, ny);
  const j = closing / (1 / 55 + 1 / b.mass + r * r / inertia(b));
  impulseProp(b, -nx * j, -ny * j, x, y);
  p.vx += nx * j / 55;
  p.vy += ny * j / 55;
  if (closing > 90) carryImpulse(p, .2);
  let times = hitTimes.get(b);
  if (!times) { times = new Map(); hitTimes.set(b, times); }
  const incoming = vx * nx + vy * ny;
  if (world.phase === "fight" && incoming > 170 && closing > 220 && (times.get(p) || -1) < world.time) {
    times.set(p, world.time + .4);
    const damage = clamp((closing - 170) * b.mass / 450, 2, 55);
    world.hit(p, { ...q, vx: 0, vy: 0 }, damage, Math.min(650, j / 55), nx, ny,
      { blast: true, effect: "blast", cause: "props", hitstop: .012, stun: .12 });
    if (p.alive && damage >= 25 && !p.knockdown) knockDown(p, b.mass >= 50 ? "machinegun" : "bat");
  }
}

export function hazardProps(world, h, zone, dt) {
  if (["xray","magnet","frost","spores"].includes(h.type)) return;
  let times = hitTimes.get(h);
  if (!times) { times = new Map(); hitTimes.set(h, times); }
  for (const b of [...world.cover, ...world.chunks]) {
    if (b.hp <= 0) continue;
    const box = bodyBounds(b);
    if (h.type === "conveyor") {
      if (Math.abs(box.y+box.h-h.y)<12 && box.x+box.w>zone.x && box.x<zone.x+zone.w)
        impulseProp(b, h.dir * b.mass * Math.min(900*dt,Math.max(0,420-b.vx*h.dir)), 0);
      continue;
    }
    if (!overlaps(box, zone) || (times.get(b) || -1) > world.time) continue;
    times.set(b, world.time+.3);
    if (h.type === "tesla") continue;
    const dir = Math.sign(b.x+b.w/2-h.bodyX) || h.dir;
    const force = h.type === "crusher" ? 850 : h.type === "pendulum" ? 1000 : 400;
    const damage = h.type === "saw" || h.type === "crusher" ? 200 : h.type === "geyser" ? 18 : 35;
    damageProp(world,b,damage,dir*force,h.type==="crusher"?force:-force*.35,{x:h.bodyX,y:h.bodyY});
  }
}

export function updateProps(world, dt) {
  if (dt <= 0) return;
  const bodies = [...world.cover, ...world.chunks].filter(b => b.hp > 0);
  const floors = world.platforms.filter(p => p.hp !== 0);
  const starts = new Map();
  for (const b of bodies) { prepareProp(b); starts.set(b, { x: b.x, y: b.y, angle: b.angle }); b.dx = b.dy = 0; }
  const fastest = Math.max(0, ...bodies.map(b => Math.hypot(b.vx, b.vy) + Math.abs(b.spin) * Math.hypot(b.w, b.h) / 2));
  const steps = Math.max(2, Math.min(12, Math.ceil(fastest * dt / 3))), sub = dt / steps;
  for (let step = 0; step < steps; step++) {
    const bounds = new Map();
    for (const b of bodies) {
      if (b.hp <= 0) continue;
      // Sleeping is conditional on the actual support still being under the body.
      // A removed/moving floor, another body or any impulse wakes it immediately.
      const rest = resting.get(b);
      if (rest && floors.includes(rest) && !rest.dx && !rest.dy && overlaps(bodyBounds(b), rest, .2)) {
        bounds.set(b, bodyBounds(b)); continue;
      }
      resting.delete(b);
      b.vy = Math.min(MAX_SPEED, b.vy + GRAVITY * sub);
      b.vx *= Math.exp(-.08 * sub); b.spin *= Math.exp(-.13 * sub);
      b.x += b.vx * sub; b.y += b.vy * sub; b.angle += b.spin * sub;
      b.angle = Math.atan2(Math.sin(b.angle), Math.cos(b.angle));
      let support = null;
      for (let iteration = 0; iteration < 3; iteration++) {
        let box = bodyBounds(b);
        for (const floor of floors) {
          if (!overlaps(box, floor, .05)) continue;
          const hit = contact(b, floor);
          if (!hit) continue;
          const speed = resolve(b, floor, hit, dt);
          if (hit.ny < -.65) support = floor;
          if (iteration === 0 && speed > 420 && !b.chunk)
            damageProp(world, b, (speed - 420) * b.mass / 650);
          box = bodyBounds(b);
        }
      }
      const points = bodyPoints(b), bottom = Math.max(...points.map(p=>p.y));
      const feet = points.filter(p=>p.y>bottom-.7), cx=b.x+b.w/2;
      const balanced = support && Math.max(support.x,Math.min(...feet.map(p=>p.x))) <= cx &&
        Math.min(support.x+support.w,Math.max(...feet.map(p=>p.x))) >= cx;
      if (support && balanced && Math.hypot(b.vx, b.vy) < 8 && Math.abs(b.spin) < .08) {
        b.vx = b.vy = b.spin = 0;
        resting.set(b, support);
      }
      bounds.set(b, bodyBounds(b));
      for (const p of world.players) {
        if (!p.alive || p.knockdown || b.hp <= 0) continue;
        const box = playerBox(p);
        if (!overlaps(bounds.get(b), box)) continue;
        const hit = contact(b,box);
        if (!hit) continue;
        contactProp(world,p,{...bounds.get(b),id:b.id},-hit.nx,-hit.ny,sub);
        const fraction = 55/(55+b.mass), d = Math.max(0,hit.depth-.1)*.8;
        b.x += hit.nx*d*fraction; b.y += hit.ny*d*fraction;
        p.x -= hit.nx*d*(1-fraction); p.y -= hit.ny*d*(1-fraction);
        bounds.set(b,bodyBounds(b));
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]; if (a.hp <= 0) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (b.hp <= 0 || !overlaps(bounds.get(a), bounds.get(b))) continue;
        if (resting.has(a) && resting.has(b)) continue;
        const hit = contact(a, b);
        if (!hit) continue;
        const speed = resolve(a, b, hit, sub, true);
        if (speed > 330) {
          const reduced = a.mass * b.mass / (a.mass + b.mass);
          const damage = (speed - 330) * reduced / 240;
          if (!a.chunk) damageProp(world, a, damage);
          if (!b.chunk) damageProp(world, b, damage);
        }
        bounds.set(a, bodyBounds(a)); bounds.set(b, bodyBounds(b));
      }
    }
  }
  let changed = false;
  for (const b of bodies) {
    const old = starts.get(b); b.dx = b.x - old.x; b.dy = b.y - old.y;
    if (b.y > H + 130 || b.x < -250 || b.x > W + 250) { b.hp = 0; changed = true; }
    if (!b.chunk && (Math.abs(b.dx) + Math.abs(b.dy) > .1 || Math.abs(b.angle - old.angle) > .01)) changed = true;
  }
  // Bot routes rebuild at a bounded rate, not once per moving sliver per tick.
  if (changed && world.time >= (world.propNavigationAt || 0)) {
    world.terrainVersion++; world.propNavigationAt = world.time + .5;
  }
  world.chunks = world.chunks.filter(b => b.hp > 0);
}
