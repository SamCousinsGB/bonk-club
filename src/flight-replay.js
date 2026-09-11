// Contacts remain authoritative. Between contacts, clients reproduce ballistic
// flight from an initial state and tick count instead of receiving coordinates.
export const flightGravity = b => b.kind === "grenade" ? 1100 : b.kind === "duck" ? 380 : 0;
export function stepFlight(b, dt) {
  b.age = (b.age || 0) + dt;
  if (b.kind === "grenade") b.life -= dt;
  b.vy += flightGravity(b) * dt;
  b.x += b.vx * dt; b.y += b.vy * dt;
}
const records = new WeakMap();
const numbers = ["x", "y", "vx", "vy", "age", "life"];
const shape = b => Object.fromEntries(numbers.map(k => [k, b[k] || 0]));
export function recordFlight(b, dt) {
  if (b.homing || b.kind === "boomerang") { records.delete(b); return; }
  let r = records.get(b);
  if (r && r.dt === dt && r.kind === b.kind && r.steps < 1000) {
    const expected = r.last; stepFlight(expected, dt);
    if (numbers.every(k => expected[k] === (b[k] || 0))) {
      r.steps++; return;
    }
  }
  const seed = { ...shape(b), dt };
  records.set(b, { seed, dt, kind:b.kind, steps:0, last:{...seed,kind:b.kind} });
}
export function flightRecipe(b) {
  const r = records.get(b);
  return r && r.dt > 0 && r.dt <= .025 ? { seed:r.seed, steps:r.steps } : undefined;
}
export function compactFlights(state) {
  return { ...state, projectiles:state.projectiles.map(b => {
    if (!b.flight) return b;
    const { x,y,vx,vy,age,life, ...out } = b;
    return out;
  }) };
}
export class FlightReplayer {
  constructor() { this.pieces = new Map(); }
  expand(state) {
    if (!Array.isArray(state.projectiles) || state.projectiles.length > 512) throw new Error("Invalid projectiles");
    const epoch = `${state.round}:${state.arenaIndex}`;
    if (this.epoch !== epoch) { this.pieces.clear(); this.epoch = epoch; }
    const ids = new Set(state.projectiles.map(b=>b?.netId));
    for (const id of this.pieces.keys()) if (!ids.has(id)) this.pieces.delete(id);
    return { ...state, projectiles:state.projectiles.map(b => {
      if (!b || typeof b !== "object") throw new Error("Invalid projectile");
      if (b.flight === undefined) return b;
      const {seed,steps} = b.flight || {};
      if (!seed || !Number.isSafeInteger(b.netId) || b.netId < 1 || !Number.isInteger(steps) || steps < 0 || steps > 1000 ||
          !numbers.every(k=>Number.isFinite(seed[k]) && Math.abs(seed[k]) <= 1000000) ||
          !(seed.dt > 0 && seed.dt <= .025)) throw new Error("Invalid flight recipe");
      const key=JSON.stringify(seed)+":"+b.kind;
      let r=this.pieces.get(b.netId);
      if (!r || r.key !== key || r.steps > steps) {
        r={key,steps:0,body:{...seed,kind:b.kind}};this.pieces.set(b.netId,r);
      }
      while(r.steps<steps){stepFlight(r.body,seed.dt);r.steps++;}
      return {...b,...shape(r.body)};
    }) };
  }
}
