import { W, H } from "./scale.js";

export const DEATH_CUE_DURATION = 1.1;

// Presentation only: use the host's clock so packet repeats, late joins and
// background tabs cannot restart an old death animation.
export class DeathCues {
  constructor() { this.reset(); }
  reset() { this.items = []; this.round = null; this.lastEvent = 0; this.time = -1; }
  update(state) {
    if (!state) { this.reset(); return []; }
    if (state.round !== this.round || state.time < this.time) this.reset();
    this.round = state.round;
    this.time = state.time;
    for (const event of state.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (event.type !== "ko" || !Number.isFinite(event.x) || !Number.isFinite(event.y)) continue;
      // Interpolation uses the newest death state with an earlier visual clock.
      const at = Math.min(event.at ?? state.time, state.time);
      if (state.time - at >= DEATH_CUE_DURATION) continue;
      this.items.push({ id: event.id, x: event.x, y: event.y - 65,
        color: event.color || "#fff0d5", at });
      if (this.items.length > 4) this.items.shift();
    }
    this.items = this.items.filter(cue => state.time - cue.at < DEATH_CUE_DURATION);
    return this.items.map(cue => {
      const body = state.ragdolls.find(rag => rag.deathId === cue.id);
      if (body) {
        cue.x = (body.points[1].x + body.points[2].x) / 2;
        cue.y = Math.min(...body.points.slice(0, 3).map(p => p.y)) - 44;
      }
      return { ...cue, age: Math.max(0, state.time - cue.at) };
    });
  }
}

export function drawDeathCue(ctx, cue, reduced = false) {
  const t = cue.age / DEATH_CUE_DURATION;
  if (t < 0 || t >= 1) return;
  const fade = Math.max(0, Math.min(1, (1 - t) / 0.55));
  const pop = reduced ? 1 : t < 0.12 ? 0.65 + 0.47 * Math.sin(t / 0.12 * Math.PI / 2)
    : 1 + 0.12 * Math.max(0, 1 - (t - 0.12) / 0.12);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(Math.max(32, Math.min(W - 32, cue.x)),
    Math.max(36, Math.min(H - 36, cue.y - (reduced ? 0 : t * 38))));
  ctx.scale(pop, pop);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-13, 10);
  ctx.bezierCurveTo(-27, 6, -27, -9, -20, -18);
  ctx.bezierCurveTo(-12, -29, 12, -29, 20, -18);
  ctx.bezierCurveTo(27, -9, 27, 6, 13, 10);
  ctx.lineTo(12, 21);
  ctx.quadraticCurveTo(0, 25, -12, 21);
  ctx.closePath();
  ctx.strokeStyle = cue.color;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = "#101923";
  ctx.lineWidth = 3.5;
  ctx.fillStyle = "#fff3da";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#101923";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 10, -4, 6.5, 7.5, side * -0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, 3); ctx.lineTo(-3.5, 10); ctx.lineTo(3.5, 10);
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (const x of [-5, 5]) { ctx.moveTo(x, 16); ctx.lineTo(x, 23); }
  ctx.stroke();
  ctx.restore();
}
