import { JOINTS } from "./puppet.js";
import { passiveBody, collidePoint } from "./body-physics.js";
import { knockDown } from "./knockdown.js";
import { segmentBox, playerBox } from "./collision.js";
import { carveExplosion } from "./terrain.js";
import { damageProp, fractureProp, propFor, propSolids } from "./props.js";
import { trackKillSource } from "./kill-credit.js";
import { releaseObject } from "./object-carry.js";

export const POWER_FIST = { speed: 2200, duration: 1.5, radius: 54, minSpeed: 380 };
// Extra distance constraints tuck hands, knees and feet around the torso. There
// is no pose motor or fixed orientation: the curled body still bends and tumbles.
const CURL = [...JOINTS, [0, 2, 31], [1, 4, 13], [1, 6, 13],
  [1, 7, 23], [1, 9, 23], [2, 8, 15], [2, 10, 15]];
const flights = new WeakMap();
export const powerSource = body => body.powerFlight > 0 ? flights.get(body)?.source : null;
export const validPowerFlight = body => body.powerFlight === undefined ||
  Number.isFinite(body.powerFlight) && body.powerFlight >= 0 && body.powerFlight <= POWER_FIST.duration;

export function launchPowerFist(world, p, attacker, ax, ay) {
  if (world.prediction) return;
  if (p.carryId) releaseObject(world, p);
  p.vx = ax * POWER_FIST.speed; p.vy = ay * POWER_FIST.speed;
  knockDown(p, "powerfist");
  p.knockdown = 1.7; p.powerFlight = POWER_FIST.duration;
  p.morph = null; p.morphTime = 0; p.morphAge = 0;
  delete p.morphPose;
  const center = p.rig[2], spin = (ax < 0 ? -1 : 1) * 9;
  for (const q of p.rig) {
    q.px = q.x - (p.vx - (q.y - center.y) * spin) / 120;
    q.py = q.y - (p.vy + (q.x - center.x) * spin) / 120;
  }
  p.ragVx = p.vx; p.ragVy = p.vy;
  const source = trackKillSource(world, { owner: attacker.id });
  flights.set(p, { source, hits: new Set([p.id]), soundAt: -1 });
}

export function inheritPowerFlight(p, rag) {
  if (!(p.powerFlight > 0) || rag.effect) return;
  rag.powerFlight = p.powerFlight;
  flights.set(rag, flights.get(p));
  p.powerFlight = 0;
}

// Use real swept limb contacts. Each crater is centred at a contact reached in
// this physics tick, so distant walls remain intact until the body reaches them.
export function movePowerFlight(world, body, dt) {
  if (!(body.powerFlight > 0) || world.prediction) return false;
  const flight = flights.get(body);
  if (!flight || body.strands || body.capturedBy || body.freeze > 0 || body.morphTime > 0) {
    body.powerFlight = 0; return false;
  }
  const points = body.rig || body.points;
  const origins = points.map(p => ({ x: p.x, y: p.y }));
  if (body.rig) for (const q of points) {
    q.px -= (body.vx - body.ragVx) * dt;
    q.py -= (body.vy - body.ragVy) * dt;
  }
  passiveBody(points, CURL, [], dt, { drag: .999, stiffness: .42 });
  const vx = points.reduce((s, p, i) => s + p.x - origins[i].x, 0) / points.length / dt;
  const vy = points.reduce((s, p, i) => s + p.y - origins[i].y, 0) / points.length / dt;
  const speed = Math.hypot(vx, vy);
  body.powerFlight = speed < POWER_FIST.minSpeed ? 0 : Math.max(0, body.powerFlight - dt);
  const sweep = box => {
    let first = null;
    points.forEach((p, i) => {
      const o = origins[i], hit = segmentBox(o.x, o.y, p.x, p.y, box, i === 0 ? 10 : 4);
      if (hit && (!first || hit.t < first.t))
        first = { ...hit, x: o.x + (p.x - o.x) * hit.t, y: o.y + (p.y - o.y) * hit.t };
    });
    return first;
  };
  if (speed >= POWER_FIST.minSpeed) {
    const contacts = [];
    const remember = hit => {
      if (hit && !contacts.some(p => Math.hypot(p.x-hit.x,p.y-hit.y) < POWER_FIST.radius * .6)) contacts.push(hit);
    };
    // Props use their rotating collision strips. Fracture them with momentum;
    // chips outside the body's path remain physical rubble.
    const broken = new Set();
    for (const solid of world.solids()) {
      const hit = sweep(solid);
      if (!hit) continue;
      remember(hit);
      const prop = propFor(world, solid);
      if (prop && !broken.has(prop)) {
        damageProp(world, prop, 10000, vx * .5, vy * .5, hit);
        // Containers normally retain their casing until the fuse/contents finish.
        // A body smashing through them destroys that casing and consumes any
        // contents that could not spill, just as a terrain-erasing hit does.
        if (prop.hp > 0) {
          Object.assign(prop, { hp: 0, spent: true, leak: 0, fire: 0, gasFuel: 0, waterLeft: 0, liquidLeft: 0 });
          fractureProp(world, prop); world.terrainVersion++;
        }
        broken.add(prop);
      }
    }
    for (const h of world.hazards) if (!h.done && h.type !== "powerline")
      remember(sweep({ x: h.bodyX - h.w / 4, y: h.bodyY - 16, w: h.w / 2, h: 32 }));
    for (const c of world.cables || []) for (let i = 0; i < c.links.length; i++) if (c.links[i]) {
      const a = c.points[i], b = c.points[i+1], length = Math.hypot(b.x-a.x,b.y-a.y);
      // Short samples cover the actual wire, not the empty box below its sag.
      for (let n = 0, count = Math.max(1, Math.ceil(length / 6)); n <= count; n++) {
        const t = n / count;
        remember(sweep({ x: a.x+(b.x-a.x)*t-3, y: a.y+(b.y-a.y)*t-3, w: 6, h: 6 }));
      }
    }
    for (const hit of contacts) carveExplosion(world, { ...hit, radius: POWER_FIST.radius });
    // Newly fractured pieces in the contact path must not stop/recreate cover.
    for (const b of world.chunks) if (b.hp > 0 && propSolids(b).some(sweep)) b.hp = 0;
    if (contacts.length && world.time >= flight.soundAt) {
      world.event("break", { x: contacts[0].x, y: contacts[0].y, color: "#ffc777" });
      flight.soundAt = world.time + .09;
    }
    for (const p of world.players) {
      if (!p.alive || flight.hits.has(p.id) || !sweep(playerBox(p))) continue;
      flight.hits.add(p.id);
      world.hit(p, { x: points[2].x, y: points[2].y, vx: 0, vy: 0 }, 48, 700,
        vx / speed, vy / speed, { blast: true, source: flight.source, cause: "props", hitstop: .015 });
      if (p.alive) knockDown(p, "powerfist");
    }
  }
  const solids = world.solids();
  points.forEach((p, i) => collidePoint(p, solids, i === 0 ? 10 : 3, origins[i], new Set(), { restitution: .15 }));
  if (body.rig) {
    body.x = points[2].x; body.y = points[2].y + 3;
    body.vx = body.ragVx = vx; body.vy = body.ragVy = vy;
    body.ground = false; body.stun = Math.max(body.stun, dt * 2);
    body.knockdown = Math.max(.08, body.knockdown - dt);
  }
  return true;
}
