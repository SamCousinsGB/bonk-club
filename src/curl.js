// Shared host/prediction posture. A tuck changes the collision envelope as well
// as the rig; expanding again must fit the surviving terrain around the body.
export const CURL_RADIUS = 26;
export function movementShape(p) {
  return p.curl ? {radius:CURL_RADIUS, top:CURL_RADIUS, bottom:CURL_RADIUS}
    : p.prone ? {radius:34, top:10, bottom:10} : {radius:15, top:28, bottom:30};
}
export function updatePosture(p, input, solids) {
  const curl = !!input.curl && !p.swimming && !p.hangSupport && !p.carryId && !p.freeze && p.stun <= 0;
  const prone = !curl && !!input.duck && !p.swimming && !p.hangSupport;
  p.curlDirection = curl ? Number(input.right)-Number(input.left) : 0;
  if (curl === !!p.curl && prone === p.prone) return;
  const before = movementShape(p), after = movementShape({curl, prone});
  // Keep planted feet fixed; preserve the centre of mass while tucking in air.
  const y = p.y + (p.ground || p.prone || prone ? before.bottom-after.bottom : 0);
  if (solids.some(s => !s.oneWay && s.material !== 'cable' &&
      p.x+after.radius>s.x && p.x-after.radius<s.x+s.w &&
      y+after.bottom>s.y+.01 && y-after.top<s.y+s.h)) return;
  p.curlRecovery = p.curl && !curl ? .18 : 0;
  p.y = y; p.curl = curl; p.prone = prone;
  if (curl) {
    p.block = false; p.blockTime = 0; p.swing = 0;
    if (!p.ground && Math.abs(p.angularVelocity||0)<2)
      p.angularVelocity = Math.max(-8,Math.min(8,p.vx/CURL_RADIUS)) || p.facing*4;
  }
}

export function curlRotation(p, dt) {
  let velocity = p.angularVelocity || 0;
  if (p.ground) {
    // Ground friction couples turn to travel, including a reversed wall bounce.
    velocity += (p.vx/CURL_RADIUS-velocity)*(1-Math.exp(-14*dt));
  } else {
    // Tucking retains spin. Steering supplies bounded torque, never lift or an
    // extra jump; reversing brakes the rotation before starting a backflip.
    const dir = p.curlDirection || 0;
    velocity += (dir*11-velocity)*(1-Math.exp(-(dir ? 4.8 : .12)*dt));
  }
  p.angularVelocity = Math.max(-18, Math.min(18, velocity));
  p.bodyAngle = Math.atan2(Math.sin((p.bodyAngle||0)+p.angularVelocity*dt),
    Math.cos((p.bodyAngle||0)+p.angularVelocity*dt));
}
