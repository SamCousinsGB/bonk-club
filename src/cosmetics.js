// These are appearance IDs, shared by preferences, the editor and wire validation.
export const FINISHES = ["Matte", "Chrome", "Gold leaf", "Iridescent", "Opal", "Carbon fibre", "Starfield", "Magma"];
export const CAPES = ["None", "Royal", "Split", "Starlight", "Holographic", "Ember"];
export const TRAILS = ["None", "Prism", "Stardust", "Embers", "Ion", "Petals", "Frost"];
export const AURAS = ["None", "Fireflies", "Satellites", "Runes"];
export const COSMETIC_DEFAULTS = { finish: "Matte", cape: "None", capeColor: "#bc9bff", trail: "None", aura: "None" };
export const FINISH_SWATCHES = {
  Matte: "#55baff", Chrome: "linear-gradient(125deg,#213044 8%,#b0dcf5 33%,#fff 43%,#364858 47%,#b1cee1 76%,#fff)",
  "Gold leaf": "linear-gradient(125deg,#6a3a14,#e6ad3e 35%,#fff0b5 43%,#a9691d 49%,#ffd774 75%,#704616)",
  Iridescent: "linear-gradient(125deg,#8074ed,#72edda 28%,#fbe7fa 45%,#f28bd3 65%,#738afa)",
  Opal: "conic-gradient(from 35deg,#f2fdff,#c2aaff,#93eccf,#fff2d3,#ffaedb,#f2fdff)",
  "Carbon fibre": "repeating-linear-gradient(135deg,#192c37 0 3px,#5b8096 3px 5px,#263d49 5px 8px)",
  Starfield: "radial-gradient(circle at 30% 30%,#fff 0 2%,transparent 4%),radial-gradient(circle at 65% 65%,#e7bbff 0 3%,transparent 5%),linear-gradient(135deg,#141b42,#7e56b0,#243c71)",
  Magma: "repeating-linear-gradient(145deg,#331923 0 7px,#ff9450 8px,#a23130 10px,#291824 14px)",
};

export const TRAIL_LIMIT = 26;
export const TRAIL_LIFE = .48;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Render-only history. Never attached to players or sent over the network.
// Round, slot occupant and teleport changes discard old cloth/trails immediately.
export class CosmeticMotion {
  constructor() { this.entries = new Map(); this.round = null; this.time = -1; }
  update(state, dt, reduced = false) {
    if (!state) { this.entries.clear(); this.round = null; return; }
    if (state.round !== this.round || state.time < this.time) this.entries.clear();
    this.round = state.round; this.time = state.time;
    const alive = new Set();
    for (const p of state.players.slice(0, 4)) {
      if (!p.alive || !p.rig || p.strands) continue;
      const key = p.id, neck = p.rig[1], signature = [p.occupant, p.name, p.color, p.cape, p.capeColor, p.trail].join("/");
      alive.add(key);
      let e = this.entries.get(key);
      const jump = e && Math.hypot(neck.x - e.x, neck.y - e.y) > 180;
      if (!e || e.signature !== signature || jump) {
        e = { signature, x: neck.x, y: neck.y, trail: [], cloth: [], clock: 0 };
        this.entries.set(key, e);
      }
      const elapsed = clamp(dt, 0, .05);
      e.clock += elapsed;
      for (const q of e.trail) q.age += elapsed;
      e.trail = e.trail.filter(q => q.age < TRAIL_LIFE);
      const moved = Math.hypot(neck.x - e.x, neck.y - e.y);
      if (!reduced && p.trail !== "None" && moved > .35 && e.clock >= 1 / 60) {
        e.trail.push({ x: p.rig[2].x, y: p.rig[2].y, age: 0, seed: state.time * 37 });
        e.trail = e.trail.slice(-TRAIL_LIMIT); e.clock = 0;
      }
      if (reduced || p.trail === "None") e.trail = [];
      e.x = neck.x; e.y = neck.y;
      if (p.cape !== "None") advanceCloth(e.cloth, p, elapsed, state.time, reduced);
      else e.cloth = [];
    }
    for (const key of this.entries.keys()) if (!alive.has(key)) this.entries.delete(key);
  }
}

export function restCloth(p) {
  const neck = p.rig[1], hip = p.rig[2], d = Math.hypot(hip.x - neck.x, hip.y - neck.y) || 1;
  const downX = (hip.x - neck.x) / d, downY = (hip.y - neck.y) / d, facing = p.facing || 1;
  return Array.from({ length: 9 }, (_, i) => {
    const x = neck.x - downY * facing * (4 + i * 1.7) + downX * i * 5.8;
    const y = neck.y + downX * facing * (4 + i * 1.7) + downY * i * 5.8;
    return { x, y, px: x, py: y };
  });
}
function advanceCloth(points, p, dt, time, reduced) {
  const rest = restCloth(p);
  if (!points.length || reduced) { points.splice(0, points.length, ...rest); return; }
  if (dt <= 0) return;
  const n = Math.max(1, Math.ceil(dt * 120)), step = dt / n;
  for (let tick = 0; tick < n; tick++) {
    const anchor = rest[0]; points[0] = { ...anchor };
    for (let i = 1; i < points.length; i++) {
      const q = points[i], x = q.x, y = q.y;
      // Gravity, wind and drag give each section its own delayed response.
      q.x += clamp((q.x - q.px) * .94, -5, 5) + (-p.facing * 55 - clamp(p.vx || 0, -700, 700) * .5 + Math.sin(time * 7 - i * .7) * 65) * step * step;
      q.y += clamp((q.y - q.py) * .94, -5, 5) + (240 - clamp(p.vy || 0, -700, 700) * .12) * step * step;
      q.px = x; q.py = y;
    }
    for (let pass = 0; pass < 6; pass++) {
      points[0].x = anchor.x; points[0].y = anchor.y;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const pull = (d - 6.2) / d;
        if (i > 1) { a.x += dx * pull * .5; a.y += dy * pull * .5; }
        b.x -= dx * pull * (i === 1 ? 1 : .5); b.y -= dy * pull * (i === 1 ? 1 : .5);
      }
    }
  }
}
