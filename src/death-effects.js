import { JOINTS } from "./puppet.js";
export const DEATH_EFFECTS = [
  "slice",
  "plasma",
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
    rag.life = 1.5;
    rag.targetX = target.x;
    rag.targetY = target.y;
    rag.stretchOrigin = rag.points.map((p) => ({ x: p.x, y: p.y }));
  }
}
export function updateDeath(rag, dt) {
  if (!rag.effect) return false;
  rag.deathAge += dt;
  if (rag.effect === "ice" && rag.deathAge < 0.4) return true;
  if (rag.effect !== "singularity") return false;
  const t = Math.min(1, rag.deathAge / 1.5),
    cx = rag.stretchOrigin[2].x,
    cy = rag.stretchOrigin[2].y;
  const angle = Math.atan2(cy - rag.targetY, cx - rag.targetX) + t * 5;
  const distance =
    Math.hypot(cx - rag.targetX, cy - rag.targetY) * (1 - t) ** 1.7;
  for (let i = 0; i < rag.points.length; i++) {
    const source = rag.stretchOrigin[i],
      along = (source.y - cy) * (0.9 + Math.sin(t * Math.PI) * 4.5);
    const across = (source.x - cx) * (1 - t) * 0.65;
    const arc = angle + (along / Math.max(80, distance)) * 0.45;
    const radius = Math.max(0, distance + along * (1 - t));
    const p = rag.points[i];
    p.x = rag.targetX + Math.cos(arc) * radius - Math.sin(arc) * across;
    p.y = rag.targetY + Math.sin(arc) * radius + Math.cos(arc) * across;
    p.px = p.x;
    p.py = p.y;
  }
  return true;
}
