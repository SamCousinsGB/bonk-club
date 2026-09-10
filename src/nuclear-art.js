import { NUCLEAR } from "./impact.js";
import { JOINTS } from "./puppet.js";
import { W, H } from "./scale.js";
const TAU = Math.PI * 2;
const circle = (c, x, y, radius) => {
  c.beginPath();
  c.arc(x, y, Math.max(0.01, radius), 0, TAU);
};

export function clipCraters(c, state) {
  for (const f of [
    ...(state.craters || []).filter(
      (f) => state.time - f.born >= NUCLEAR.meltAt,
    ),
    ...(state.rifts || []),
  ]) {
    c.beginPath();
    c.rect(-200, -200, W + 400, H + 400);
    c.moveTo(f.x + f.radius, f.y);
    c.arc(f.x, f.y, f.radius, 0, TAU);
    c.clip("evenodd");
  }
}

// Carved collision rectangles are thin slices. Paint their shared surface once,
// clipped to the surviving pieces, so a cut does not repeat the platform trim
// on every physics slice or draw across a subsequently broken fragment.
export function drawScorchedPlatforms(r, platforms, time) {
  const groups = new Map(),
    c = r.ctx;
  for (const p of platforms) {
    if (p.move || p.travel || p.wreckId) continue;
    if (typeof p.id !== "string" || !p.id.includes(":c")) {
      r.platform(p, time);
      continue;
    }
    const id = p.id.split(":c")[0];
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(p);
  }
  for (const pieces of groups.values()) {
    const alive = pieces.filter((p) => p.hp !== 0);
    if (!alive.length) continue;
    const x = Math.min(...pieces.map((p) => p.x)),
      y = Math.min(...pieces.map((p) => p.y));
    const w = Math.max(...pieces.map((p) => p.x + p.w)) - x,
      h = Math.max(...pieces.map((p) => p.y + p.h)) - y;
    c.save();
    c.beginPath();
    for (const p of alive) c.rect(p.x, p.y, p.w, p.h);
    c.clip();
    r.platform({ ...alive[0], x, y, w, h }, time);
    c.restore();
  }
}

const falloutSprites = new Map();
function falloutSprite(kind) {
  if (falloutSprites.has(kind)) return falloutSprites.get(kind);
  const canvas = document.createElement("canvas");
  const size = kind === "mist" ? 128 : 512;
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d"),
    half = size / 2;
  const g = c.createRadialGradient(half, half, 0, half, half, half);
  const stops =
    kind === "desaturate"
      ? [
          [0, "#8080809c"],
          [0.65, "#80808085"],
          [0.84, "#80808055"],
          [1, "#80808000"],
        ]
      : kind === "mist"
        ? [
            [0, "#dfedb887"],
            [0.28, "#a9c48a44"],
            [0.65, "#91ae7220"],
            [1, "#83985a00"],
          ]
        : [
            [0, "#bfd78312"],
            [0.42, "#b7cc781c"],
            [0.72, "#8aa74a35"],
            [0.84, "#b6ca6543"],
            [0.93, "#72663628"],
            [1, "#4a4c2200"],
          ];
  for (const [at, color] of stops) g.addColorStop(at, color);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  falloutSprites.set(kind, canvas);
  return canvas;
}

