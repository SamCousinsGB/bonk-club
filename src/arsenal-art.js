import { WEAPONS } from "./arsenal.js";

// Canvas silhouettes share the existing game's materials, with different barrels,
// coils, tanks and drums so pickups remain identifiable at arena scale.
export function drawNewWeapon(r, type) {
  const w = WEAPONS[type],
    c = r.ctx;
  const newTypes = [
    "smg",
    "burst",
    "flame",
    "frost",
    "ricochet",
    "saw",
    "tesla",
    "homing",
    "cluster",
    "machinegun",
    "repulsor",
    "blackhole",
  ];
  if (!newTypes.includes(type)) return;
  const accent = w.color || "#afd8c6";
  c.fillStyle = "#253343";
  c.fillRect(-13, -9, 36, 18);
  c.fillRect(-3, 7, 9, 13);
  c.fillStyle = "#8b9bab";
  c.fillRect(-8, -9, 23, 5);
  if (["smg", "burst", "machinegun"].includes(type)) {
    const end = type === "machinegun" ? 66 : type === "burst" ? 50 : 32;
    r.line(
      [
        [14, -2],
        [end, -2],
      ],
      "#b8c3cb",
      6,
    );
    c.fillStyle = accent;
    c.fillRect(-10, -7, 17, 4);
    if (type === "machinegun") {
      r.circle(6, 12, 12, "#536575");
      r.line(
        [
          [43, 0],
          [34, 17],
        ],
        accent,
        3,
      );
      r.line(
        [
          [43, 0],
          [53, 17],
        ],
        accent,
        3,
      );
      c.fillStyle = "#d3a94e";
      for (let x = -15; x < 0; x += 5) c.fillRect(x, 7, 3, 12);
    } else {
      c.fillStyle = "#6d8494";
      c.fillRect(10, 4, 8, 15);
    }
  } else if (["homing", "cluster"].includes(type)) {
    c.fillStyle = "#56615f";
    c.fillRect(-20, -13, 60, 25);
    if (type === "homing") {
      r.circle(12, -17, 6, accent);
      r.line(
        [
          [18, -17],
          [31, -17],
        ],
        accent,
        3,
      );
    } else for (let x = -8; x < 32; x += 13) r.circle(x, 0, 5, accent);
    r.line(
      [
        [39, -10],
        [39, 10],
      ],
      accent,
      5,
    );
  } else if (["flame", "frost"].includes(type)) {
    r.circle(-12, 0, 12, accent);
    r.circle(-12, 0, 7, "#324754");
    r.line(
      [
        [13, 0],
        [45, 0],
      ],
      "#a3b3bf",
      10,
    );
    r.line(
      [
        [2, 9],
        [21, 15],
        [39, 6],
      ],
      accent,
      3,
    );
    if (type === "flame") r.circle(47, 0, 4, "#ffde84");
    else
      for (let x = 18; x < 44; x += 9)
        r.line(
          [
            [x, -9],
            [x, 9],
          ],
          accent,
          3,
        );
  } else if (type === "saw") {
    r.circle(27, 0, 17, "#a7b9c9");
    for (let n = 0; n < 10; n++) {
      const a = (n * Math.PI) / 5;
      r.line(
        [
          [27 + Math.cos(a) * 12, Math.sin(a) * 12],
          [27 + Math.cos(a + 0.15) * 21, Math.sin(a + 0.15) * 21],
        ],
        "#e6edef",
        3,
      );
    }
    r.circle(27, 0, 6, "#4d616e");
  } else {
    r.circle(18, 0, 14, "#536177");
    r.circle(18, 0, 9, accent);
    r.circle(18, 0, type === "blackhole" ? 8 : 4, "#121323");
    r.line(
      [
        [27, -8],
        [47, -13],
      ],
      accent,
      4,
    );
    r.line(
      [
        [27, 8],
        [47, 13],
      ],
      accent,
      4,
    );
    if (type === "tesla")
      for (let x = 28; x <= 44; x += 8)
        r.line(
          [
            [x, -11],
            [x, 11],
          ],
          "#e2d8ff",
          2,
        );
    if (type === "ricochet")
      r.line(
        [
          [26, -6],
          [34, 4],
          [42, -5],
        ],
        "#fff0fd",
        3,
      );
  }
}

export function drawSpecialProjectile(r, b, time) {
  const c = r.ctx,
    color = WEAPONS[b.weapon]?.color || "#c8edff";
  if (b.kind === "flame") {
    const size = 6 + (1 - b.life / 0.42) * 13;
    r.circle(b.x, b.y, size * 1.4, "#ff653832");
    r.circle(b.x, b.y, size, "#ff993988");
    r.circle(b.x, b.y, size * 0.45, "#ffe399");
  } else if (b.kind === "saw") {
    r.circle(b.x, b.y, 15, "#b5c8d3");
    for (let n = 0; n < 8; n++) {
      const a = time * 30 + (n * Math.PI) / 4;
      r.line(
        [
          [b.x + Math.cos(a) * 11, b.y + Math.sin(a) * 11],
          [b.x + Math.cos(a + 0.18) * 21, b.y + Math.sin(a + 0.18) * 21],
        ],
        "#f4fcff",
        3,
      );
    }
    r.circle(b.x, b.y, 5, "#405466");
  } else if (b.kind === "singularity") {
    r.circle(b.x, b.y, 20, "#bf84ff55");
    r.circle(b.x, b.y, 11, "#c9acff");
    r.circle(b.x, b.y, 8, "#090818");
  } else if (b.kind === "force") {
    c.save();
    c.translate(b.x, b.y);
    c.rotate(Math.atan2(b.vy, b.vx));
    c.strokeStyle = "#98ffe4bb";
    c.lineWidth = 5;
    c.beginPath();
    c.arc(-12, 0, 34, -1.2, 1.2);
    c.stroke();
    c.restore();
  } else if (["frost", "ricochet", "tesla"].includes(b.kind)) {
    r.line(
      [
        [b.x - b.vx * 0.025, b.y - b.vy * 0.025],
        [b.x, b.y],
      ],
      color,
      b.kind === "tesla" ? 5 : 4,
    );
    r.circle(b.x, b.y, b.kind === "frost" ? 7 : 5, "#f5faff");
  } else return false;
  return true;
}

export function drawFields(r, fields, time) {
  const c = r.ctx;
  for (const f of fields || []) {
    if (f.kind === "arc") {
      const dx = f.ex - f.x,
        dy = f.ey - f.y;
      const points = Array.from({ length: 8 }, (_, n) => [
        f.x + (dx * n) / 7,
        f.y +
          (dy * n) / 7 +
          (n === 0 || n === 7 ? 0 : Math.sin(n * 7 + time * 50) * 13),
      ]);
      r.line(points, "#a386ff66", 10);
      r.line(points, "#e9deff", 3);
    } else {
      c.save();
      c.globalAlpha = Math.min(1, f.life * 2);
      const active = f.age >= 0.4;
      c.strokeStyle = "#c4a0ff44";
      c.lineWidth = 2;
      c.setLineDash([8, 12]);
      c.beginPath();
      c.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      for (let n = 0; n < 5; n++) {
        const a = time * 2 + n * Math.PI * 0.4;
        c.beginPath();
        c.strokeStyle = "#ad88ef88";
        c.lineWidth = 3;
        c.arc(f.x, f.y, 28 + n * 17, a, a + 1.7);
        c.stroke();
      }
      r.circle(f.x, f.y, active ? 33 : 19, "#d2b0ff");
      r.circle(f.x, f.y, active ? 27 : 14, "#070713");
      c.restore();
    }
  }
}
