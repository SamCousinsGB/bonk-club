import { JOINTS } from "./puppet.js";
import { passiveBody } from "./body-physics.js";

export const TRANSMUTATIONS = ["jelly", "gold", "tangle"];
export const TRANSMUTATION_WEAPONS = {
  jelly: { name: "JELLY GUN", kind: "jelly", damage: 34, force: 880,
    cooldown: .85, ammo: 7, speed: 930, recoil: 120, r: 11,
    range: 1200, rarity: "rare", color: "#aeff76" },
  midas: { name: "MIDAS GUN", kind: "gold", damage: 62, force: 230,
    cooldown: 1.2, ammo: 5, speed: 1500, recoil: 210, r: 6,
    range: 1600, rarity: "exotic", color: "#ffd25a" },
  tangle: { name: "TANGLE GUN", kind: "tangle", damage: 28, force: 580,
    cooldown: .95, ammo: 7, speed: 1100, recoil: 95, r: 10,
    range: 1300, rarity: "rare", color: "#ff9ece" },
};

// Extra distance constraints preserve the struck pose as a solid, tumbling statue.
export function rigidPose(points) {
  return points.flatMap((a, i) => points.slice(i + 1).map((b, j) =>
    [i, i + j + 1, Math.hypot(b.x - a.x, b.y - a.y)]));
}
export function transformedJoints(kind, age, points, pose) {
  if (kind === "gold") return pose || rigidPose(points);
  if (kind === "tangle") {
    const shrink = Math.min(1, age * 4);
    return [...JOINTS.map(([a,b,len]) => [a,b,len * (1 - shrink * .35)]),
      [4,6,12], [8,10,12], [4,2,18], [6,2,18], [8,1,28], [10,1,28]];
  }
  return JOINTS;
}

export function moveTransformed(points, kind, age, solids, dt, pose, pieces = false) {
  passiveBody(points, pieces ? [] : transformedJoints(kind, age, points, pose), solids, dt, {
    gravity: kind === "gold" ? 2900 : 1800,
    restitution: kind === "jelly" ? .94 : pieces ? .48 : .08,
    stiffness: kind === "jelly" && !pieces ? .09 : .5,
    drag: kind === "jelly" ? .998 : .992,
    mass: kind === "gold" ? 3.5 : 1,
  });
}

export function seedTransformedDeath(rag) {
  if (!TRANSMUTATIONS.includes(rag.effect)) return;
  rag.life = 4;
  if (rag.effect === "gold") rag.morphPose = rigidPose(rag.points);
}
export function updateTransformedDeath(rag, solids, dt) {
  if (!TRANSMUTATIONS.includes(rag.effect)) return false;
  const splitAt = rag.effect === "gold" ? 1.15 : rag.effect === "jelly" ? .65 : .9;
  const pieces = rag.deathAge >= splitAt;
  if (pieces && !rag.morphSplit) {
    rag.morphSplit = true;
    for (let i = 0; i < rag.points.length; i++) {
      const p = rag.points[i], a = i * 2.39996;
      p.px = p.x - Math.cos(a) * (rag.effect === "jelly" ? 4 : 2.5);
      p.py = p.y + 2 + Math.abs(Math.sin(a)) * 3;
    }
  }
  moveTransformed(rag.points, rag.effect, rag.deathAge, solids, dt, rag.morphPose, pieces);
  return true;
}

export function validTransmutation(p) {
  return (p.morph === null || TRANSMUTATIONS.includes(p.morph)) &&
    Number.isFinite(p.morphTime) && p.morphTime >= 0 && p.morphTime <= 1.6 &&
    Number.isFinite(p.morphAge) && p.morphAge >= 0 && p.morphAge <= 1.61 &&
    (p.morph !== null || p.morphTime === 0);
}
export function validTransmutationProjectile(p) {
  const w = TRANSMUTATION_WEAPONS[p.weapon];
  if (!w && !TRANSMUTATIONS.includes(p.kind)) return true;
  return !!w && w.kind === p.kind && p.r === w.r && p.life === 1 &&
    Number.isInteger(p.owner) && p.owner >= 0 && p.owner <= 3 &&
    Math.abs(p.vx) <= 5000 && Math.abs(p.vy) <= 6000 &&
    Array.isArray(p.hitIds) && p.hitIds.length <= 4 &&
    p.hitIds.every(id => Number.isInteger(id) && id >= 0 && id <= 3);
}
