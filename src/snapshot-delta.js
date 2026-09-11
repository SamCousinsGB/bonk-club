// Each disposable update depends only on a snapshot the recipient acknowledged,
// never on the preceding packet. Loss/reordering cannot break a delta chain.
export const SNAPSHOT_HISTORY = 32;
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const sequence = n => Number.isInteger(n) && n > 0 && n <= 0xffffffff;

// null: unchanged, [value]: replace, []: remove, object: sparse property patch,
// [length, object]: sparse array patch; [indices, object]: reordered entities.
// Undefined object fields are JSON omissions.
export function snapshotPatch(a, b) {
  if (a === b) return null;
  // Render numbers lie on a hundredth-unit grid. Integer differences compress
  // moving rigs/ribbons far better than resending every absolute coordinate.
  // Preserve unquantized motion fields with an exact replacement instead.
  if (Number.isFinite(a) && Number.isFinite(b) &&
      a === Math.round(a * 100) / 100 && b === Math.round(b * 100) / 100)
    return Math.round(b * 100) - Math.round(a * 100);
  if (Array.isArray(a) && Array.isArray(b)) {
    // Projectile births/removals shift array indices. Reuse surviving entities
    // by stable identity instead of retransmitting every following projectile.
    if (a.length && b.length && [...a,...b].every(v => object(v) && Number.isSafeInteger(v.netId))) {
      const previous = new Map(a.map((v,i)=>[v.netId,i]));
      if (previous.size === a.length && new Set(b.map(v=>v.netId)).size === b.length) {
        const order = b.map(v=>previous.get(v.netId) ?? -1);
        if (order.some((n,i)=>n!==i)) {
          const changes={};
          b.forEach((v,i)=>{const patch=snapshotPatch(a[order[i]],v);if(patch!==null)changes[i]=patch;});
          return [order,changes];
        }
      }
    }
    const changes = {}; let count = 0;
    for (let i = 0; i < b.length; i++) {
      const patch = snapshotPatch(a[i], b[i]);
      if (patch !== null) { changes[i] = patch; count++; }
    }
    if (!count && a.length === b.length) return null;
    // Entirely new lists are smaller as a replacement.
    return !a.length || !b.length ? [b] : [b.length, changes];
  }
  if (object(a) && object(b)) {
    const changes = {}; let count = 0;
    for (const key of Object.keys(b)) {
      if (b[key] === undefined) continue;
      const patch = snapshotPatch(a[key], b[key]);
      if (patch !== null) { changes[key] = patch; count++; }
    }
    for (const key of Object.keys(a)) if (a[key] !== undefined && b[key] === undefined) {
      changes[key] = []; count++;
    }
    return count ? changes : null;
  }
  return b === undefined ? [] : [b];
}

function visit(value, budget, depth) {
  if (--budget.left < 0 || depth > 24) throw new Error("Snapshot limit");
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid number");
  if (typeof value === "string" && value.length > 10000) throw new Error("Invalid string");
  if (value && typeof value === "object") {
    if (Array.isArray(value) && value.length > 4096) throw new Error("Invalid list");
    for (const key of Object.keys(value)) {
      if (forbidden.has(key)) throw new Error("Invalid property");
      visit(value[key], budget, depth + 1);
    }
  }
}
function apply(a, patch, budget, depth = 0) {
  if (--budget.left < 0 || depth > 24) throw new Error("Snapshot limit");
  if (patch === null) return a;
  if (typeof patch === "number") {
    if (typeof a !== "number" || !Number.isSafeInteger(patch) || Math.abs(patch) > 2000000000)
      throw new Error("Invalid numeric patch");
    return (Math.round(a * 100) + patch) / 100;
  }
  if (Array.isArray(patch)) {
    if (patch.length === 0) return undefined;
    if (patch.length === 1) { visit(patch[0], budget, depth + 1); return patch[0]; }
    if (patch.length === 2 && Array.isArray(a) && Array.isArray(patch[0])) {
      if (patch[0].length > 4096 || !object(patch[1]) ||
          !patch[0].every(i=>Number.isInteger(i)&&i>=-1&&i<a.length) ||
          new Set(patch[0].filter(i=>i!==-1)).size !== patch[0].filter(i=>i!==-1).length)
        throw new Error("Invalid entity order");
      const out=patch[0].map(i=>i===-1?undefined:a[i]);
      for(const [key,value] of Object.entries(patch[1])) {
        if(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=out.length)throw new Error("Invalid entity index");
        out[key]=apply(out[key],value,budget,depth+1);
      }
      if(out.some(v=>v===undefined))throw new Error("Incomplete entity list");
      return out;
    }
    if (patch.length !== 2 || !Array.isArray(a) || !Number.isInteger(patch[0]) ||
        patch[0] < 0 || patch[0] > 4096 || !object(patch[1])) throw new Error("Invalid array patch");
    const out = a.slice(0, patch[0]); out.length = patch[0];
    for (const [key, value] of Object.entries(patch[1])) {
      if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= out.length) throw new Error("Invalid index");
      out[key] = apply(a[key], value, budget, depth + 1);
    }
    for (let i = 0; i < out.length; i++) if (out[i] === undefined) throw new Error("Incomplete array");
    return out;
  }
  if (!object(a) || !object(patch)) throw new Error("Invalid object patch");
  const out = { ...a };
  for (const [key, value] of Object.entries(patch)) {
    if (forbidden.has(key)) throw new Error("Invalid property");
    const next = apply(a[key], value, budget, depth + 1);
    if (next === undefined) delete out[key]; else out[key] = next;
  }
  return out;
}

export class SnapshotHistory {
  constructor() { this.states = new Map(); }
  remember(seq, state) {
    this.states.set(seq, state);
    while (this.states.size > SNAPSHOT_HISTORY) this.states.delete(this.states.keys().next().value);
  }
  encode(state, base = 0) {
    const previous = this.states.get(base);
    if (!previous || previous.round !== state.round || previous.arenaIndex !== state.arenaIndex)
      return { base: 0, state };
    return { base, patch: snapshotPatch(previous, state) };
  }
  decode(message, seq) {
    if (!sequence(seq) || !object(message) || !Number.isInteger(message.base) ||
        message.base < 0 || message.base >= seq) throw new Error("Invalid delta envelope");
    const budget = { left: 150000 };
    if (message.base === 0) {
      if (!object(message.state)) throw new Error("Invalid full snapshot");
      visit(message.state, budget, 0); return message.state;
    }
    const previous = this.states.get(message.base);
    // The sender will use a full frame after a zero acknowledgement. Do not
    // invent missing state or apply a patch to the wrong version of the world.
    if (!previous) return null;
    return apply(previous, message.patch, budget);
  }
}
