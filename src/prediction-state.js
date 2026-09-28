// Host-authored movement state needed to replay unacknowledged controls. These
// values never arrive from a guest; positions, hits and world state stay on host.
const numbers = ["dropThrough", "coyote", "jumpBuffer", "stun", "impactTime", "angularVelocity",
  "landing", "gaitSpeed", "cooldown", "pickupCooldown", "hangX"];
const flags = ["jumpHeld", "blockHeld", "airLunge", "throwHeld", "duckHeld"];
export function motionState(p) {
  return { ...Object.fromEntries(numbers.map(k => [k, p[k] || 0])),
    ...Object.fromEntries(flags.map(k => [k, !!p[k]])), support: p.support ?? null,
    hangSupport: p.hangSupport ?? null,
    hangMotion: p.hangSupport ? {...p.hangMotion} : null,
    hangVelocity: p.hangSupport && p.rig ? p.rig.map(q => ({x:q.x-q.px, y:q.y-q.py})) : null };
}
export function validMotion(m) {
  return m && numbers.every(k => Number.isFinite(m[k]) && Math.abs(m[k]) <= 10000) &&
    m.dropThrough >= 0 && m.dropThrough <= .22 &&
    (m.hangSupport===null ? m.hangMotion===null : validHangMotion(m.hangMotion)) &&
    (m.hangSupport === null ? m.hangVelocity === null : Array.isArray(m.hangVelocity) &&
      m.hangVelocity.length === 11 && m.hangVelocity.every(q => q &&
        Number.isFinite(q.x) && Number.isFinite(q.y) && Math.abs(q.x) <= 100 && Math.abs(q.y) <= 100)) &&
    flags.every(k => typeof m[k] === "boolean") &&
    (m.support === null || typeof m.support === "string" && m.support.length <= 160) &&
    (m.hangSupport === null || typeof m.hangSupport === "string" && m.hangSupport.length <= 160);
}
function validHangMotion(s) {
  return s && ["age","left","right","moving","time","from","to","center","startY","climb"].every(k=>Number.isFinite(s[k])) &&
    s.age>=0 && s.age<=2 && [-1,0,1].includes(s.moving) && s.time>=0 && s.time<=.6 &&
    ["left","right","from","to"].every(k=>s[k]>=0&&s[k]<=10000) &&
    Math.abs(s.center)<=10000 && Math.abs(s.startY)<=150 && (s.climb===-1||s.climb>=0&&s.climb<=.95);
}
export const validInputSequence = n => Number.isSafeInteger(n) && n >= 0;
