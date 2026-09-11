import { NUCLEAR } from "./impact.js";
import { crumbledBone, deathSegments } from "./death-effects.js";
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
    if (!p.sourceId && (typeof p.id !== "string" || !p.id.includes(":c"))) {
      r.platform(p, time);
      continue;
    }
    const id = p.sourceId || p.id.split(":c")[0];
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

const clamp01 = n => Math.max(0, Math.min(1, n));
export function falloutOpacity(age) {
  const t = clamp01((age - 3) / (NUCLEAR.falloutDuration - 3));
  return 1 - t * t * (3 - 2 * t);
}

// Small cached volumes, rather than a fixed mushroom-shaped image. Uneven
// overlapping lobes give the cloud a turbulent edge without per-frame blur.
const volumes = new Map();
let warming = false;
export function warmNuclearArt() {
  if (warming) return;
  warming = true;
  const queue = [["glow",0], ...[0,1,2].flatMap(v=>[["smoke",v],["hot",v]])];
  const schedule = globalThis.requestIdleCallback
    ? fn => globalThis.requestIdleCallback(fn, { timeout: 1000 })
    : fn => globalThis.setTimeout(fn, 30);
  const next = () => {
    const args = queue.shift();
    if (!args) return;
    volume(...args);
    if (queue.length) schedule(next);
  };
  schedule(next);
}
function volume(kind, variant = 0) {
  const key = `${kind}:${variant}`;
  if (volumes.has(key)) return volumes.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 192;
  const c = canvas.getContext("2d");
  if (kind === "glow") {
    const g = c.createRadialGradient(96,96,0,96,96,96);
    for (const [at,color] of [[0,"#ffffee"],[.15,"#fff2cce0"],[.5,"#ffb45c69"],[1,"#ed682000"]]) g.addColorStop(at,color);
    c.fillStyle=g;c.fillRect(0,0,192,192);
  } else {
    const pixels = c.createImageData(192,192), hot = kind === "hot";
    const hash = (x,y) => {const n=Math.sin(x*127.1+y*311.7+variant*74.7)*43758.5453;return n-Math.floor(n);};
    const noise = (x,y) => {
      const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,
        u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
      return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;
    };
    for(let y=0;y<192;y++)for(let x=0;x<192;x++) {
      const nx=(x-96)/88,ny=(y-96)/88,d=Math.hypot(nx,ny),
        n=noise(x/37,y/37)*.57+noise(x/16,y/16)*.28+noise(x/7,y/7)*.15,
        edge=clamp01((1-d+(n-.5)*.2)/.3),
        alpha=edge*edge*(3-2*edge),
        light=clamp01(.57-ny*.15-nx*.08+(n-.5)*.7),
        low=hot?[156,57,17]:[61,67,72],high=hot?[255,227,155]:[173,167,152],
        i=(y*192+x)*4;
      for(let k=0;k<3;k++)pixels.data[i+k]=low[k]+(high[k]-low[k])*light;
      pixels.data[i+3]=alpha*245;
    }
    c.putImageData(pixels,0,0);
  }
  volumes.set(key, canvas);
  return canvas;
}

// Coordinates are in the side-view arena plane. Buoyancy lifts the initial
// fireball; its outer lobes roll outward and down around the rising column.
// Deterministic paths keep hosts, guests and hot joiners on the same animation.
export function cloudBillows(age, radius) {
  if (age < .18 || age >= NUCLEAR.falloutDuration) return [];
  const t = age - .18, lift = radius * .92 * (1 - Math.exp(-t * .62)),
    spread = radius * (.045 + .52 * (1 - Math.exp(-t * .92))),
    dissolve = Math.max(0, t - 4), drift = dissolve * 11,
    fade = falloutOpacity(age), out = [];
  const add = (x, y, size, alpha, heat, variant) => out.push({
    x, y, size, alpha: alpha * fade, heat: clamp01(heat), variant,
  });
  // Draw the rear stem first, joining the cap continuously to the blast origin.
  const stem = clamp01((t - .35) / .7);
  for (let n = 0; n < 21; n++) {
    const u = n / 20, phase = n * 2.4 + t * 1.3,
      width = radius * (.038 + .055 * u);
    add(Math.sin(phase) * width + drift * u,
      -lift * u + Math.cos(phase) * width * .32,
      radius * (.19 + .075 * u) + dissolve * 10,
      .58 * stem * (1 - u * .2), (1 - t / 2.1) * .7, n % 3);
  }
  // A broad crown with separately moving convection lobes. It has no fixed
  // outline, straight underside, stretched sprite or perspective ellipse.
  for (let n = 0; n < 24; n++) {
    const u = (n % 12 - 5.5) / 5.5, front = n >= 12,
      roll = t * .95 + n * 1.71,
      curl = radius * (.02 + Math.abs(u) * .035),
      crown = Math.sqrt(Math.max(0, 1 - u * u)),
      size = radius * (.31 + .10 * (1 - Math.abs(u)) + Math.sin(n*3.1)*.025) * (1 + dissolve * .055);
    add(u * spread + Math.sin(roll) * curl + drift + u * dissolve * 7,
      -lift - crown * spread * .35 + (front ? size * .15 : -size * .1) + Math.cos(roll) * curl,
      size, front ? .76 : .78,
      (1 - t / 3.5) * (front ? 1 : .8), n % 3);
  }
  // Radial dust from the spherical pressure wave. It spreads from the origin,
  // then falls and thins instead of becoming a persistent circle around the hole.
  for (let n = 0; n < 16; n++) {
    const a = n * 2.39996, d = radius * .72 * (1 - Math.exp(-t * 2)),
      dustFade = Math.max(0, 1 - t / 5);
    add(Math.cos(a) * d, Math.sin(a) * d * .7 + t * 14,
      radius * (.12 + t * .018), .21 * dustFade * clamp01(t * 4), 0, n % 3);
  }
  return out;
}