export function falloutOpacity(age) {
  const t = Math.max(0, Math.min(1, (age - 3) / (NUCLEAR.falloutDuration - 3)));
  return 1 - t * t * (3 - 2 * t);
}
const cloudSprites = new Map();
function cloudSprite(hot = false) {
  if (cloudSprites.has(hot)) return cloudSprites.get(hot);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d");
  const g = c.createRadialGradient(45, 36, 4, 64, 64, 64);
  for (const [stop, color] of hot
    ? [
        [0, "#fff3d0"],
        [0.3, "#ffd378"],
        [0.65, "#c87e48ed"],
        [0.85, "#8c604978"],
        [1, "#6c4e3c00"],
      ]
    : [
        [0, "#b1ada4df"],
        [0.35, "#928e87e8"],
        [0.7, "#55565cd8"],
        [0.92, "#4249504a"],
        [1, "#353f4600"],
      ])
    g.addColorStop(stop, color);
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  cloudSprites.set(hot, canvas);
  return canvas;
}
function mushroomCap(hot = false) {
  const key = hot ? "cap-hot" : "cap-cold";
  if (cloudSprites.has(key)) return cloudSprites.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext("2d");
  c.beginPath();
  c.moveTo(45, 185);
  c.bezierCurveTo(5, 178, 7, 131, 47, 120);
  c.bezierCurveTo(24, 79, 68, 49, 109, 73);
  c.bezierCurveTo(105, 34, 151, 18, 186, 45);
  c.bezierCurveTo(211, 8, 257, 3, 282, 37);
  c.bezierCurveTo(320, 16, 353, 34, 365, 63);
  c.bezierCurveTo(409, 42, 446, 73, 441, 109);
  c.bezierCurveTo(497, 105, 509, 161, 464, 188);
  c.bezierCurveTo(381, 225, 134, 230, 45, 185);
  c.closePath();
  const g = c.createLinearGradient(0, 10, 0, 230);
  g.addColorStop(0, hot ? "#fff0b6" : "#b6b1a7");
  g.addColorStop(0.48, hot ? "#e9a14c" : "#777779");
  g.addColorStop(1, hot ? "#8d503c" : "#424c55");
  c.fillStyle = g;
  c.fill();
  c.clip();
  for (let n = 0; n < 30; n++) {
    const x = 28 + ((n * 83) % 461),
      y = 20 + ((n * 47) % 181),
      size = 80 + (n % 4) * 21;
    c.globalAlpha = 0.45;
    c.drawImage(cloudSprite(hot), x - size / 2, y - size / 2, size, size);
  }
  cloudSprites.set(key, canvas);
  return canvas;
}
export function drawCraters(r, state) {
  const c = r.ctx;
  for (const f of (state.craters || []).slice(-6)) {
    const age = state.time - f.born;
    if (age < NUCLEAR.meltAt || age >= NUCLEAR.falloutDuration) continue;
    const fade = falloutOpacity(age),
      radius = f.radius,
      t = age - 0.24;
    c.save();
    c.globalCompositeOperation = "saturation";
    c.globalAlpha = 0.55 * fade;
    c.drawImage(
      falloutSprite("desaturate"),
      f.x - radius,
      f.y - radius,
      radius * 2,
      radius * 2,
    );
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 0.45 * fade;
    c.drawImage(
      falloutSprite("tint"),
      f.x - radius,
      f.y - radius,
      radius * 2,
      radius * 2,
    );
    const rise = Math.min(radius * 0.85, t * 125),
      spread = Math.min(1, t / 0.9),
      drift = r.reduced ? 0 : Math.max(0, t - 3) * 13;
    const capY = f.y - rise,
      capWidth = radius * (0.45 + spread * 0.18),
      billow = 1 + Math.max(0, t - 3) * 0.075;
    const puff = (x, y, size, alpha, hot = false) => {
      c.globalAlpha = alpha * fade;
      c.drawImage(cloudSprite(hot), x - size / 2, y - size / 2, size, size);
    };
    // Layered rising stem and a broad cauliflower cap, all drawn in the arena's
    // 2D plane. Cached puffs drift apart and fully disappear rather than looping.
    for (let n = 0; n < 13; n++) {
      const u = n / 12,
        y = f.y - rise * u,
        size = radius * (0.22 - 0.045 * u) * billow;
      puff(
        f.x +
          drift * u +
          Math.sin(n * 2.4 + (r.reduced ? 0 : t * 0.8)) * size * 0.12,
        y,
        size,
        0.45,
      );
      if (age < 2.3) puff(f.x, y, size * 0.55, 0.48 * (1 - age / 2.3), true);
    }
    const capW = capWidth * 2.35 * billow,
      capH = capW * 0.5;
    c.globalAlpha = 0.8 * fade * spread;
    c.drawImage(
      mushroomCap(),
      f.x + drift - capW / 2,
      capY - capH * 0.63,
      capW,
      capH,
    );
    if (age < 2.7) {
      c.globalAlpha = 0.75 * fade * spread * (1 - age / 2.7);
      c.drawImage(
        mushroomCap(true),
        f.x + drift - capW / 2,
        capY - capH * 0.63,
        capW,
        capH,
      );
    }
    for (let n = 0; n < 12; n++) {
      const u = (n - 5.5) / 5.5,
        x = f.x + u * radius * Math.min(0.95, t * 0.42) + drift * 0.3;
      puff(
        x,
        f.y + Math.sin(n * 2.1) * 15 - Math.max(0, t - 2) * 18,
        radius * 0.22 * billow,
        0.24 * spread,
      );
    }
    // Finite fallout trails rise and scatter with the cloud; no modulo recycling.
    for (let n = 0; n < 32; n++) {
      const a = n * 2.39996,
        d = radius * (0.15 + (n % 7) * 0.08),
        x = f.x + Math.cos(a) * d + drift * (1 + (n % 3) * 0.2),
        y = f.y + Math.sin(a) * d - t * (12 + (n % 6) * 7);
      c.globalAlpha = 0.5 * fade * Math.min(1, t);
      c.fillStyle = n % 5 ? "#c6c2b6" : "#ffc37b";
      c.fillRect(x, y, 1.5 + (n % 2), 1.5 + (n % 2));
    }
    c.restore();
  }
}

