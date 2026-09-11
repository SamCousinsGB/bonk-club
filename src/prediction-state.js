// Host-authored movement state needed to replay unacknowledged controls. These
// values never arrive from a guest; positions, hits and world state stay on host.
const numbers = ["coyote", "jumpBuffer", "stun", "impactTime", "angularVelocity",
  "landing", "gaitSpeed", "cooldown", "pickupCooldown"];
const flags = ["jumpHeld", "blockHeld", "airLunge", "throwHeld"];
export function motionState(p) {
  return { ...Object.fromEntries(numbers.map(k => [k, p[k] || 0])),
    ...Object.fromEntries(flags.map(k => [k, !!p[k]])), support: p.support ?? null };
}
export function validMotion(m) {
  return m && numbers.every(k => Number.isFinite(m[k]) && Math.abs(m[k]) <= 10000) &&
    flags.every(k => typeof m[k] === "boolean") &&
    (m.support === null || typeof m.support === "string" && m.support.length <= 160);
}
export const validInputSequence = n => Number.isSafeInteger(n) && n >= 0;
