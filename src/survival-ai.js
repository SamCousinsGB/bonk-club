import { bodyBounds } from "./props.js";
import { steer } from "./navigation.js";

// These are ordinary control decisions. Bots receive no extra speed, jumps,
// health or immunity, and their existing imperfect combat aim is unchanged.
export function survivalControls(world, p, b, input, solids) {
  const mode = world.arena.survival?.kind;
  if (!mode) return;
  const supported = x => world.platforms.some(s => s.hp !== 0 && x > s.x + 22 && x < s.x + s.w - 22 && Math.abs(s.y - (p.y + 30)) < 65);
  const override = (x, jump = false) => {
    b.flight = null; b.recovery = null;
    Object.assign(input, steer(p, x), {jump, duck:false, block:false, attack:false});
  };
  if (mode === "press") {
    const dangerous = world.hazards.filter(h => !h.done && (h.warning > 0 || h.active));
    const unsafe = x => dangerous.some(h => x > h.x - h.w / 2 - 30 && x < h.x + h.w / 2 + 30);
    // An unarmed strike lunges along the aim even with no movement key held.
    const lunge = input.attack && !p.weapon ? Math.sign(Math.cos(input.aim ?? (p.facing < 0 ? Math.PI : 0))) * 150 : 0;
    const projected = p.x + p.vx * .22 + (Number(input.right) - Number(input.left)) * 40 + lunge;
    if (unsafe(p.x) || unsafe(projected)) {
      const candidates = [p.x, ...dangerous.flatMap(h => [h.x - h.w / 2 - 44, h.x + h.w / 2 + 44])]
        .filter(x => supported(x) && !unsafe(x)).sort((a, c) => Math.abs(a - projected) - Math.abs(c - projected));
      if (candidates.length) override(candidates[0]);
    }
    return;
  }
  const roof = solids.some(s => s.y + s.h < p.y - 25 && s.y + s.h > p.y - 210 && p.x + 20 > s.x && p.x - 20 < s.x + s.w);
  let threat = null, soon = .52;
  if (mode === "cargo") {
    for (const cargo of world.cover) {
      if (cargo.hp <= 0) continue;
      const box = bodyBounds(cargo), relative = cargo.vx - p.vx;
      if (Math.abs(relative) < 90 || p.y + 30 < box.y - 5 || p.y - 28 > box.y + box.h) continue;
      const dx = box.x + box.w / 2 - p.x;
      if (dx * relative >= 0) continue;
      const t = Math.max(0, (Math.abs(dx) - box.w / 2 - 30) / Math.abs(relative));
      if (t < soon) { soon = t; threat = {x:box.x + box.w / 2}; }
    }
  } else {
    for (const saw of world.hazards) {
      if (saw.done || (!saw.active && !saw.warning) || Math.abs(p.y + 30 - saw.y) > 300) continue;
      // Predict the curved rail motion, including its reversal at either end.
      for (let t = .06; t < soon; t += .06) {
        const x = saw.x + Math.sin((saw.age + t) * (saw.motionSpeed ?? 1.65) + (saw.motionPhase || 0)) * (saw.w / 2 - 28);
        if (!p.ground && p.y + 30 + p.vy * t + 900 * t * t < saw.y - 58) continue;
        if (Math.abs(x - (p.x + p.vx * t)) < 60) { soon = t; threat = {x:saw.bodyX}; break; }
      }
    }
  }
  const airDodge = mode === "sweep" && !p.ground && p.jumps === 1 && p.vy > -80 && soon < .38;
  if (threat && !roof && (airDodge || (p.ground && world.time >= (b.survivalJumpAt || 0)))) {
    const dir = mode === "sweep" && p.x > 1900 ? -1 : mode === "sweep" && p.x < 660 ? 1 : Math.sign(threat.x - p.x) || 1;
    b.survivalLanding = Math.max(190, Math.min(2370, p.x + dir * 180));
    b.survivalUntil = world.time + .65;
    b.survivalJumpAt = world.time + .75;
    override(b.survivalLanding, true);
  } else if (!p.ground && world.time < (b.survivalUntil || 0)) {
    override(b.survivalLanding);
  } else if (mode === "cargo" && p.ground && (p.x < 360 || p.x > 2190)) {
    // Keep a braking margin at the ends of the belt, without jumping forever.
    override(p.x < 360 ? 540 : 2010);
  }
}
