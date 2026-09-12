import { seedOrbit, orbitPoint, limitRope } from "./orbit.js";
import { WEAPONS } from "./arsenal.js";
import { JOINTS } from "./puppet.js";
import { TRANSMUTATIONS, seedTransformedDeath, rigidPose } from "./transmutation.js";
export const DEATH_EFFECTS = [
  ...TRANSMUTATIONS,
  "slice",
  "gib",
  "bubble",
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
// A head, torso, two arms and two legs; no constraints reconnect the pieces.
export const BUBBLE_JOINTS = JOINTS.filter((_, i) => [1, 3, 5, 7, 9].includes(i));
export function projectileEffect(b) {
  if (TRANSMUTATIONS.includes(b.kind)) return b.kind;
  if (["saw", "rail"].includes(b.kind)) return "slice";
  if (["plasma", "tesla"].includes(b.kind)) return b.kind;
  if (b.kind === "frost") return "ice";
  if (b.kind === "flame") return "burn";
  if (["rocket", "grenade", "duck"].includes(b.kind)) return "blast";
  if (WEAPONS[b.weapon]?.dismember) return "gib";
  return null;
}
export function deathPose(rag, effect, angle = 0, target = null) {
  if (!effect) return;
  Object.assign(rag, { effect, deathAge: 0 });
  seedTransformedDeath(rag);
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
  } else if (effect === "bubble") {
    const pieces = [[0], [1, 2], [3, 4], [5, 6], [7, 8], [9, 10]];
    const angles = [-Math.PI / 2, -.3, -2.65, -.7, 2.4, .55];
    pieces.forEach((ids, i) => {
      const speed = i === 1 ? 180 : 340 + (i % 3) * 55;
      const cx = ids.reduce((s, n) => s + rag.points[n].x, 0) / ids.length;
      const cy = ids.reduce((s, n) => s + rag.points[n].y, 0) / ids.length;
      for (const n of ids) {
        const p = rag.points[n], spin = i % 2 ? 11 : -11;
        p.px -= (Math.cos(angles[i]) * speed - (p.y - cy) * spin) / 120;
        p.py -= (Math.sin(angles[i]) * speed - 100 + (p.x - cx) * spin) / 120;
      }
    });
  } else if (effect === "ice") {
    rag.life = 1.9;
    rag.morphPose = rigidPose(rag.points);
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
  if (rag.effect !== "singularity") return false;
  const center = { x: rag.targetX, y: rag.targetY };
  for (const p of new Set(rag.strands.flatMap((s) => s.points)))
    orbitPoint(p, center, dt, 1.5);
  for (const strand of rag.strands) limitRope(strand.points, strand.rest, 7);
  return true;
}

export function deathJoints(rag) {
  if (rag.effect === "ice") return rag.deathAge < .4 ? rag.morphPose : [];
  if (rag.ash) return JOINTS.filter((_, i) => !crumbledBone(rag, i));
  if (rag.effect === "bubble") return BUBBLE_JOINTS;
  return rag.effect === "slice"
    ? CUT_JOINTS
    : rag.effect === "blast"
      ? JOINTS.filter(([a]) => a !== 1 && a !== 2)
      : rag.effect === "gib"
        ? JOINTS.filter((_, i) => !rag.severed.includes(i))
        : JOINTS;
}

// Release individual joints while the same particles keep their momentum and
// world contacts. The ages already travel in snapshots, including hot joins.
export function crumbledBone(rag, index) {
  if (!rag.ash) return false;
  const start = rag.effect === "burn" ? .85 : .65;
  return rag.ashAge >= start + ((index * 7) % 10) * .045;
}

// Broken bones become short chips at their physical particle, never long lines
// joining independently falling pieces. Guests derive the same art from age.
export function deathSegments(rag) {
  return JOINTS.map(([a, b, len], i) => {
    const p = rag.points[a], q = rag.points[b];
    if (!crumbledBone(rag, i)) return [p, q];
    const angle = i * 2.4 + rag.ashAge * (i % 2 ? 5 : -4);
    const size = Math.min(6, len * .3);
    return [{ x: q.x - Math.cos(angle) * size, y: q.y - Math.sin(angle) * size }, q];
  });
}
