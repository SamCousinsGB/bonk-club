// Fighters, shots, pickups and combat outcomes retain their normal update rate
// while large changing terrain uses its own bounded share of the connection.
const keys = ["players", "projectiles", "drops", "scores", "phase", "phaseTime", "round", "arenaIndex",
  "elapsed", "time", "winner", "victoryCause", "events", "inputAcks"];
export function motionState(state) {
  return Object.fromEntries(keys.filter(k => state[k] !== undefined).map(k => [k, state[k]]));
}
export function completeMotion(state) {
  return state && keys.filter(k => k !== "victoryCause").every(k => Object.hasOwn(state, k)) &&
    Object.keys(state).every(k => keys.includes(k));
}
export function mergeMotion(world, motion, sampled = false) {
  if (!world || !motion || world.round !== motion.round || world.arenaIndex !== motion.arenaIndex ||
      !sampled && world.time > motion.time) return world;
  // Copy only explicit actor keys, never guest-supplied terrain or extra fields.
  return { ...world, ...motionState(motion) };
}
