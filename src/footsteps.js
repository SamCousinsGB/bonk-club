// Derive contacts from the existing authoritative gait. No extra network events,
// frame-rate-driven metronome, or queued steps when a guest catches up.
export class Footsteps {
  constructor() { this.reset(); }
  reset() { this.players = new Map(); this.round = null; this.arena = null; this.time = null; }
  update(state) {
    if (!state || !Number.isFinite(state.time)) { this.reset(); return []; }
    if (this.round !== state.round || this.arena !== state.arenaIndex || state.time < this.time) this.reset();
    if (state.time === this.time) return [];
    const gap = this.time === null ? Infinity : state.time - this.time;
    this.round = state.round; this.arena = state.arenaIndex; this.time = state.time;
    const next = new Map(), contacts = [];
    for (const p of state.players || []) {
      if (!Number.isFinite(p.walk)) continue;
      const old = this.players.get(p.id);
      const same = old && old.occupant === p.occupant && old.alive && p.alive && gap <= .25;
      const standing = p.alive && p.ground && !p.prone && !p.freeze && !p.knockdown && !p.morphTime;
      let last = same ? old.last : state.time;
      let travel = same ? old.travel + Math.abs(p.walk - old.walk) : 0;
      if (same && standing && state.time - last >= .15) {
        const landing = !old.ground && old.vy > 160;
        const step = old.standing && Math.floor(p.walk / Math.PI) !== Math.floor(old.walk / Math.PI) &&
          travel >= .65 && Math.abs(p.walk - old.walk) < Math.PI * 2;
        if (landing || step) {
          contacts.push({ name: landing ? 'landing' : 'footstep', x:p.x, y:p.y, player:p.id });
          last = state.time; travel = 0;
        }
      }
      if (!standing) travel = 0;
      next.set(p.id, { occupant:p.occupant, alive:p.alive, ground:p.ground, standing,
        walk:p.walk, vy:p.vy, last, travel });
    }
    this.players = next;
    return contacts;
  }
}
