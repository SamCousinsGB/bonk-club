// Draw each surviving connected run separately. A severed link must never be
// bridged by curve smoothing, highlights or live electrical effects.
export function cableRuns(cable) {
  const runs = []; let run = [];
  for (let i = 0; i < cable.links.length; i++) {
    if (cable.links[i]) {
      if (!run.length) run.push(cable.points[i]);
      run.push(cable.points[i + 1]);
    } else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs;
}
export function drawCableStroke(c, points, color, width, lift = 0) {
  c.beginPath(); c.moveTo(points[0].x, points[0].y + lift);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], q = points[i + 1];
    c.quadraticCurveTo(p.x, p.y + lift, (p.x + q.x) / 2, (p.y + q.y) / 2 + lift);
  }
  c.lineTo(points.at(-1).x, points.at(-1).y + lift);
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
