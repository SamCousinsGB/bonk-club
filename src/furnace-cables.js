const STEP = 1 / 120, SEGMENTS = 24;
export const FURNACE_CABLE_COUNT = 6;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function makeCable(side, index) {
  const a = { x: side < 0 ? 70 : 2490, y: 210 + index * 72 };
  const b = { x: 1280 + side * (245 - index * 30), y: 585 + index * 44 };
  const points = Array.from({ length: SEGMENTS + 1 }, (_, i) => {
    const u = i / SEGMENTS, x = a.x + (b.x - a.x) * u,
      y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * (195 + index * 24);
    return { x, y, px: x, py: y };
  });
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  return { a, b, side, index, points, lengths };
}

// Purely visual ropes: fixed ends, inertia, gravity and iterative distance
// constraints. They never enter World.solids or confer a supporting surface.
export class FurnaceCables {
  constructor() { this.reset(); }
  reset() {
    this.cables = [-1, 1].flatMap(side => [0, 1, 2].map(i => makeCable(side, i)));
    this.round = null; this.arena = null; this.time = null; this.accumulator = 0;
  }
  step(time, power, actors = []) {
    for (const cable of this.cables) {
      const { points, a, b, side, index, lengths } = cable;
      for (let i = 1; i < SEGMENTS; i++) {
        const p = points[i], u = i / SEGMENTS;
        const vx = (p.x - p.px) * .993, vy = (p.y - p.py) * .993;
        p.px = p.x; p.py = p.y;
        // Pulsating attraction/repulsion excites travelling waves in the slack
        // conductors. Movement comes from integrated forces, not posed curves.
        const force = power * Math.sin(Math.PI * u) *
          (Math.sin(time * 33 + u * 9 + index * 2.1) * 17000 +
           Math.sin(time * 13 - u * 15 + side) * 8000);
        p.x += vx + (side * force * .62) * STEP * STEP;
        p.y += vy + (650 + force) * STEP * STEP;
        for (const actor of actors) {
          const dx = p.x - actor.x, dy = p.y - actor.y, d = Math.hypot(dx, dy);
          if (d > 0 && d < 35) {
            p.x += dx / d * (35 - d) * .12;
            p.y += dy / d * (35 - d) * .12;
          }
        }
      }
      for (let iteration = 0; iteration < 10; iteration++) {
        Object.assign(points[0], a); Object.assign(points[SEGMENTS], b);
        for (let i = 0; i < SEGMENTS; i++) {
          const p = points[i], q = points[i + 1], dx = q.x - p.x, dy = q.y - p.y;
          const d = Math.hypot(dx, dy) || 1, error = (d - lengths[i]) / d;
          const left = i === 0 ? 0 : i + 1 === SEGMENTS ? 1 : .5;
          const right = i + 1 === SEGMENTS ? 0 : i === 0 ? 1 : .5;
          p.x += dx * error * left; p.y += dy * error * left;
          q.x -= dx * error * right; q.y -= dy * error * right;
        }
      }
    }
  }
  update(state, dt, reduced = false) {
    const h = state?.hazards?.find(h => h.type === "furnace");
    if (!h || h.done) { this.time = null; return []; }
    if (this.time === null || state.round !== this.round || state.arenaIndex !== this.arena ||
        state.time < this.time || state.time - this.time > .5) {
      this.reset();
      // A late join starts from settled slack, without a hanging straight-line
      // snap or an unbounded replay of the entire match.
      for (let i = 0; i < 120; i++) this.step(i * STEP, 0);
    }
    this.round = state.round; this.arena = state.arenaIndex; this.time = state.time;
    this.accumulator += clamp(dt, 0, .05);
    const power = reduced ? .08 : h.active ? 1 : h.warning > 0 ? .13 : 0;
    while (this.accumulator >= STEP) {
      this.step(h.age - this.accumulator, power, (state.players || []).filter(p => p.alive));
      this.accumulator -= STEP;
    }
    return this.cables;
  }
}
