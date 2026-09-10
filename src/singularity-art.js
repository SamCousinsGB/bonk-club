import { drawAppearance } from "./identity.js";
const TAU = Math.PI * 2;

function smoothStrand(points) {
  const samples = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i],
      c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < 5; j++) {
      const t = j / 5, t2 = t*t, t3 = t2*t;
      const at = key => .5 * (2*b[key] + (-a[key]+c[key])*t +
        (2*a[key]-5*b[key]+4*c[key]-d[key])*t2 + (-a[key]+3*b[key]-3*c[key]+d[key])*t3);
      samples.push({ x: at("x"), y: at("y") });
    }
  }
  samples.push(points.at(-1));
  return samples;
}

function disk(path, p, radius) {
  path.moveTo(p.x + radius, p.y);
  // Match the ribbon winding so overlapping limbs and the head form one union.
  path.arc(p.x, p.y, radius, 0, TAU, true);
  path.closePath();
}

function addStrand(path, points, rag, border = false) {
  const lower = [], upper = [], radii = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)],
      dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1,
      radius = Math.max(.15, Math.min(2.75, Math.hypot(p.x - rag.targetX, p.y - rag.targetY) / 55)),
      width = border ? radius * 1.35 : radius;
    radii.push(width);
    lower.push({ x: p.x - dy/length*width, y: p.y + dx/length*width });
    upper.push({ x: p.x + dy/length*width, y: p.y - dx/length*width });
  }
  path.moveTo(lower[0].x, lower[0].y);
  for (const p of [...lower.slice(1), ...upper.reverse()]) path.lineTo(p.x, p.y);
  path.closePath();
  disk(path, points[0], radii[0]);
  disk(path, points.at(-1), radii.at(-1));
}

export function drawSingularityBody(r, rag) {
  const c = r.ctx, silhouette = new Path2D(), body = new Path2D();
  for (const strand of rag.strands) {
    const points = smoothStrand(strand.points);
    addStrand(silhouette, points, rag, true);
    addStrand(body, points, rag);
  }
  const head = rag.points[0], radius = Math.min(10, Math.hypot(head.x - rag.targetX, head.y - rag.targetY) / 9);
  if (radius > .15) {
    disk(silhouette, head, radius * 1.15);
    disk(body, head, radius);
  }
  // Fill each whole silhouette once. Per-bone outline/colour pairs leave dark
  // end caps across the next limb, and per-bone fading exposes every overlap.
  c.globalAlpha = Math.min(1, rag.life / .6);
  c.fillStyle = "#071420"; c.fill(silhouette);
  c.fillStyle = rag.color; c.fill(body);
  if (radius > 7) drawAppearance(c,rag,head.x,head.y,
    Math.atan2(head.y-rag.points[1].y,head.x-rag.points[1].x)+Math.PI/2,rag.facing||1);
}
