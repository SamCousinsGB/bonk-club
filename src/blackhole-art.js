export function drawBlackhole(r, f, time) {
  const c = r.ctx,
    age = f.age,
    t = r.reduced ? 0 : age,
    fade = Math.min(1, f.life * 1.5),
    grow = Math.min(1, age / 0.6);
  c.save();
  c.globalAlpha = fade;
  // Broken spirals show the pull without hiding the altered arena behind a disk.
  for (let n = 0; n < 9; n++) {
    const start = n * 0.698 + t * 2.3,
      points = [];
    for (let i = 0; i < 22; i++) {
      const d = f.radius * (1 - i / 23) * grow,
        a = start + i * 0.14;
      points.push([f.x + Math.cos(a) * d, f.y + Math.sin(a) * d]);
    }
    c.globalAlpha = fade * (0.07 + (n % 3) * 0.025);
    r.line(points, n % 2 ? "#9caeff" : "#e8a5ff", 4 + (n % 3) * 3);
  }
  for (let n = 0; n < 32; n++) {
    const progress = (n / 32 + t * 0.28) % 1,
      radius = f.radius * (1 - progress),
      a = n * 2.39996 + t * 2 + progress * 4;
    c.globalAlpha = fade * (0.2 + progress * 0.6);
    r.line(
      [
        [f.x + Math.cos(a) * radius, f.y + Math.sin(a) * radius],
        [f.x + Math.cos(a - 0.08) * radius, f.y + Math.sin(a - 0.08) * radius],
      ],
      n % 2 ? "#c4a8ff" : "#ffceec",
      2,
    );
  }
  c.globalAlpha = fade;
  const size = (32 + Math.min(1, age) * 30) * grow;
  r.circle(f.x, f.y, size + 14, "#956dff28");
  r.circle(f.x, f.y, size + 5, "#d2a6ff");
  r.circle(f.x, f.y, size, "#080a16");
  for (let n = 0; n < 4; n++) {
    c.strokeStyle = n % 2 ? "#f3ddffbb" : "#a890f077";
    c.lineWidth = 2 + n;
    c.beginPath();
    c.arc(
      f.x,
      f.y,
      size + 12 + n * 12,
      t * (1.5 + n * 0.15) + n,
      t * (1.5 + n * 0.15) + n + 1.6,
    );
    c.stroke();
  }
  c.restore();
}
export function drawWreckage(r, wreckage, time) {
  const c = r.ctx;
  for (const w of wreckage || []) {
    if (!w.hp) continue;
    if (w.outline) {
      c.save();
      c.beginPath();
      c.moveTo(w.outline[0].x, w.outline[0].y);
      for (const p of w.outline.slice(1)) c.lineTo(p.x, p.y);
      c.closePath();
      c.fillStyle =
        w.kind === "platform"
          ? w.panel === "glass"
            ? "#719fae"
            : w.material === "wood"
              ? "#907158"
              : "#7f8793"
          : w.kind === "trap"
            ? "#645870"
            : "#796979";
      c.fill();
      c.strokeStyle = "#c8bdd8";
      c.lineWidth = 1.5;
      c.stroke();
      const spine = w.spine;
      r.line(
        spine.map((p) => [p.x, p.y]),
        w.kind === "trap" ? "#e0b6db" : "#252837",
        2,
      );
      for (let n = 1; n < spine.length - 1; n++) {
        const a = w.outline[n],
          b = w.outline[w.outline.length - 1 - n];
        r.line(
          [
            [a.x, a.y],
            [b.x, b.y],
          ],
          w.kind === "trap" ? "#bd829d" : "#adb3b8",
          1.5,
        );
      }
      c.restore();
      continue;
    }
    c.save();
    c.translate(w.x, w.y);
    c.rotate(w.angle);
    if (w.kind === "platform") {
      r.platform(
        { ...w, x: -w.w / 2, y: -w.h / 2, destructible: !!w.panel, maxHp: 120 },
        time,
      );
      r.line(
        [
          [-w.w / 2 + 2, -w.h / 2],
          [w.w * 0.1, -w.h * 0.2],
          [w.w * 0.18, w.h / 2],
        ],
        "#171729",
        2,
      );
    } else {
      c.fillStyle = w.kind === "trap" ? "#484556" : "#665666";
      c.fillRect(-w.w / 2, -w.h / 2, w.w, w.h);
      c.strokeStyle = "#aca0bf";
      c.lineWidth = 2;
      c.strokeRect(-w.w / 2, -w.h / 2, w.w, w.h);
      r.line(
        [
          [-w.w * 0.4, w.h * 0.3],
          [w.w * 0.15, -w.h * 0.2],
          [w.w * 0.4, w.h * 0.2],
        ],
        "#1b1b2a",
        3,
      );
      if (w.kind === "trap") {
        r.circle(0, 0, Math.min(16, w.h * 0.4), "#bfb6c9");
        r.circle(0, 0, 7, "#333043");
        for (let n = 0; n < 7; n++) {
          const a = (n * Math.PI * 2) / 7;
          r.line(
            [
              [Math.cos(a) * 12, Math.sin(a) * 12],
              [Math.cos(a) * 21, Math.sin(a) * 21],
            ],
            "#9689a9",
            3,
          );
        }
      }
    }
    c.restore();
  }
}
export function drawRifts(r, state) {
  const c = r.ctx;
  c.save();
  for (const f of state.rifts || []) {
    const age = state.time - f.born;
    c.globalAlpha = 0.08 + Math.max(0, 0.12 - age * 0.012);
    for (let n = 0; n < 4; n++) {
      const a = n * 1.6;
      const d = f.radius * (0.4 + n * 0.12);
      c.beginPath();
      c.strokeStyle = "#c59adf";
      c.lineWidth = 2;
      c.arc(f.x, f.y, d, a, a + 0.8);
      c.stroke();
    }
  }
  c.restore();
}
