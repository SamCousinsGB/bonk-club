import { drawHazards } from "./trap-art.js";

export const HAZARD_BREAK_LIFE = 1.05;
const LIMIT = 8;
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// Observe the existing authoritative done flag. First snapshots/hot joins show
// empty space immediately, and repeated packets cannot replay a break.
export class HazardBreaks {
  constructor() { this.reset(); }
  reset() { this.previous = new Map(); this.bursts = []; this.time = null; this.round = null; this.arena = null; }
  update(state) {
    if (!state) { this.reset(); return this.bursts; }
    if (state.round !== this.round || state.arenaIndex !== this.arena ||
        state.time < this.time || (this.time !== null && state.time - this.time > .5)) this.reset();
    this.bursts = this.bursts.filter(b => state.time - b.at < HAZARD_BREAK_LIFE);
    for (const h of state.hazards || []) {
      const old = this.previous.get(h.id);
      if (h.done && old && !old.done && this.bursts.length < LIMIT)
        this.bursts.push({ h: {...h}, at: state.time });
    }
    // Copy: local simulation mutates the same hazard objects between frames.
    this.previous = new Map((state.hazards || []).slice(0, LIMIT).map(h => [h.id, {...h}]));
    this.time = state.time; this.round = state.round; this.arena = state.arenaIndex;
    return this.bursts;
  }
}

export function hazardArtBounds(h) {
  if (h.type === "turbine") return {x:h.bodyX-h.w/2-8,y:h.bodyY-h.w/2-8,w:h.w+16,h:h.w+16};
  if (h.type === "furnace") return {x:h.x-345,y:h.y-220,w:690,h:580};
  if (h.type === "slag") return {x:h.x-h.w/2-12,y:h.y-h.h-8,w:Math.min(924,h.w+24),h:Math.min(320,h.h+16)};
  let left = h.x - h.w / 2 - 32, right = h.x + h.w / 2 + 32;
  let top = h.y - h.h - 52, bottom = h.y + 12;
  if (["geyser", "steam", "frost", "spores", "conveyor"].includes(h.type)) top = h.y - 56;
  if (h.type === "saw") top = h.y - 64;
  if (["saw", "pendulum"].includes(h.type)) {
    left = Math.min(left, h.bodyX - 40); right = Math.max(right, h.bodyX + 40);
    top = Math.min(top, h.bodyY - 40); bottom = Math.max(bottom, h.bodyY + 40);
  }
  // Finite wire coordinates can still be enormous. Never let a remote pose
  // allocate an unbounded canvas (or a zero-sized one after precision loss).
  return {x: Math.floor(left), y: Math.floor(top),
    w: Math.max(1, Math.min(880, Math.ceil(right-left))),
    h: Math.max(1, Math.min(440, Math.ceil(bottom-top)))};
}

// A shared jittered mesh partitions the actual casing artwork. Neighbouring
// shards meet at the same crack, including across slender rods and moving heads.
export function hazardShardMesh(h) {
  const bounds = hazardArtBounds(h), cols = Math.min(8, Math.max(3, Math.ceil(bounds.w / 42)));
  const rows = Math.min(6, Math.max(2, Math.ceil(bounds.h / 48))), seed = h.id * 31;
  const points = Array.from({length: rows + 1}, (_, y) => Array.from({length: cols + 1}, (_, x) => ({
    x: (x + (x && x < cols ? (noise(seed + y * 19 + x) - .5) * .55 : 0)) * bounds.w / cols,
    y: (y + (y && y < rows ? (noise(seed + y * 13 + x + 100) - .5) * .55 : 0)) * bounds.h / rows,
  })));
  const shards = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
    shards.push([points[y][x], points[y][x+1], points[y+1][x+1], points[y+1][x]]);
  return {bounds, shards};
}

function inside(x, y, poly) {
  return poly.every((a, i) => { const b = poly[(i+1)%poly.length]; return (b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x) >= 0; });
}

