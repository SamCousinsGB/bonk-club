import { seedOrbit, orbitPoint, limitRope } from "./orbit.js";
import { WEAPONS } from "./arsenal.js";
import { JOINTS } from "./puppet.js";
export const DEATH_EFFECTS = [
  "slice",
  "gib",
  "impale",
  "plasma",
  "phaser",
  "tesla",
  "ice",
  "burn",
  "blast",
  "singularity",
];
export const CUT_JOINTS = [
  ...JOINTS.filter(([a, b]) => a !== 1 || b !== 2),
  [1, 11, 11.5],
  [12, 2, 11.5],
];
export function projectileEffect(b) {
  if (["saw", "rail"].includes(b.kind)) return "slice";
  if (["plasma", "tesla"].includes(b.kind)) return b.kind;
  if (b.kind === "frost") return "ice";
  if (b.kind === "flame") return "burn";
  if (["rocket", "grenade"].includes(b.kind)) return "blast";
  if (WEAPONS[b.weapon]?.dismember) return "gib";
  return null;
}
export function deathPose(rag, effect, angle = 0, target = null) {
  if (!effect) return;
  Object.assign(rag, { effect, deathAge: 0 });
  if (effect === "slice") {
    const a = rag.points[1],
      b = rag.points[2];
    const middle = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      px: (a.px + b.px) / 2,
      py: (a.py + b.py) / 2,
    };
    rag.points.push({ ...middle }, { ...middle });
    const upper = new Set([0, 1, 3, 4, 5, 6, 11]);
    for (let i = 0; i < rag.points.length; i++) {
      const p = rag.points[i],
        side = upper.has(i) ? -1 : 1;
      p.px -= (-Math.sin(angle) * side * 220 + Math.cos(angle) * 100) / 120;
      p.py -= (Math.cos(angle) * side * 220 - 110) / 120;
    }
  } else if (effect === "gib") {
    rag.severed = Math.cos(angle) >= 0 ? [4, 6] : [2, 8];
    for (let n = 0; n < rag.points.length; n++) {
      const p = rag.points[n];
      p.px -= Math.sin(n * 4.2) * 2.5;
      p.py += Math.cos(n * 2.1) * 2;
    }
  } else if (effect === "ice") {
    rag.life = 1.9;
    for (const p of rag.points) {
      p.px = p.x;
      p.py = p.y;
    }
  } else if (effect === "blast") {
    rag.life = 3;
    for (let i = 0; i < rag.points.length; i++) {
      const p = rag.points[i];
      p.px -= Math.sin(i * 7.1) * 2;
      p.py += Math.cos(i * 2.3) * 2;
    }
  } else if (effect === "singularity") {
    rag.life = 4.6;
    rag.targetX = target.x;
    rag.targetY = target.y;
    rag.strands = JOINTS.map(([a, b, len]) => ({
      rest: len / 5,
      points: Array.from({ length: 6 }, (_, i) =>
        i === 0
          ? rag.points[a]
          : i === 5
            ? rag.points[b]
            : {
                x:
                  rag.points[a].x +
                  ((rag.points[b].x - rag.points[a].x) * i) / 5,
                y:
                  rag.points[a].y +
                  ((rag.points[b].y - rag.points[a].y) * i) / 5,
              },
      ),
    }));
    for (const p of new Set(rag.strands.flatMap((s) => s.points)))
      seedOrbit(p, target, 1.5);
  }
}
export function updateDeath(rag, dt) {
  if (!rag.effect) return false;
  rag.deathAge += dt;
  if (rag.effect === "ice" && rag.deathAge < 0.4) return true;
  if (rag.effect !== "singularity") return false;
  const center = { x: rag.targetX, y: rag.targetY };
  for (const p of new Set(rag.strands.flatMap((s) => s.points)))
    orbitPoint(p, center, dt, 1.5);
  for (const strand of rag.strands) limitRope(strand.points, strand.rest, 7);
  return true;
}

export function deathJoints(rag) {
  return rag.effect === "slice"
    ? CUT_JOINTS
    : rag.effect === "blast"
      ? JOINTS.filter(([a]) => a !== 1 && a !== 2)
      : rag.effect === "gib"
        ? JOINTS.filter((_, i) => !rag.severed.includes(i))
        : JOINTS;
}
