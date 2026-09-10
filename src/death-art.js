import { JOINTS } from "./puppet.js";
import { deathJoints } from "./death-effects.js";
import { drawAshSkeleton } from "./nuclear-art.js";
import { drawHair } from "./identity.js";
function energy(r, points, color, time) {
  const c = r.ctx;
  c.save();
  c.globalAlpha = 0.25;
  for (const [a, b] of JOINTS)
    r.line(
      [
        [points[a].x, points[a].y],
        [points[b].x, points[b].y],
      ],
      color,
      13,
    );
  c.globalAlpha = 0.8;
  for (let n = 0; n < 5; n++) {
    const a = points[n * 2],
      b = points[(n * 2 + 4) % 11],
      dx = b.x - a.x,
      dy = b.y - a.y;
    r.line(
      Array.from({ length: 5 }, (_, i) => [
        a.x + (dx * i) / 4 + (i % 4 ? Math.sin(time * 35 + n + i) * 6 : 0),
        a.y + (dy * i) / 4,
      ]),
      color,
      1.5,
    );
  }
  c.restore();
}
function ice(r, pts, alpha = 1) {
  const c = r.ctx,
    x = Math.min(...pts.map((p) => p.x)) - 10,
    y = Math.min(...pts.map((p) => p.y)) - 14;
  const w = Math.max(...pts.map((p) => p.x)) - x + 10,
    h = Math.max(...pts.map((p) => p.y)) - y + 13;
  c.save();
  c.globalAlpha = alpha;
  c.beginPath();
  c.moveTo(x + 7, y);
  c.lineTo(x + w - 10, y + 3);
  c.lineTo(x + w, y + h * 0.4);
  c.lineTo(x + w - 5, y + h);
  c.lineTo(x + 5, y + h - 2);
  c.lineTo(x, y + h * 0.3);
  c.closePath();
  c.fillStyle = "#98e8ff66";
  c.fill();
  c.strokeStyle = "#d7fbff";
  c.lineWidth = 2;
  c.stroke();
  r.line(
    [
      [x + 7, y + 5],
      [x + w * 0.56, y + h * 0.36],
      [x + w - 8, y + h - 4],
    ],
    "#e3fdff88",
    2,
  );
  r.line(
    [
      [x + w - 10, y + 3],
      [x + w * 0.56, y + h * 0.36],
      [x + 4, y + h * 0.72],
    ],
    "#66beeaaa",
    2,
  );
  r.line(
    [
      [x + 7, y + 4],
      [x + 3, y + h * 0.3],
    ],
    "#ffffff",
    3,
  );
  c.restore();
}
export function drawStatus(r, p, time) {
  if (!p.alive || !p.rig) return;
  if (p.xray > 0) {
    const color = p.xrayType === "phaser" ? "#89ffce" : p.xrayType === "plasma" ? "#8bf5ff" : "#cfabff";
    energy(r, p.rig, color, r.reduced ? 0 : time);
    drawAshSkeleton(r, { points: p.rig, life: 1, ashAge: 0 });
  }
  if (p.freeze > 0) ice(r, p.rig, Math.min(1, p.freeze * 4));
}
export function drawDeath(r, rag, time) {
  if (!rag.effect) return false;
  const c = r.ctx,
    pts = rag.points,
    age = rag.deathAge;
  c.save();
  if (["plasma", "tesla", "phaser"].includes(rag.effect)) {
    c.globalAlpha = Math.min(1, rag.life);
    energy(
      r,
      pts,
      rag.effect === "phaser" ? "#89ffce" : rag.effect === "plasma" ? "#80f5ff" : "#c1a0ff",
      r.reduced ? 0 : time,
    );
    drawAshSkeleton(r, rag);
  } else if (rag.effect === "burn") {
    c.globalAlpha = Math.min(1, rag.life) * Math.max(0, 1 - age / 1.8);
    for (const [a, b] of JOINTS)
      r.line(
        [
          [pts[a].x, pts[a].y],
          [pts[b].x, pts[b].y],
        ],
        "#251d1b",
        6,
      );
    r.circle(pts[0].x, pts[0].y, 10, "#322520");
    for (let n = 0; n < 28; n++) {
      const p = pts[n % 11];
      c.globalAlpha = Math.min(1, rag.life) * (0.3 + (n % 4) * 0.15);
      r.circle(
        p.x + Math.sin(n * 17 + age) * age * 17,
        p.y - age * (20 + (n % 7) * 12),
        1.3 + (n % 2),
        n % 3 ? "#ed8f37" : "#ffd36a",
      );
    }
  } else if (rag.effect === "ice") {
    const fade = Math.max(0, 1 - Math.max(0, age - 0.4) * 3);
    c.globalAlpha = fade;
    for (const [a, b] of JOINTS)
      r.line(
        [
          [pts[a].x, pts[a].y],
          [pts[b].x, pts[b].y],
        ],
        "#bfefff",
        5,
      );
    r.circle(pts[0].x, pts[0].y, 10, "#e4fcff");
    ice(r, pts, fade);
    const t = Math.max(0, age - 0.4);
    for (let n = 0; n < 38; n++) {
      const p = pts[n % 11],
        a = n * 2.39996,
        x = p.x + Math.cos(a) * t * (45 + (n % 6) * 25),
        y = p.y + Math.sin(a) * t * 90 + t * t * 160;
      c.globalAlpha = Math.min(1, t * 9) * Math.min(1, rag.life);
      c.fillStyle = n % 3 ? "#a0eaff" : "#e7ffff";
      c.beginPath();
      c.moveTo(x, y - 5);
      c.lineTo(x + 3 + (n % 3), y + 3);
      c.lineTo(x - 4, y + 7);
      c.closePath();
      c.fill();
    }
  } else if (rag.effect === "singularity") {
    c.globalAlpha = Math.min(1, rag.life / 0.6);
    for (const strand of rag.strands) {
      const points = strand.points,
        d = Math.hypot(points[0].x - rag.targetX, points[0].y - rag.targetY),
        width = Math.max(0.5, Math.min(5, d / 32));
      for (const [color, size] of [
        ["#071420", width + 2],
        [rag.color, width],
      ]) {
        c.beginPath();
        c.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++)
          c.quadraticCurveTo(
            points[i].x,
            points[i].y,
            (points[i].x + points[i + 1].x) / 2,
            (points[i].y + points[i + 1].y) / 2,
          );
        c.lineTo(points.at(-1).x, points.at(-1).y);
        c.strokeStyle = color;
        c.lineWidth = size;
        c.lineCap = "round";
        c.stroke();
      }
    }
    const head = pts[0],
      radius = Math.min(
        8,
        Math.hypot(head.x - rag.targetX, head.y - rag.targetY) / 12,
      );
    if (radius > 1) r.circle(head.x, head.y, radius, rag.color);
  } else {
    c.globalAlpha = Math.min(1, rag.life);
    const joints = deathJoints(rag);
    const width = 5.5;
    for (const [a, b] of joints) {
      r.line(
        [
          [pts[a].x, pts[a].y],
          [pts[b].x, pts[b].y],
        ],
        "#071420",
        width + 3,
      );
      r.line(
        [
          [pts[a].x, pts[a].y],
          [pts[b].x, pts[b].y],
        ],
        rag.color,
        width,
      );
    }
    {
      r.circle(pts[0].x, pts[0].y, 10, rag.color);
      drawHair(
        c,
        rag.hair,
        pts[0].x,
        pts[0].y,
        Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x) + Math.PI / 2,
        rag.facing || 1,
      );
      if (rag.effect === "gib")
        for (const joint of rag.severed)
          for (const id of JOINTS[joint].slice(0, 2))
            r.circle(pts[id].x, pts[id].y, 3, "#b72b45");
      if (rag.effect === "slice")
        for (const p of [pts[11], pts[12]]) r.circle(p.x, p.y, 3, "#fff0d5");
    }
  }
  c.restore();
  return true;
}
