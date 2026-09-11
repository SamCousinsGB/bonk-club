import { JOINTS } from "./puppet.js";

function polygon(c, points, fill, stroke = null, width = 1) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (const p of points.slice(1)) c.lineTo(...p);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}

// Each crystal follows a bone, so bent arms, spread legs and prone bodies keep
// their silhouette. Facets enclose the actual pose rather than its bounding box.
export function drawFrozenBody(r, points, alpha = 1) {
  const c = r.ctx;
  c.save();
  c.globalAlpha *= alpha;
  c.lineJoin = "round";
  for (const [index, [a, b]] of JOINTS.entries()) {
    const start = points[a], end = points[b],
      dx = end.x - start.x, dy = end.y - start.y,
      length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx),
      width = index === 1 ? 10 : 7 + index % 3;
    c.save(); c.translate(start.x, start.y); c.rotate(angle);
    const shell = [[-5, -width * .35], [1, -width], [length - 2, -width * .8],
      [length + 6, -2], [length + 3, width * .75], [2, width], [-5, width * .4]];
    polygon(c, shell, "#74cceba0", "#c5f5ff", 1.25);
    polygon(c, [shell[0], shell[1], shell[2], [length * .65, -1], [2, 2]], "#edffff90");
    polygon(c, [[2, 2], [length * .65, -1], shell[3], shell[4], shell[5]], "#247fc566");
    r.line([[2, -width + 1], [length - 3, -width * .8 + 1]], "#ffffff", 1.6);
    // Short, branching internal fractures read as ice at the gameplay scale.
    r.line([[length * .33, -width + 2], [length * .51, -1],
      [length * .4, width - 2]], "#efffffbb", .9);
    r.line([[length * .51, -1], [length * .79, 3]], "#165c9777", .8);
    c.restore();
  }
  const head = points[0], neck = points[1];
  c.save(); c.translate(head.x, head.y);
  c.rotate(Math.atan2(head.y - neck.y, head.x - neck.x) + Math.PI / 2);
  const shell = [[-9, -16], [5, -18], [15, -9], [17, 5], [8, 15], [-8, 16], [-17, 5], [-16, -8]];
  polygon(c, shell, "#88d8ee88", "#d9fbff", 1.6);
  polygon(c, [shell[0], shell[1], shell[2], [4, -3], [-12, 1], shell[7]], "#f2ffff77");
  polygon(c, [[4, -3], shell[2], shell[3], shell[4], [1, 11]], "#257db566");
  r.line([shell[7], shell[0], shell[1]], "#ffffff", 2);
  r.line([[5, -17], [4, -3], [-1, 2], [2, 12]], "#efffffc0", 1);
  r.line([[-1, 2], [-10, 6], [-15, 4]], "#efffffa0", .8);
  c.restore();
  // A few attached crystal tips and flecks; no persistent particle state.
  for (const [index, id] of [3, 4, 6, 8, 10].entries()) {
    const p = points[id], side = index % 2 ? 1 : -1;
    polygon(c, [[p.x, p.y - 3], [p.x + side * 8, p.y - 12], [p.x + side * 7, p.y + 3]],
      "#b9f1ffd0", "#edffff", .8);
    r.circle(p.x + side * 13, p.y - 8, 1.1, "#e7ffffb0");
  }
  c.restore();
}
