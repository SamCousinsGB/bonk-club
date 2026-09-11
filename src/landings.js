// Observe actual ground contacts without adding network events or replaying
// landings when a guest catches up. Walking is silent.
export class Landings {
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
      const old = this.players.get(p.id);
      const same = old && old.occupant === p.occupant && old.alive && p.alive && gap <= .25;
      const standing = p.alive && p.ground && !p.prone && !p.freeze && !p.knockdown && !p.morphTime;
      let last = same ? old.last : state.time;
      if (same && standing && state.time - last >= .15) {
        const landing = !old.ground && old.vy > 160;
        if (landing) {
          contacts.push({ name:'landing', x:p.x, y:p.y, player:p.id });
          last = state.time;
        }
      }
      next.set(p.id, { occupant:p.occupant, alive:p.alive, ground:p.ground, vy:p.vy, last });
    }
    this.players = next;
    return contacts;
  }
}