export function drawNuclear(r, f) {
  const c = r.ctx,
    age = f.age,
    radius = Math.min(f.radius, age * NUCLEAR.waveSpeed);
  const fade = Math.min(1, Math.max(0, f.life / 1.2));
  c.save();
  circle(c, f.x, f.y, radius);
  c.clip();
  if (age < 0.72) {
    // A single circular white exposure, then the flash burns down to the exposed scenery.
    c.globalAlpha = r.reduced
      ? Math.max(0, 0.42 * (1 - age / 0.72))
      : Math.min(1, Math.max(0, (0.72 - age) / 0.42));
    c.fillStyle = r.reduced ? "#d4a267" : "#fffff2";
    c.fillRect(f.x - radius, f.y - radius, radius * 2, radius * 2);
  }
  c.globalAlpha = fade * Math.exp(-Math.max(0, age - 0.4) * 2.2);
  for (const [width, color] of [
    [32, "#ff9e3822"],
    [12, "#ffc06544"],
    [2, "#fff0b9"],
  ]) {
    circle(c, f.x, f.y, Math.max(1, radius - width / 2));
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  // Molten fragments peel inward from the cut. Fixed counts and no blur keep
  // the effect inexpensive on online guests and phones.
  for (let n = 0; n < 72; n++) {
    const angle = n * 2.39996,
      start = 0.25 + (n % 9) * 0.06,
      t = Math.max(0, age - start);
    const edge = f.radius - (n % 5) * 2;
    const x = f.x + Math.cos(angle) * (edge - t * (12 + (n % 7) * 5));
    const y = f.y + Math.sin(angle) * edge + t * t * (25 + (n % 4) * 12);
    c.globalAlpha = fade * Math.min(1, t * 4) * Math.max(0, 1 - t / 2.7);
    r.line(
      [
        [x, y],
        [x - Math.cos(angle) * 3, y - 8 - t * 12],
      ],
      n % 3 ? "#ff9f47" : "#fff2b9",
      2 + (n % 3),
    );
  }
  c.restore();
}

export function drawAshSkeleton(r, rag) {
  const c = r.ctx,
    age = rag.ashAge,
    pts = rag.points;
  const crumble = Math.max(0, Math.min(1, (age - 0.65) / 1.05));
  c.save();
  c.globalAlpha = Math.min(1, rag.life) * Math.max(0, 1 - crumble);
  for (const [a, b] of JOINTS) {
    if (a === 0) continue;
    r.line(
      [
        [pts[a].x, pts[a].y],
        [pts[b].x, pts[b].y],
      ],
      "#121418",
      8,
    );
    r.line(
      [
        [pts[a].x, pts[a].y],
        [pts[b].x, pts[b].y],
      ],
      "#eee5cb",
      3.5,
    );
    r.circle(pts[b].x, pts[b].y, 2.7, "#fff4d8");
  }
  const neck = pts[1],
    hip = pts[2],
    dx = hip.x - neck.x,
    dy = hip.y - neck.y,
    len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len,
    ny = dx / len;
  for (let n = 1; n <= 4; n++) {
    const t = n / 5,
      x = neck.x + dx * t,
      y = neck.y + dy * t,
      width = 10 - n;
    r.line(
      [
        [x + nx * width, y + ny * width],
        [x + dx * 0.09, y + dy * 0.09],
        [x - nx * width, y - ny * width],
      ],
      "#eee5cb",
      2.2,
    );
  }
  r.line(
    [
      [hip.x + nx * 6, hip.y + ny * 6],
      [hip.x + dx * 0.16, hip.y + dy * 0.16],
      [hip.x - nx * 6, hip.y - ny * 6],
    ],
    "#eee5cb",
    3,
  );
  const head = pts[0];
  c.save();
  c.translate(head.x, head.y);
  c.rotate(Math.atan2(head.y - neck.y, head.x - neck.x) + Math.PI / 2);
  r.circle(0, 0, 11.5, "#10151b");
  r.circle(0, -1, 9.5, "#f7eed4");
  c.fillStyle = "#eee5cb";
  c.fillRect(-5, 4, 10, 8);
  r.circle(-4, -1, 2.8, "#111721");
  r.circle(4, -1, 2.8, "#111721");
  r.line(
    [
      [0, 2],
      [-1, 5],
    ],
    "#111721",
    2,
  );
  for (let x = -3; x <= 3; x += 3)
    r.line(
      [
        [x, 8],
        [x, 11],
      ],
      "#111721",
      1,
    );
  c.restore();
  // Ash starts on the actual bones, then separates into a falling, drifting cloud.
  const t = Math.max(0, age - 0.6),
    dir = rag.ashDirection || 1;
  for (let n = 0; n < 66; n++) {
    const [a, b] = JOINTS[n % JOINTS.length],
      along = ((n * 17) % 31) / 31;
    const x = pts[a].x + (pts[b].x - pts[a].x) * along;
    const y = pts[a].y + (pts[b].y - pts[a].y) * along;
    c.globalAlpha =
      Math.min(1, t * 3) *
      Math.min(1, rag.life / 0.65) *
      (0.45 + (n % 4) * 0.15);
    c.fillStyle = n % 4 === 0 ? "#ffbf68" : n % 2 ? "#b7b2a5" : "#6c7277";
    const size = 1.3 + (n % 3) * 0.7;
    c.fillRect(
      x + dir * t * (12 + (n % 9) * 8) + Math.sin(n * 7) * t * 15,
      y + t * t * (12 + (n % 5) * 8) - t * (n % 7) * 7,
      size,
      size,
    );
  }
  c.restore();
}
