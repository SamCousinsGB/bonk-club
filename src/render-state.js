const simulationOnly = new Set([
  "morphPose", "morphSplit",
  "spikeY", "ragVx", "ragVy", "bleed", "rest", "captureAge", "capturedBy", "outer", "sampleSerial",
  "freezePose", "freezeCooldown", "stretchOrigin", "originX", "originY", "originAngle", "fieldId",
  "px", "py", "swept", "blockHeld", "impactTime", "coyote", "jumpHeld", "jumpBuffer", "throwHeld", "pickupCooldown", "support",
  "stun", "cooldown", "airLunge", "angularVelocity", "landing", "ownerLock", "travelled", "gaitSpeed",
]);
const movingLists = ["projectiles", "drops", "debris", "ragdolls", "fields", "wreckage", "blood", "cover", "chunks"];
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
    for (const key of movingLists) out[key].forEach((entity, i) => {
      const source = state[key][i];
      if (!this.ids.has(source)) this.ids.set(source, ++this.nextId);
      entity.netId = this.ids.get(source);
    });
    return out;
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
function blend(a, b, t) {
  if (!a) return b;
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
  if (a.matter && b.matter && a.matter.id === b.matter.id) out.matter = blend(a.matter,b.matter,t);
  if (a.items && b.items) {
    const items = new Map(a.items.map(p => [p.id,p]));
    out.items = b.items.map(p => blend(items.get(p.id),p,t));
  }
  for (const key of ["rig", "points", "spine", "outline", "strands"])
    if (Array.isArray(a[key]) && Array.isArray(b[key]))
      out[key] = b[key].map((p, i) => blend(a[key][i], p, t));
  return out;
}
export function interpolateStates(a, b, t) {
  if (!a || a.round !== b.round || a.arenaIndex !== b.arenaIndex) return b;
  const out = { ...b };
  out.players = b.players.map(p => {
    const old = a.players.find(q => q.id === p.id);
    return old && old.occupant === p.occupant && old.alive === p.alive ? blend(old, p, t) : p;
  });
  const platforms = new Map(a.platforms.map(p => [p.id,p]));
  out.platforms = b.platforms.map(p => {
    const old = platforms.get(p.id);
    // Wreck collision strips have no artwork. Blend the visible ribbons once.
    if (p.wreckId || (old?.x === p.x && old?.y === p.y)) return p;
    return old && old.w === p.w && old.h === p.h ? blend(old,p,t) : p;
  });
  out.time = lerp(a.time,b.time,t);
  out.hazards = b.hazards.map(h => {
    const old = a.hazards.find(q => q.id === h.id);
    return old && old.warning === 0 && h.warning === 0 ? blend(old, h, t) : h;
  });
  for (const key of movingLists) {
    const old = new Map(a[key].filter(p => p.netId != null).map(p => [p.netId, p]));
    out[key] = b[key].map(p => blend(old.get(p.netId), p, t));
  }
  return out;
}

// A short history absorbs packet jitter. Sampling against the host's simulation
// clock keeps delivery bursts from repeatedly freezing and accelerating motion.
export class GuestFrames {
  constructor() { this.reset(); }
  reset() { this.frames = []; this.offset = null; this.interval = 33; this.lastAt = null; this.playhead = null; }
  push(state, now) {
    const last = this.frames.at(-1);
    const changed = last && (last.round !== state.round || last.arenaIndex !== state.arenaIndex);
    if (last && !changed && state.time <= last.time) return;
    // Resume at current authoritative state after a delivery/host stall instead
    // of playing an old queue at catch-up speed. Reset clock estimates too.
    if (changed || (this.lastAt !== null && (now - this.lastAt > 250 ||
        Math.abs(now - this.lastAt - (state.time - last.time) * 1000) > 250))) this.reset();
    const offset = now - state.time * 1000;
    this.offset = this.offset === null ? offset : Math.min(offset, this.offset + 1);
    if (this.lastAt !== null) this.interval += (Math.min(200, now - this.lastAt) - this.interval) * 0.08;
    this.lastAt = now;
    this.frames.push(state);
    if (this.frames.length > 12) this.frames.shift();
  }
  sample(now) {
    if (!this.frames.length) return null;
    const delay = Math.max(70, Math.min(180, this.interval * 1.8));
    const time = Math.max(this.playhead ?? -Infinity, (now - this.offset - delay) / 1000);
    this.playhead = Math.min(time, this.frames.at(-1).time);
    while (this.frames.length > 2 && this.frames[1].time <= time) this.frames.shift();
    const [a, b] = this.frames;
    if (!b || time <= a.time) return a;
    const t = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
    return interpolateStates(a, b, t);
  }
}