function fracture(burst, theme) {
  const {h} = burst, {bounds, shards} = hazardShardMesh(h);
  const canvas = document.createElement("canvas"); canvas.width = bounds.w; canvas.height = bounds.h;
  const c = canvas.getContext("2d", {willReadFrequently: true}); c.translate(-bounds.x, -bounds.y);
  // Powered fields and warning overlays are not pieces of the broken machine.
  drawHazards(c, [{...h, done: false, active: false, warning: 0}], burst.at, theme);
  const pixels = c.getImageData(0, 0, bounds.w, bounds.h).data;
  const pieces = [];
  for (const [i, poly] of shards.entries()) {
    const minX = Math.max(0, Math.floor(Math.min(...poly.map(p => p.x)))), maxX = Math.min(bounds.w, Math.ceil(Math.max(...poly.map(p => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...poly.map(p => p.y)))), maxY = Math.min(bounds.h, Math.ceil(Math.max(...poly.map(p => p.y))));
    let count = 0, x = 0, y = 0;
    for (let py = minY; py < maxY; py += 2) for (let px = minX; px < maxX; px += 2) {
      if (pixels[(py*bounds.w+px)*4+3] < 40 || !inside(px, py, poly)) continue;
      count++; x += px; y += py;
    }
    if (!count) continue; // No dust/shards from empty scanner openings or air.
    x /= count; y /= count;
    const seed = h.id*31+i*7, side = (x/bounds.w-.5)*2;
    pieces.push({poly, x, y, seed, vx: side*135+(noise(seed)-.5)*150,
      vy: -100-noise(seed+1)*155, spin: (noise(seed+2)-.5)*12,
      life: .55+noise(seed+3)*.25, dust: Math.min(17, 5+Math.sqrt(count)*.7)});
  }
  return {canvas, bounds, pieces};
}

export function drawHazardBreaks(c, bursts, time, theme, reduced = false) {
  for (const burst of bursts) {
    const age = time-burst.at;
    if (age < 0 || age >= HAZARD_BREAK_LIFE) continue;
    burst.art ||= fracture(burst, theme);
    const {canvas, bounds, pieces} = burst.art, organic = burst.h.type === "spores";
    for (const p of pieces) {
      const motion = reduced ? .3 : 1;
      const x = bounds.x+p.x+p.vx*age*motion, y = bounds.y+p.y+(p.vy*age+230*age*age)*motion;
      const size = Math.max(0, 1-Math.max(0, age-.2)/(p.life-.2));
      if (size > 0) {
        c.save(); c.translate(x, y); c.rotate(reduced ? 0 : p.spin*age); c.scale(size, size);
        c.beginPath(); p.poly.forEach((v,i) => i ? c.lineTo(v.x-p.x,v.y-p.y) : c.moveTo(v.x-p.x,v.y-p.y));
        c.closePath(); c.clip(); c.drawImage(canvas, -p.x, -p.y); c.restore();
      }
      // A brief, expanding dust puff replaces each crumbling shard. Only this
      // airborne dust dissipates; the intact fixture never fades or remains.
      const dustAge = Math.max(0, age-.08), fade = Math.max(0, 1-age/HAZARD_BREAK_LIFE);
      c.save(); c.globalAlpha = Math.min(1,age/.07)*fade*fade*.48;
      c.fillStyle = organic ? "#c6bf95" : "#b5b5a6";
      c.beginPath(); c.arc(x-p.vx*age*.25, y-18*dustAge, p.dust*(.35+dustAge*2), 0, Math.PI*2); c.fill();
      c.globalAlpha = fade;
      for (let n = 0; n < 2; n++) {
        const offset = noise(p.seed+n+8), dx = (offset-.5)*120*age, dy = -offset*100*age;
        c.fillStyle = organic ? "#8b9962" : n ? "#d9d6bf" : "#677b80";
        const grit = (2+offset*3)*fade;
        c.fillRect(x+dx,y+dy,grit,grit);
      }
      if (!organic && age < .22 && noise(p.seed+6) > .5) {
        c.globalAlpha = 1-age/.22; c.strokeStyle = "#ffe3a0"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x,y); c.lineTo(x-p.vx*.025,y-p.vy*.025); c.stroke();
      }
      c.restore();
    }
  }
}
