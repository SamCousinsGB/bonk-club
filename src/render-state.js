import { motionState } from "./prediction-state.js";
import { wreckRecipe } from "./wreck-motion.js";
import { flightRecipe } from "./flight-replay.js";
import { matterRecipe } from "./matter-replay.js";
const simulationOnly = new Set([
  "grabHeld", "grabConsumed", "objectAttackHeld", "objectThrowHeld", "objectThrowConsumed", "carryPoint",
  "gasAt", "gasFuel", "fuel", "shockWait", "burnTick", "hissAt",
  "morphPose", "morphSplit",
  "spikeY", "ragVx", "ragVy", "bleed", "rest", "captureAge", "capturedBy", "outer", "sampleSerial",
  "freezePose", "freezeCooldown", "stretchOrigin", "originX", "originY", "originAngle", "fieldId",
  "px", "py", "swept", "blockHeld", "impactTime", "coyote", "jumpHeld", "jumpBuffer", "throwHeld", "pickupCooldown", "support",
  "stun", "cooldown", "airLunge", "angularVelocity", "landing", "ownerLock", "travelled", "gaitSpeed",
]);
const movingLists = ["projectiles", "drops", "debris", "ragdolls", "fields", "wreckage", "blood", "cover", "chunks", "water", "gas", "spills"];
const quantize = (n) => Number.isInteger(n) ? n : Math.round(n * 100) / 100;
function copy(value) {
  if (typeof value === "number") return quantize(value);
  if (Array.isArray(value)) return value.map(copy);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const key in value) if (!simulationOnly.has(key)) out[key] = copy(value[key]);
  return out;
}

