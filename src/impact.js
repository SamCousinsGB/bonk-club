export const PARRY = { window: 0.16, cooldown: 0.85 };

export function updateParry(p, pressed, dt) {
  p.parryCooldown = Math.max(0, (p.parryCooldown || 0) - dt);
  if (p.block) {
    p.blockTime += dt;
    if (p.blockTime >= PARRY.window || p.weapon || p.stun > 0) p.block = false;
  }
  if (pressed && !p.blockHeld && !p.weapon && p.parryCooldown <= 0 && p.stun <= 0) {
    p.block = true;
    p.blockTime = 0;
    p.parryCooldown = PARRY.cooldown;
  }
  p.blockHeld = pressed;
}

export function canParry(p, source) {
  if (p.weapon || !p.block || p.blockTime >= PARRY.window) return false;
  const angle = p.aimAngle ?? (p.facing > 0 ? 0 : Math.PI);
  return (source.x - p.x) * Math.cos(angle) + (source.y - p.y) * Math.sin(angle) > -5;
}

export function consumeParry(p) {
  p.block = false;
  p.blockTime = PARRY.window;
  p.parryCooldown = Math.max(p.parryCooldown || 0, PARRY.cooldown - PARRY.window);
}

export function carryImpulse(p, seconds = 0.3) {
  p.impactTime = Math.max(p.impactTime || 0, seconds);
  if (p.vy < -25) {
    p.ground = false;
    p.support = null;
    p.coyote = 0;
    p.jumps = Math.max(1, p.jumps);
  }
}

export const NUCLEAR = {
  // Diameter is half the 2560-unit arena. Nothing outside this circle is hit.
  coreRadius: 640,
  waveRadius: 640,
  waveSpeed: 3200,
  meltAt: 0.24,
  duration: 3.2,
  ashDuration: 2.5,
};
