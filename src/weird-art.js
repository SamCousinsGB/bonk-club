import { JOINTS } from "./puppet.js";

export function drawBubble(r, x, y, size, life = 1) {
  const c = r.ctx;
  r.circle(x, y, size, "#89ddff19");
  c.save(); c.lineWidth = 2.5; c.strokeStyle = life < .2 ? "#ffe9b9" : "#c7f6ff";
  c.beginPath(); c.arc(x, y, size, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = "#efb4ff"; c.beginPath(); c.arc(x, y, size - 3, .2, 1.7); c.stroke();
  c.strokeStyle = "#ffffff"; c.lineWidth = 3;
  c.beginPath(); c.arc(x - 2, y - 2, size - 6, 3.5, 4.45); c.stroke(); c.restore();
}

function duck(r, x, y, angle = 0) {
  const c = r.ctx; c.save(); c.translate(x, y); c.rotate(angle);
  c.fillStyle = "#ffe159"; c.beginPath(); c.ellipse(-2, 4, 16, 11, 0, 0, Math.PI * 2); c.fill();
  r.circle(8, -8, 10, "#fff076");
  r.line([[15, -7], [23, -5], [15, -3]], "#ff923e", 5);
  r.circle(11, -10, 2, "#273444");
  r.line([[-10, 2], [-3, 8], [5, 4]], "#e8b82c", 2);
  c.restore();
}
function boomerang(r, x, y, angle) {
  const c = r.ctx; c.save(); c.translate(x, y); c.rotate(angle);
  r.line([[-21, 13], [0, -10], [21, 13]], "#482d2c", 11);
  r.line([[-21, 13], [0, -10], [21, 13]], "#ffc67b", 7);
  r.line([[-15, 7], [-10, 1]], "#74e5d1", 6);
  r.line([[10, 1], [15, 7]], "#74e5d1", 6); c.restore();
}
export function drawWeirdWeapon(r, type) {
  const c = r.ctx;
  if (type === "boomerang") { boomerang(r, 8, 0, -.5); return true; }
  if (!["bubble", "duck"].includes(type)) return false;
  c.fillStyle = "#37475d"; c.fillRect(-18, -11, 42, 22); c.fillRect(-7, 8, 9, 17);
  c.fillStyle = type === "bubble" ? "#dd9eff" : "#ffe159"; c.fillRect(-16, -9, 30, 6);
  if (type === "bubble") {
    r.circle(-10, 2, 10, "#94dfffa0");
    r.line([[17, 0], [39, 0]], "#a7e9ef", 8);
    drawBubble(r, 42, 0, 13); r.circle(-12, -1, 3, "#ffffff");
  } else {
    r.line([[12, 0], [46, 0]], "#8da8ae", 16);
    r.line([[44, -11], [44, 11]], "#ffc755", 5);
    duck(r, -7, -14);
  }
  return true;
}
export function drawWeirdProjectile(r, b, time) {
  if (b.kind === "bubble") drawBubble(r, b.x, b.y, b.r);
  else if (b.kind === "boomerang") {
    boomerang(r, b.x, b.y, time * 24);
    r.circle(b.x, b.y, 26, b.returning ? "#90ffe519" : "#ffcd8714");
  } else if (b.kind === "duck") {
    duck(r, b.x, b.y, Math.atan2(b.vy, b.vx));
    if (b.life < .65) r.circle(b.x - 7, b.y - 10, 4, Math.sin(time * 30) > 0 ? "#ff603f" : "#fff5b8");
  } else return false;
  return true;
}
export function drawBurning(r, p, time) {
  const c = r.ctx, rig = p.rig;
  c.save(); c.globalAlpha = Math.min(.85, (1 - p.hp / 100) * .95);
  for (const [a, b] of JOINTS)
    r.line([[rig[a].x-p.x, rig[a].y-p.y], [rig[b].x-p.x, rig[b].y-p.y]], "#34211c", 7);
  r.circle(rig[0].x-p.x, rig[0].y-p.y, 11, "#34211c"); c.globalAlpha = 1;
  // Fixed, pose-following tongues cover limbs as well as the torso; no particles accumulate.
  for (let n = 0; n < 14; n++) {
    const q = rig[n % rig.length], x = q.x-p.x, y = q.y-p.y;
    const flicker = r.reduced ? .5 : (Math.sin(time * 17 + n * 2.4) + 1) / 2;
    const sway = r.reduced ? 0 : Math.sin(time * 9 + n) * 6;
    c.fillStyle = "#ff682a99";
    c.beginPath(); c.moveTo(x-6, y+3); c.quadraticCurveTo(x-10, y-9, x+sway, y-19-flicker*15);
    c.quadraticCurveTo(x+11, y-8, x+6, y+3); c.closePath(); c.fill();
    r.circle(x, y-4, 3 + flicker*2, "#ffd573bb");
  }
  c.restore();
}
