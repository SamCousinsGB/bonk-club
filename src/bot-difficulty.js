export const BOT_DIFFICULTIES = {
  easy: { reaction: 0.38, memory: 0.24, error: 0.15, lead: 0.35, burst: 0.48, rest: 0.7, defence: 0.18 },
  normal: { reaction: 0.22, memory: 0.13, error: 0.075, lead: 0.65, burst: 0.8, rest: 0.38, defence: 0.45 },
  hard: { reaction: 0.06, memory: 0.04, error: 0.012, lead: 1, burst: 1.3, rest: 0.12, defence: 0.85 },
};
export const cleanDifficulty = (value) => Object.hasOwn(BOT_DIFFICULTIES, value) ? value : "easy";

// Combat mistakes are separate from navigation so an easier bot can still use
// elevators, clear cover and complete its planned jumps.
export function combatPerception(b, enemy, weapon, time, random, difficulty) {
  const d = BOT_DIFFICULTIES[cleanDifficulty(difficulty)];
  if (b.combatTarget !== enemy.id || b.combatWeapon !== weapon) {
    b.combatTarget = enemy.id;
    b.combatWeapon = weapon;
    b.fireAt = time + d.reaction * (0.85 + random() * 0.5);
    b.burstEnd = b.fireAt + d.burst;
    b.observeAt = 0;
  }
  if (time >= b.observeAt || !b.seen) {
    b.seen = { x: enemy.x, y: enemy.y, vx: enemy.vx * d.lead, vy: enemy.vy * d.lead };
    b.observeAt = time + d.memory * (0.8 + random() * 0.4);
    // A sustained offset, rather than perfectly centred jitter on every bullet.
    b.aimError = (random() * 2 - 1) * d.error;
  }
  if (time > b.burstEnd) {
    b.fireAt = time + d.rest * (0.8 + random() * 0.4);
    b.burstEnd = b.fireAt + d.burst * (0.8 + random() * 0.4);
  }
  return { enemy: b.seen, error: b.aimError, fire: time >= b.fireAt };
}
