import { World, STEP, cleanInput } from "./engine.js";
import { updateRig } from "./puppet.js";
import { validMotion, validInputSequence } from "./prediction-state.js";

const INPUT_STEP = 1 / 60, MAX_PENDING = 30, STALE_MS = 250;
const motionKeys = ["x", "y", "vx", "vy", "ground", "prone", "facing", "aimAngle",
  "walk", "gaitSpeed", "rig", "bodyAngle", "angularVelocity", "landing", "swing",
  "swingDuration", "meleeMove", "comboStep", "comboTime", "recoilTime", "block", "blockTime"];
const controllable = p => p?.alive && !p.knockdown && !p.freeze && !p.strands && !p.morph;

// Simulate only our own fighter. The shared movement/attack code has an explicit
// prediction mode: no damage, projectiles, pickups, terrain edits or scores.
export class GuestPrediction {
  constructor() { this.reset(); }
  reset() {
    this.latest = null; this.player = null; this.context = null;
    this.pending = []; this.id = null; this.lastAt = null;
    this.correction = { x: 0, y: 0 }; this.lastSequence = 0;
  }
  receive(state, id, now) {
    const p = state.players.find(p => p.id === id), old = this.player;
    const changed = this.id !== id || this.latest?.round !== state.round ||
      this.latest?.arenaIndex !== state.arenaIndex || old?.occupant !== p?.occupant;
    if (!changed && this.latest && state.time <= this.latest.time) return;
    const stalled = this.lastAt !== null && now - this.lastAt > STALE_MS;
    if (changed || stalled) this.pending = [];
    this.id = id; this.latest = state; this.lastAt = now;
    const ack = state.inputAcks?.[id];
    if (!validInputSequence(ack) || !validMotion(p?.motion)) {
      this.pending = []; this.player = null; this.context = null; return;
    }
    this.pending = this.pending.filter(c => c.seq > ack);
    this.player = { ...structuredClone(p), ...p.motion };
    // Render transport omits Verlet history. Rebuild it with the authoritative
    // body velocity before advancing the same procedural pose motors.
    for (const q of this.player.rig || []) { q.px = q.x - p.vx * STEP; q.py = q.y - p.vy * STEP; }
    const platforms = structuredClone(state.platforms);
    this.context = {
      prediction: true, phase: "prediction", time: state.time,
      platforms, cover: structuredClone(state.cover), chunks: structuredClone(state.chunks),
      players: [this.player], projectiles: [],
      spikes: () => state.spikes, solids: World.prototype.solids,
      random: () => .5, event() {}, hit() {}, kill() {}, damageCover() {},
    };
    if (controllable(p) && state.phase === "fight")
      for (const command of this.pending) this.step(command.input);
    else this.pending = [];
    // Keep tiny reconciliation errors unobtrusive. Large corrections, posture
    // changes and disabled/dead fighters use the host result immediately.
    const dx = old ? old.x + this.correction.x - this.player.x : 0;
    const dy = old ? old.y + this.correction.y - this.player.y : 0;
    this.correction = !changed && !stalled && controllable(p) && old?.prone === p.prone &&
      Math.hypot(dx, dy) < 45 ? { x: dx, y: dy } : { x: 0, y: 0 };
  }
  step(input) {
    const p = this.player, w = this.context;
    for (let n = 0; n < 2; n++) {
      w.time += STEP;
      World.prototype.movePlatforms.call(w);
      World.prototype.move.call(w, p, input, STEP);
      if (!input.throw && p.cooldown <= 0 && p.stun <= 0 && !p.block) {
        if (input.block && p.weapon) World.prototype.attack.call(w, p, true);
        else if (input.attack) World.prototype.attack.call(w, p);
      }
      // The throw, inventory change and flying weapon await host confirmation.
      updateRig(p, STEP, w.solids(), w.time);
    }
  }
  advance(input, seq, now) {
    if (!validInputSequence(seq) || seq <= this.lastSequence) return;
    this.lastSequence = seq;
    if (!this.player || !controllable(this.player) || this.latest.phase !== "fight" ||
        now - this.lastAt > STALE_MS || this.pending.length >= MAX_PENDING) return;
    const command = { seq, input: cleanInput(input) };
    this.pending.push(command);
    this.step(command.input);
    const decay = Math.exp(-INPUT_STEP * 20);
    this.correction.x *= decay; this.correction.y *= decay;
  }
  sample(state, now) {
    if (!state || !this.player || state.round !== this.latest.round ||
        state.arenaIndex !== this.latest.arenaIndex) return state;
    const authoritative = this.latest.players.find(p => p.id === this.id);
    let local = authoritative;
    if (controllable(authoritative) && this.latest.phase === "fight" && now - this.lastAt <= STALE_MS) {
      local = { ...authoritative };
      for (const key of motionKeys) local[key] = this.player[key];
      let { x: dx, y: dy } = this.correction;
      const radius = local.prone ? 34 : 15, top = local.prone ? 10 : 28, bottom = local.prone ? 10 : 30;
      if (this.context.solids().some(s => local.x + dx + radius > s.x &&
          local.x + dx - radius < s.x + s.w && local.y + dy + bottom > s.y + .1 &&
          local.y + dy - top < s.y + s.h)) dx = dy = 0;
      local.x += dx; local.y += dy;
      local.rig = local.rig?.map(q => ({ ...q, x: q.x + dx, y: q.y + dy }));
    }
    return { ...state, players: state.players.map(p => p.id === this.id ? local : p) };
  }
}
