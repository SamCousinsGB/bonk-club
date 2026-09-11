import { World, STEP, cleanInput } from "./engine.js";
import { updateRig } from "./puppet.js";
import { validMotion, validInputSequence } from "./prediction-state.js";
import { blend } from "./render-state.js";
import { WeaponPrediction } from "./weapon-prediction.js";

const INPUT_STEP = 1 / 60, MAX_PENDING = 30, STALE_MS = 250;
const motionKeys = ["x", "y", "vx", "vy", "ground", "prone", "facing", "aimAngle",
  "walk", "gaitSpeed", "rig", "bodyAngle", "angularVelocity", "landing", "swing",
  "swingDuration", "meleeMove", "comboStep", "comboTime", "recoilTime", "block", "blockTime", "carryPoint"];
const controllable = p => p?.alive && !p.knockdown && !p.freeze && !p.strands && !p.morph;

// Simulate only our own fighter. The shared movement/attack code has an explicit
// prediction mode: no damage, projectiles, pickups, terrain edits or scores.
export class GuestPrediction {
  constructor() { this.reset(); }
  reset() {
    this.latest = null; this.player = null; this.context = null;
    this.pending = []; this.id = null; this.lastAt = null;
    this.correction = { x: 0, y: 0 }; this.correctionAt = 0; this.lastSequence = 0;
    this.advanceAt = null; this.input = null; this.future = null;
    this.weapons = new WeaponPrediction();
  }
  receive(state, id, now) {
    const p = state.players.find(p => p.id === id), old = this.player;
    const correctionDecay = Math.exp(-Math.max(0, now - this.correctionAt) * .02);
    const changed = this.id !== id || this.latest?.round !== state.round ||
      this.latest?.arenaIndex !== state.arenaIndex || old?.occupant !== p?.occupant;
    if (!changed && this.latest && state.time <= this.latest.time) return;
    const stalled = this.lastAt !== null && now - this.lastAt > STALE_MS;
    if (changed || stalled) this.pending = [];
    if (changed || stalled) this.weapons.reset();
    this.weapons.receive(state, id, now);
    this.id = id; this.latest = state; this.lastAt = now;
    this.future = null;
    if (changed || stalled) { this.advanceAt = now; this.input = null; }
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
      prediction: true, phase: "prediction", time: state.time, round:state.round,
      platforms, cover: structuredClone(state.cover), chunks: structuredClone(state.chunks),
      players: [this.player], projectiles: [],
      projectileCount:state.projectiles.length,
      attack(p,alternate) { World.prototype.attack.call(this,p,alternate); },
      spikes: () => state.spikes, solids: World.prototype.solids,
      random: () => .5, event() {}, hit() {}, kill() {}, damageCover() {},
    };
    if (controllable(p) && state.phase === "fight")
      for (const command of this.pending) this.step(command.input);
    else this.pending = [];
    // Keep tiny reconciliation errors unobtrusive. Large corrections, posture
    // changes and disabled/dead fighters use the host result immediately.
    const dx = old ? old.x + this.correction.x * correctionDecay - this.player.x : 0;
    const dy = old ? old.y + this.correction.y * correctionDecay - this.player.y : 0;
    this.correction = !changed && !stalled && controllable(p) && old?.prone === p.prone &&
      Math.hypot(dx, dy) < 45 ? { x: dx, y: dy } : { x: 0, y: 0 };
    this.correctionAt = now;
  }
  step(input, p = this.player, w = this.context) {
    for (let n = 0; n < 2; n++) {
      w.time += STEP;
      World.prototype.movePlatforms.call(w);
      const x = p.x, y = p.y;
      World.prototype.move.call(w, p, input, STEP);
      if (p.carryPoint) p.carryPoint = { x: p.carryPoint.x + p.x - x, y: p.carryPoint.y + p.y - y };
      if (input.throw && !p.throwHeld && p.stun <= 0 && !p.freeze && !p.knockdown && !p.carryId)
        World.prototype.throwWeapon.call(w,p);
      p.throwHeld=input.throw;
      if (!input.throw && p.cooldown <= 0 && p.stun <= 0 && !p.block) {
        if (input.block && p.weapon) World.prototype.attack.call(w, p, true);
        else if (input.attack) World.prototype.attack.call(w, p);
      }
      updateRig(p, STEP, w.solids(p), w.time);
    }
  }
  advance(input, seq, now) {
    if (!validInputSequence(seq) || seq <= this.lastSequence) return;
    this.lastSequence = seq;
    if (!this.player || !controllable(this.player) || this.latest.phase !== "fight" ||
        now - this.lastAt > STALE_MS || this.pending.length >= MAX_PENDING) return;
    const command = { seq, input: cleanInput(input) };
    this.pending.push(command);
    this.context.previewShot=b=>this.weapons.capture("projectiles",b,seq,now);
    this.context.previewThrow=b=>this.weapons.capture("drops",b,seq,now);
    this.context.previewField=b=>this.weapons.capture("fields",b,seq,now);
    this.context.event=(type,data)=>this.weapons.event({type,at:this.context.time,...data},now);
    this.step(command.input);
    this.context.previewShot=this.context.previewThrow=this.context.previewField=undefined;
    this.context.event=()=>{};
    this.advanceAt = now; this.input = command.input; this.future = null;
  }
  sample(state, now) {
    if (!state || !this.player || state.round !== this.latest.round ||
        state.arenaIndex !== this.latest.arenaIndex) return state;
    const authoritative = this.latest.players.find(p => p.id === this.id);
    let local = authoritative;
    if (controllable(authoritative) && this.latest.phase === "fight") {
      local = { ...authoritative };
      let motion = this.player;
      const fraction = Math.max(0, Math.min(1, (now - this.advanceAt) / (INPUT_STEP * 1000)));
      if (this.input && fraction > 0 && now - this.lastAt <= STALE_MS) {
        if (!this.future) {
          // One collision-checked lookahead between input ticks. It is only a
          // render sample: it never becomes replay state or changes authority.
          this.future = structuredClone(this.player);
          const context = { ...this.context, players: [this.future],
            platforms: this.context.platforms.map(p => ({ ...p })),
            cover: this.context.cover.map(p => ({ ...p })), chunks: this.context.chunks.map(p => ({ ...p })),
          };
          this.step(this.input, this.future, context);
        }
        if (this.future.prone === this.player.prone) motion = blend(this.player, this.future, fraction);
      }
      for (const key of motionKeys) local[key] = motion[key];
      let { x: dx, y: dy } = this.correction;
      const decay = Math.exp(-Math.max(0, Math.min(now, this.lastAt + STALE_MS) - this.correctionAt) * .02);
      dx *= decay; dy *= decay;
      const radius = local.prone ? 34 : 15, top = local.prone ? 10 : 28, bottom = local.prone ? 10 : 30;
      if (this.context.solids(this.player).some(s => local.x + dx + radius > s.x &&
          local.x + dx - radius < s.x + s.w && local.y + dy + bottom > s.y + .1 &&
          local.y + dy - top < s.y + s.h)) dx = dy = 0;
      local.x += dx; local.y += dy;
      if (local.carryPoint) local.carryPoint = { x: local.carryPoint.x + dx, y: local.carryPoint.y + dy };
      local.rig = local.rig?.map(q => ({ ...q, x: q.x + dx, y: q.y + dy }));
    }
    const out = { ...state, players: state.players.map(p => p.id === this.id ? local : p) };
    if ([...this.weapons.pending.values()].some(r=>r.list==='drops'&&!r.confirmed) && controllable(authoritative))
      local.weapon=this.player.weapon;
    // A held object's artwork travels with its local carrier. Ownership, shape,
    // collisions, contents and the actual pickup/drop still come from the host.
    if (local.carryId) for (const list of ["cover", "chunks"]) {
      const held = this.latest[list].find(b => b.id === local.carryId);
      if (held) out[list] = state[list].map(b => b.id === held.id ? {
        ...held, x: held.x + local.x - authoritative.x, y: held.y + local.y - authoritative.y,
      } : b);
    }
    return this.weapons.sample(out,now);
  }
}