export class RenderSnapshots {
  constructor() { this.ids = new WeakMap(); this.nextId = 0; }
  make(state) {
    const out = copy(state);
    out.players.forEach((p, i) => { p.motion = motionState(state.players[i]); });
    for (const key of movingLists) (out[key] || []).forEach((entity, i) => {
      const source = state[key][i];
      if (!this.ids.has(source)) this.ids.set(source, ++this.nextId);
      entity.netId = this.ids.get(source);
      if (key === "fields" && source.matter) {
        const orbit=matterRecipe(source.matter);
        if(orbit)entity.matter.orbit=orbit;
      }
      if (key === "projectiles") {
        const flight = flightRecipe(source);
        if (flight) entity.flight = flight;
      }
      if (key === "wreckage") {
        const terrain = wreckRecipe(source, state.fields || []);
        if (terrain) entity.terrain = terrain;
      }
    });
    return out;
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
export function blend(a, b, t) {
  if (!a || a === b || t === 1) return b;
  const out = { ...b };
  for (const key of ["x", "y", "walk", "bodyX", "bodyY", "age", "ashAge", "deathAge", "radius", "packing"])
    if (Number.isFinite(a[key]) && Number.isFinite(b[key])) out[key] = lerp(a[key], b[key], t);
  if (Number.isFinite(a.aimAngle) && Number.isFinite(b.aimAngle)) {
    const turn = Math.atan2(Math.sin(b.aimAngle - a.aimAngle), Math.cos(b.aimAngle - a.aimAngle));
    out.aimAngle = a.aimAngle + turn * t;
  }
  if (Number.isFinite(a.angle) && Number.isFinite(b.angle))
    out.angle = a.angle + Math.atan2(Math.sin(b.angle-a.angle), Math.cos(b.angle-a.angle)) * t;
  if (a.morph === b.morph && a.morph && Number.isFinite(a.morphAge))
    out.morphAge = lerp(a.morphAge,b.morphAge,t);
  // Smooth an ongoing swing, but never interpolate backwards across a new attack.
  if (a.weapon === b.weapon && a.meleeMove === b.meleeMove &&
      a.swingDuration === b.swingDuration && a.swing > 0 && b.swing <= a.swing)
    out.swing = lerp(a.swing, b.swing, t);
  if (a.fuse > 0 && b.fuse > 0 && b.fuse <= a.fuse) out.fuse = lerp(a.fuse,b.fuse,t);
  if (a.matter && b.matter && a.matter.id === b.matter.id) out.matter = blend(a.matter,b.matter,t);
  if (a.items && b.items) {
    const items = new Map(a.items.map(p => [p.id,p]));
    out.items = b.items.map(p => blend(items.get(p.id),p,t));
  }
  for (const key of ["rig", "points", "spine", "outline"])
    if (Array.isArray(a[key]) && Array.isArray(b[key]))
      out[key] = b[key].map((p, i) => {
        const old = a[key][i];
        return !old || old === p ? p : { ...p, x: lerp(old.x, p.x, t), y: lerp(old.y, p.y, t) };
      });
  if (a.strands && b.strands) out.strands = b.strands.map((p, i) => blend(a.strands[i], p, t));
  return out;
}
export function interpolateStates(a, b, t, mode = "all") {
  if (!a || a.round !== b.round || a.arenaIndex !== b.arenaIndex) return b;
  const out = { ...b };
  if (mode !== "world") out.players = b.players.map(p => {
    const old = a.players.find(q => q.id === p.id);
    return old && old.occupant === p.occupant && old.alive === p.alive ? blend(old, p, t) : p;
  });
  out.time = lerp(a.time,b.time,t);
  if (mode !== "actors") {
    const platforms = new Map(a.platforms.map(p => [p.id,p]));
    out.platforms = a.platforms === b.platforms ? b.platforms : b.platforms.map(p => {
      const old = platforms.get(p.id);
      // Wreck collision strips have no artwork. Blend the visible ribbons once.
      if (p.wreckId || (old?.x === p.x && old?.y === p.y)) return p;
      return old && old.w === p.w && old.h === p.h ? blend(old,p,t) : p;
    });
    out.hazards = b.hazards.map(h => {
      const old = a.hazards.find(q => q.id === h.id);
      return old && old.warning === 0 && h.warning === 0 ? blend(old, h, t) : h;
    });
  }
  for (const key of movingLists) {
    const actor = key === "projectiles" || key === "drops";
    if (mode === "actors" && !actor || mode === "world" && actor) continue;
    if (a[key] === b[key]) { out[key] = b[key]; continue; }
    const old = new Map((a[key] || []).filter(p => p.netId != null).map(p => [p.netId, p]));
    out[key] = (b[key] || []).map(p => {
      const previous=old.get(p.netId);
      // Do not display a flat, grounded pool halfway down its last fall, or
      // interpolate an ice surface away from its authoritative collision.
      if((key === "water" || key === "spills") && previous) {
        if(previous.grounded !== p.grounded || !!previous.frozen !== !!p.frozen) return p;
        const q=blend(previous,p,t);
        q.h=lerp(previous.h,p.h,t);q.vy=lerp(previous.vy,p.vy,t);
        return q;
      }
      return blend(previous,p,t);
    });
  }
  return out;
}

// A short history absorbs packet jitter. Sampling against the host's simulation
// clock keeps delivery bursts from repeatedly freezing and accelerating motion.
export class GuestFrames {
  constructor(mode = "all") { this.mode = mode; this.reset(); }
  reset() {
    this.frames = []; this.offset = null; this.interval = 33; this.jitter = 0;
    this.lastAt = null; this.playhead = null; this.sampleAt = null;
  }
  push(state, now) {
    const last = this.frames.at(-1);
    const changed = last && (last.round !== state.round || last.arenaIndex !== state.arenaIndex);
    if (last && !changed && state.time <= last.time) return;
    // Resume at current authoritative state after a delivery/host stall instead
    // of playing an old queue at catch-up speed. Reset clock estimates too.
    if (changed || (this.lastAt !== null && (now - this.lastAt > 250 ||
        Math.abs(now - this.lastAt - (state.time - last.time) * 1000) > 250))) this.reset();
    const offset = now - state.time * 1000;
    this.offset = this.offset === null ? offset : Math.min(offset, this.offset + .1);
    if (this.lastAt !== null) {
      const interval = (state.time - last.time) * 1000;
      this.interval += (Math.min(200, interval) - this.interval) * .1;
      const jitter = Math.abs(now - this.lastAt - interval);
      // Increase protection quickly, release it slowly. Arrival bursts must not
      // convince the player that the host suddenly runs at a higher tick rate.
      this.jitter += (Math.min(100, jitter) - this.jitter) * (jitter > this.jitter ? .25 : .025);
    }
    this.lastAt = now;
    this.frames.push(state);
    if (this.frames.length > 12) this.frames.shift();
  }
  sample(now) {
    if (!this.frames.length) return null;
    const delay = Math.max(45, Math.min(180, this.interval * 1.35 + this.jitter * 2));
    const target = (now - this.offset - delay) / 1000;
    let time = target;
    if (this.playhead !== null && this.sampleAt !== null) {
      const dt = Math.max(0, (now - this.sampleAt) / 1000), error = target - this.playhead;
      // Adjust playback speed gently instead of freezing whenever the buffer
      // grows or snapping forward when it shrinks. A resumed tab drops old time.
      time = dt > .25 || error > .25 ? Math.max(this.playhead, target) :
        this.playhead + dt * Math.max(.9, Math.min(1.1, 1 + (error - dt) * 3));
    }
    time = Math.max(this.frames[0].time, Math.min(time, this.frames.at(-1).time));
    this.playhead = time; this.sampleAt = now;
    while (this.frames.length > 2 && this.frames[1].time <= time) this.frames.shift();
    const [a, b] = this.frames;
    if (!b || time <= a.time) return a;
    const t = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
    // A quiet or stalled stream already has its final frame. Do not rebuild
    // every entity at the render rate while waiting for another snapshot.
    if (t === 1) return b;
    return interpolateStates(a, b, t, this.mode);
  }
}
