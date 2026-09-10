// Shared by the arm motors, weapon drawing and authoritative swept contacts.
export const MELEE_SWINGS = {
  bat: { duration: 0.44, length: 64, artLength: 34, radius: 6 },
  sword: { duration: 0.34, length: 80, artLength: 47, radius: 4 },
};
export const SWING_START = 0.18;
export const SWING_END = 0.7;
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { const t = clamp(v); return t * t * (3 - 2 * t); };

export function meleePose(p, progress) {
  const config = MELEE_SWINGS[p.weapon];
  if (!config) return null;
  const attacking = p.swing > 0 && p.meleeMove === "weapon";
  const t = progress ?? (attacking ? clamp(1 - p.swing / p.swingDuration) : 1);
  const aim = p.aimAngle ?? (p.facing === 1 ? 0 : Math.PI);
  const side = Math.abs(Math.cos(aim)) > 0.1 ? Math.sign(Math.cos(aim)) : p.facing;
  const offset = t < SWING_START
    ? -0.65 - 1.3 * ease(t / SWING_START)
    : t < SWING_END
      ? -1.95 + 3.2 * ease((t - SWING_START) / (SWING_END - SWING_START))
      : 1.25 - 1.9 * ease((t - SWING_END) / (1 - SWING_END));
  return { ...config, progress: t, side, angle: aim + offset * side,
    armAngle: aim + offset * side * 0.72,
    active: attacking && t >= SWING_START && t <= SWING_END };
}

export function meleeBlade(p, progress) {
  const pose = meleePose(p, progress);
  if (!pose) return null;
  const hand = p.rig?.[6] || { x: p.x + Math.cos(pose.armAngle) * 30,
    y: p.y - 26 + Math.sin(pose.armAngle) * 30 };
  return { ...pose, x: hand.x, y: hand.y,
    tipX: hand.x + Math.cos(pose.angle) * pose.length,
    tipY: hand.y + Math.sin(pose.angle) * pose.length };
}
