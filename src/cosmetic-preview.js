import { makeRig } from "./puppet.js";

// The preview uses the same scale, material, cloth, trail and head renderers as play.
export function previewFighter(profile, pose, time) {
  const running = pose === "Run", jumping = pose === "Jump";
  const phase = time * 8, bounce = jumping ? Math.max(0, Math.sin(time * 2.5)) * 18 : running ? Math.sin(phase * 2) * 1.5 : Math.sin(time * 2) * .6;
  const x = running ? Math.sin(time * 1.4) * 19 : 0;
  const p = { ...profile, id: 0, x, y: -bounce, vx: running ? Math.cos(time * 1.4) * 220 : 0,
    vy: jumping ? -Math.cos(time * 2.5) * 160 : 0, alive: true, facing: 1,
    ground: !jumping, hp: 100, aimAngle: 0, parryCooldown: 0 };
  p.rig = makeRig(p);
  if (running || jumping) {
    for (const [id,sign] of [[7,1],[8,1],[9,-1],[10,-1]]) {
      p.rig[id].x += Math.sin(phase) * (id%2 ? 9 : 19) * sign;
      p.rig[id].y -= Math.max(0, Math.cos(phase) * sign) * (id%2 ? 7 : 15);
    }
    for(const [id,sign] of [[3,1],[4,1],[5,-1],[6,-1]]) {
      p.rig[id].x += Math.sin(phase) * (id%2 ? 6 : 13) * sign;
      p.rig[id].y -= 5;
    }
  }
  return p;
}
