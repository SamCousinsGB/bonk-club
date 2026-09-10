// Swept point against an expanded rectangle: fast shots cannot skip thin cover.
export function segmentBox(x, y, endX, endY, box, radius = 0) {
  const dx = endX - x,
    dy = endY - y;
  let near = 0,
    far = 1,
    nx = 0,
    ny = 0;
  for (const [start, delta, min, max, axis] of [
    [x, dx, box.x - radius, box.x + box.w + radius, 0],
    [y, dy, box.y - radius, box.y + box.h + radius, 1],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }
    let a = (min - start) / delta,
      b = (max - start) / delta;
    if (a > b) [a, b] = [b, a];
    if (a >= near) {
      near = a;
      nx = axis === 0 ? -Math.sign(delta) : 0;
      ny = axis === 1 ? -Math.sign(delta) : 0;
    }
    far = Math.min(far, b);
    if (near > far) return null;
  }
  if (!nx && !ny) {
    nx = Math.abs(dx) >= Math.abs(dy) ? -Math.sign(dx) : 0;
    ny = nx ? 0 : -Math.sign(dy) || -1;
  }
  return { t: near, nx, ny };
}

export function playerBox(p) {
  if(p.knockdown>0&&p.rig){const x=Math.min(...p.rig.map(q=>q.x))-5,y=Math.min(...p.rig.map(q=>q.y))-8;return {x,y,w:Math.max(...p.rig.map(q=>q.x))+5-x,h:Math.max(...p.rig.map(q=>q.y))+5-y};}
  const rx = p.prone ? 34 : 18,
    ry = p.prone ? 10 : 28;
  return { x: p.x - rx, y: p.y - ry, w: rx * 2, h: ry * 2 };
}
