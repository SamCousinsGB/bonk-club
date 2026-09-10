const simulationOnly = new Set([
  "px", "py", "swept", "blockHeld", "impactTime", "coyote", "jumpHeld", "jumpBuffer", "throwHeld", "pickupCooldown", "support",
  "stun", "cooldown", "airLunge", "angularVelocity", "landing", "ownerLock", "travelled",
]);
const movingLists = ["projectiles", "drops", "debris", "ragdolls", "fields"];
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
  for (const key of ["x", "y", "walk", "angle", "bodyX", "bodyY", "age", "ashAge", "radius"])
    if (Number.isFinite(a[key]) && Number.isFinite(b[key])) out[key] = lerp(a[key], b[key], t);
  if (Number.isFinite(a.aimAngle) && Number.isFinite(b.aimAngle)) {
    const turn = Math.atan2(Math.sin(b.aimAngle - a.aimAngle), Math.cos(b.aimAngle - a.aimAngle));
    out.aimAngle = a.aimAngle + turn * t;
  }
  for (const key of ["rig", "points"])
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
  reset() { this.frames = []; this.offset = null; this.interval = 33; this.lastAt = null; }
  push(state, now) {
    const last = this.frames.at(-1);
    if (last && state.time <= last.time) return;
    if (last && (last.round !== state.round || last.arenaIndex !== state.arenaIndex)) this.frames = [];
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
    const time = (now - this.offset - delay) / 1000;
    while (this.frames.length > 2 && this.frames[1].time <= time) this.frames.shift();
    const [a, b] = this.frames;
    if (!b || time <= a.time) return a;
    const t = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
    return interpolateStates(a, b, t);
  }
}
