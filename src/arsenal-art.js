import { drawBlackhole } from "./blackhole-art.js";
import { drawNuclear } from "./nuclear-art.js";
import { WEAPONS } from "./arsenal.js";
import { drawWeirdWeapon, drawWeirdProjectile } from "./weird-art.js";

// Canvas silhouettes share the existing game's materials, with different barrels,
// coils, tanks and drums so pickups remain identifiable at arena scale.
export function drawNewWeapon(r, type) {
  const w = WEAPONS[type],
    c = r.ctx;
  if (drawWeirdWeapon(r, type)) return;
  if (type === "phaser") {
    c.fillStyle = "#233d43"; c.fillRect(-23, -15, 67, 30);
    c.fillStyle = "#789f9f"; c.fillRect(-18, -15, 55, 6);
    c.fillStyle = "#152b32"; c.fillRect(-8, 12, 11, 16);
    r.circle(-11, 0, 10, "#89ffce"); r.circle(-11, 0, 5, "#eaffee");
    for (let x = 9; x <= 37; x += 9) {
      c.fillStyle = "#89ffce"; c.fillRect(x, -12, 4, 24);
    }
    c.fillStyle = "#5b7b86"; c.fillRect(39, -19, 13, 38);
    c.fillStyle = "#c9ffe5"; c.fillRect(50, -15, 4, 30);
    return;
  }
  if (type === "nuke") {
    r.circle(8, 0, 17, "#c6b54f");
    r.circle(8, 0, 12, "#ffe486");
    r.circle(8, 0, 3, "#293234");
    c.fillStyle = "#293234";
    for (let n = 0; n < 3; n++) {
      const a = (n * Math.PI * 2) / 3;
      c.beginPath();
      c.moveTo(8, 0);
      c.arc(8, 0, 10, a, a + 0.9);
      c.closePath();
      c.fill();
    }
    r.line(
      [
        [2, -16],
        [8, -22],
        [15, -16],
      ],
      "#dbe3d9",
      4,
    );
    return;
  }
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
  if (drawWeirdProjectile(r, b, time)) return true;
  if (b.nuclear) {
    c.save();
    c.globalAlpha = r.reduced ? 0.3 : 0.35 + Math.sin(time * 9) * 0.12;
    r.circle(b.x, b.y, 30 + Math.max(0, 1 - b.life) * 35, "#ffe486");
    c.restore();
    r.weapon("nuke", b.x, b.y, 1, time * 5);
    c.fillStyle = "#fff1b7";
    c.textAlign = "center";
    c.font = "700 18px sans-serif";
    c.fillText(Math.max(0, b.life).toFixed(1), b.x, b.y - 34);
  } else if (b.kind === "flame") {
    const size = 8 + Math.max(0, 1 - b.life / WEAPONS.flame.life) * 23;
    const flicker = r.reduced ? 0 : Math.sin(time * 25 + b.life * 20) * 6;
    c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx));
    const tail = Math.min(48 + size * 1.8, Math.max(1, (WEAPONS.flame.life - b.life) * WEAPONS.flame.speed));
    for (const [scale, color] of [[1.25, "#ff582944"], [1, "#ff8d32aa"], [.45, "#ffe8a3dd"]]) {
      c.fillStyle = color; c.beginPath(); c.moveTo(-tail, flicker);
      c.quadraticCurveTo(-size, -size * scale, size, -size * .25 * scale);
      c.quadraticCurveTo(size * 1.3, 0, size * .7, size * .5 * scale);
      c.quadraticCurveTo(-size * .5, size * scale, -tail, flicker);
      c.fill();
    }
    c.restore();
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
    if (f.kind === "shockwave") {
      drawNuclear(r, f, time);
    } else if (f.kind === "arc") {
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
    } else if(f.kind==="blackhole") drawBlackhole(r,f,time);
  }
}