export function drawCraters(r, state) {
  const c = r.ctx;
  for (const f of (state.craters || []).slice(-6)) {
    const age = state.time - f.born;
    const puffs = cloudBillows(age, f.radius);
    if (!puffs.length) continue;
    c.save();
    for (const p of puffs) {
      const x = f.x + p.x - p.size / 2, y = f.y + p.y - p.size / 2;
      c.globalAlpha = p.alpha;
      c.drawImage(volume("smoke", p.variant), x, y, p.size, p.size);
      if (p.heat > 0) {
        c.globalAlpha = p.alpha * p.heat;
        c.drawImage(volume("hot", p.variant), x, y, p.size, p.size);
      }
    }
    // The last embers travel outward from the source and fall. No repeating
    // particles, green radiation disk, or permanent overlay remains afterwards.
    for (let n = 0; n < 28 && age < 4; n++) {
      const a = n * 2.39996, speed = 45 + (n % 7) * 19, t = age - .18;
      c.globalAlpha = Math.max(0, 1 - t / 3.5) * .65;
      c.fillStyle = n % 3 ? "#fda75b" : "#fff0bc";
      c.fillRect(f.x + Math.cos(a) * speed * t, f.y + Math.sin(a) * speed * t + t * t * 24, 2, 2);
    }
    c.restore();
  }
}

export function drawNuclear(r, f) {
  const c = r.ctx, age = f.age,
    radius = Math.min(f.radius, age * NUCLEAR.waveSpeed);
  if (age >= 1.5) return;
  c.save();
  // A fast circular pressure front reaches the real damage boundary, then
  // disappears. It never settles into the old glowing crater outline.
  if (age < .65) {
    c.globalAlpha = Math.pow(Math.max(0, 1 - age / .65), 2) * (r.reduced ? .3 : 1);
    for (const [width, color] of [[22,"#ffbc6640"],[7,"#ffdbac9a"],[2,"#fff8dc"]]) {
      circle(c, f.x, f.y, Math.max(1, radius - width / 2));
      c.lineWidth = width; c.strokeStyle = color; c.stroke();
    }
  }
  if (age < .42) {
    c.globalAlpha = Math.max(0, 1 - age / .42) * (r.reduced ? .32 : .95);
    c.drawImage(volume("glow"), f.x - radius, f.y - radius, radius * 2, radius * 2);
  }
  // The incandescent sphere is smaller than the pressure wave and becomes
  // buoyant as it cools, meeting the emerging cloud rather than flashing away.
  const size = f.radius * (1 - Math.exp(-age * 7)) * 1.04,
    rise = f.radius * .2 * age,
    heat = Math.pow(Math.max(0, 1 - age / 1.5), 1.4);
  c.globalAlpha = heat * .9;
  c.drawImage(volume("hot"), f.x - size / 2, f.y - rise - size / 2, size, size);
  c.restore();
}

export function drawAshSkeleton(r, rag) {
  const c = r.ctx,
    age = rag.ashAge || 0,
    pts = rag.points;
  const segments = deathSegments(rag);
  const crumble = Math.max(0, Math.min(1, (age - 0.65) / 1.05));
  c.save();
  c.globalAlpha = Math.min(1, rag.life) * Math.max(0, 1 - crumble);
  for (const [i, [a, b]] of segments.entries()) {
    if (i === 0) continue;
    r.line(
      [
        [a.x, a.y],
        [b.x, b.y],
      ],
      "#121418",
      8,
    );
    r.line(
      [
        [a.x, a.y],
        [b.x, b.y],
      ],
      "#eee5cb",
      3.5,
    );
    r.circle(b.x, b.y, 2.7, "#fff4d8");
  }
  const neck = pts[1],
    hip = pts[2],
    dx = hip.x - neck.x,
    dy = hip.y - neck.y,
    len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len,
    ny = dx / len;
  for (let n = 1; n <= (crumbledBone(rag, 1) ? 0 : 4); n++) {
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
      [hip.x + dx / len * 4, hip.y + dy / len * 4],
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
    const [a, b] = segments[n % segments.length],
      along = ((n * 17) % 31) / 31;
    const x = a.x + (b.x - a.x) * along;
    const y = a.y + (b.y - a.y) * along;
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
