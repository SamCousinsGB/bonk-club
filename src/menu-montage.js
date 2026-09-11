import { JOINTS, makeRig } from "./puppet.js";
import { drawStatus } from "./death-art.js";
import { drawAshSkeleton } from "./nuclear-art.js";

const TAU = Math.PI * 2;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const ease = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const SCENES = [
  { kind: "tesla", duration: 7.6, accent: "#b999ff", sky: "#212538", weapon: "tesla" },
  { kind: "melt", duration: 8.2, accent: "#bbec73", sky: "#263329" },
  { kind: "ice", duration: 7.4, accent: "#91e8ff", sky: "#21323e", weapon: "frost" },
  { kind: "plasma", duration: 7, accent: "#6bffd7", sky: "#193531", weapon: "plasma" },
  { kind: "burn", duration: 7.8, accent: "#ffb268", sky: "#3b2927" },
  { kind: "rail", duration: 6.8, accent: "#ff9d9d", sky: "#322737", weapon: "railgun" },
];
const COLORS = ["#ff7393", "#f7d747", "#55baff", "#81edb0", "#ff9b58", "#bc9bff"];

// This is menu art, with a bounded clock and particle samples; it never creates
// an authoritative World, runs bots, emits game events, or touches room state.
export class MenuMontage {
  constructor(random = Math.random) {
    this.random = random;
    this.scene = SCENES[0];
    this.age = 0;
    this.bag = [];
    this.take = 0;
    this.seed = Math.floor(random() * 10000);
  }
  advance(dt, reduced = false) {
    if (reduced) return { scene: SCENES[0], age: 2.8, seed: 19, take: 0, fade: 1 };
    this.age += Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
    if (this.age >= this.scene.duration) {
      this.age -= this.scene.duration;
      if (!this.bag.length) {
        this.bag = SCENES.filter(s => s !== this.scene);
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
        // Include the previous scene at the end of the next complete rotation.
        this.bag.unshift(this.scene);
      }
      this.scene = this.bag.pop();
      this.seed = Math.floor(this.random() * 10000);
      this.take++;
    }
    return { scene: this.scene, age: this.age, seed: this.seed, take: this.take,
      fade: ease(this.age / 0.65) * ease((this.scene.duration - this.age) / 0.65) };
  }
}

function glow(r, x, y, radius, color, alpha = 1) {
  const c = r.ctx;
  c.save(); c.globalAlpha *= alpha;
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color + "69"); g.addColorStop(0.35, color + "20"); g.addColorStop(1, color + "00");
  c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2); c.restore();
}

function bolt(r, a, b, time, seed, color, width = 1) {
  const pts = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12, bend = Math.sin(t * Math.PI) * Math.sin(i * 7 + time * 16 + seed);
    return [mix(a[0], b[0], t) + bend * 3, mix(a[1], b[1], t) + bend * 7];
  });
  const c = r.ctx; c.save(); c.globalAlpha *= 0.18;
  r.line(pts, color, width * 7); c.restore();
  r.line(pts, color, width * 2.4); r.line(pts, "#f5f3ff", width * 0.65);
}

function actor(x, y, color, time, mode = "idle", facing = 1) {
  const p = { x, y, vx: 0, vy: 0, id: 0, alive: true, facing, color,
    hair: "None", ground: true, hp: 100, stamina: 100, walk: 0, flash: 0, swing: 0, aimAngle: facing > 0 ? 0 : Math.PI };
  p.rig = makeRig(p);
  const sway = Math.sin(time * 2.2) * 1.6;
  p.rig[0].x += sway; p.rig[1].x += sway * 0.6;
  if (mode === "shoot") {
    [[3, -2, -4], [4, 25, -14], [5, 16, -13], [6, 32, -15]].forEach(([i, dx, dy]) => {
      p.rig[i].x = x + dx * facing; p.rig[i].y = y + dy;
    });
  }
  if (mode === "shock") {
    p.ground = false;
    const twitch = Math.sin(time * 15) * 2;
    const pose = [[0,-36],[2,-18],[-2,6],[-19,-29],[-27,-46],[20,-30],[26,-48],[-18,16],[-28,28],[17,20],[25,34]];
    p.rig = pose.map(([dx, dy], i) => ({ x: x + dx + Math.sin(time * 14 + i * 2) * 1.5, y: y + dy + twitch }));
  }
  return p;
}

function skeleton(r, p, age = 0) {
  drawAshSkeleton(r, { points: p.rig, life: 1, ashAge: age });
}

function motes(r, x, y, age, color, seed, kind = "spark", count = 38) {
  if (age < 0) return;
  const c = r.ctx;
  c.save();
  for (let i = 0; i < count; i++) {
    const n = noise(i + seed), a = i * 2.39996;
    let px, py, alpha;
    if (kind === "ash") {
      const t = (age * 0.25 + n) % 1;
      px = x + Math.sin(i * 8 + t * 3) * (8 + t * 37);
      py = y + 25 - t * 140; alpha = Math.sin(t * Math.PI) * clamp(age);
    } else {
      const speed = 25 + n * 90;
      px = x + Math.cos(a) * speed * age;
      py = Math.min(33, y + Math.sin(a) * speed * age + age * age * 68);
      alpha = clamp(2.8 - age) * clamp(age * 15);
    }
    c.globalAlpha = alpha;
    if (kind === "ice") {
      c.save(); c.translate(px, py); c.rotate(i + age * (n - 0.5) * 4);
      c.fillStyle = i % 3 ? color : "#e7fcff"; c.beginPath();
      c.moveTo(-3, -5 - n * 4); c.lineTo(4, 1); c.lineTo(-2, 5); c.closePath(); c.fill(); c.restore();
    } else if (kind === "spark") {
      r.line([[px, py], [px - Math.cos(a) * 3, py - Math.sin(a) * 3]], color, 0.7 + n);
    } else r.circle(px, py, 0.5 + n * 1.1, i % 4 ? color : "#eef0d9");
  }
  c.restore();
}

function backdrop(r, width, height, frame, portrait) {
  const c = r.ctx, { scene, age, seed } = frame;
  c.fillStyle = "#141b21"; c.fillRect(0, 0, width, height);
  c.save(); c.globalAlpha = frame.fade;
  const g = c.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#141b21"); g.addColorStop(0.7, scene.sky); g.addColorStop(1, "#10171d");
  c.fillStyle = g; c.fillRect(0, 0, width, height);
  const floor = portrait ? height * 0.36 : height * 0.76;
  glow(r, width * 0.78, floor * 0.6, width * 0.6, scene.accent, 0.6);
  // Architectural silhouettes and light fixtures give each cut a location.
  c.fillStyle = "#0c131c50";
  for (let i = 0; i < 12; i++) {
    const x = width * (0.25 + i * 0.07), top = floor * (0.24 + noise(i + seed) * 0.3);
    c.fillRect(x, top, width * 0.048, floor - top);
    if (scene.kind === "rail") {
      for (let y = top + 16; y < floor; y += 23) {
        c.fillStyle = "#a5afb614"; c.fillRect(x + 8, y, 3, 7); c.fillRect(x + 22, y, 3, 7);
      }
      c.fillStyle = "#0c131c50";
    }
  }
  if (scene.kind !== "rail") {
    for (let i = 0; i < 4; i++) {
      const x = width * (0.48 + i * 0.16);
      r.line([[x, 0], [x, floor]], "#a8b1bb09", 12);
      r.line([[x + 6, 0], [x + 6, floor]], "#b8c9d10c", 1);
    }
    r.line([[width * 0.49, floor * 0.23], [width, floor * 0.23]], scene.accent + "26", 2);
  }
  for (let i = 0; i < 24; i++) {
    const x = (noise(i + seed) * width + age * (1 + i % 3)) % width;
    const y = noise(i + 45) * floor;
    r.circle(x, y, i % 3 ? 0.7 : 1.4, scene.accent + "35");
  }
  c.restore();
}

function platform(r, accent, kind) {
  const c = r.ctx;
  c.fillStyle = "#0b1219"; c.fillRect(-1500, 36, 3000, 1500);
  c.fillStyle = "#344049"; c.fillRect(-195, 34, 400, 4);
  r.line([[-194, 34], [205, 34]], accent + "88", 0.6);
  for (let x = -190; x < 205; x += 26) {
    c.fillStyle = "#c5d6df16"; c.fillRect(x, 43, 11, 1);
    r.circle(x, 53, 0.9, "#a1afb04d");
  }
  if (kind === "melt" || kind === "burn") {
    c.fillStyle = "#090f13"; c.fillRect(-12, 35, 95, 4);
    for (let x = -10; x < 80; x += 6) r.line([[x, 35], [x, 39]], "#879098", 1.5);
  }
}

function shooter(r, scene, age, color) {
  if (!scene.weapon) return;
  const recoil = Math.sin(clamp((age - 1.5) * 4) * Math.PI) * 5;
  const p = actor(-105 - recoil, 0, color, age, "shoot");
  p.hair = "Spikes"; p.hairColor = "#24343b";
  r.fighter(p, age, 1, false);
  r.weapon(scene.weapon, p.rig[6].x, p.rig[6].y, 1, 0, 0.72);
}

function electrocute(r, frame, p) {
  const { age, seed, scene } = frame, c = r.ctx;
  const charge = ease((age - 1.15) / 0.4) * (1 - ease((age - 4.2) / 0.35));
  if (age > 1.4 && age < 4.65) {
    p = actor(40, -8, p.color, age, "shock");
    glow(r, 40, -12, 85, scene.accent, charge);
    c.save(); c.globalAlpha = 0.26; r.fighter(p, age, 1, false); c.restore();
    skeleton(r, p);
    c.save(); c.globalAlpha = charge;
    bolt(r, [-45, -15], [p.rig[1].x, p.rig[1].y], age, seed, scene.accent, 0.8);
    for (let i = 0; i < 4; i++) {
      const q = p.rig[i * 2];
      bolt(r, [q.x - 12, q.y - 8], [q.x + 14, q.y + 14], age, i * 5, scene.accent, 0.45);
    }
    c.restore();
    motes(r, 40, -14, (age - 1.4) % 0.9, scene.accent, seed, "spark", 24);
  } else if (age >= 4.65) {
    const fall = ease((age - 4.65) / 0.8);
    p.rig.forEach((q, i) => { q.x += fall * (i < 3 ? 28 : 12); q.y = mix(q.y, 29 - (i % 3) * 3, fall); });
    skeleton(r, p, clamp((age - 5.8) / 2));
    motes(r, 65, 10, age - 4.65, "#a6a6bb", seed, "ash", 16);
  } else r.fighter(p, age, 1, false);
}

function melt(r, frame, p) {
  const { age, seed, scene } = frame, c = r.ctx;
  const melting = ease((age - 2) / 3.2);
  // A leaking pipe, falling droplets, sagging limbs, then a spreading puddle.
  r.line([[108, -145], [108, -98], [43, -98], [43, -84]], "#0b161a", 12);
  r.line([[106, -145], [106, -100], [41, -100], [41, -85]], "#657c70", 8);
  r.line([[38, -85], [48, -85]], "#9cac9a", 3);
  if (age > 0.6 && age < 5.9) {
    for (let i = 0; i < 9; i++) {
      const t = (age * 0.85 + i / 9) % 1;
      r.line([[43 + Math.sin(i) * 2, -82 + t * 109], [43 + Math.sin(i) * 2, -78 + t * 109]], scene.accent, 1.3);
    }
  }
  if (age > 1.3) {
    glow(r, 40, 30, 75, scene.accent, melting * 0.65);
    c.fillStyle = "#92c855aa"; c.beginPath();
    c.ellipse(40, 33, 8 + melting * 42, 2 + melting * 3.2, 0, 0, TAU); c.fill();
    for (let i = 0; i < 10; i++) {
      const phase = (age * 0.7 + noise(seed + i)) % 1;
      c.save(); c.globalAlpha = Math.sin(phase * Math.PI) * melting;
      r.circle(10 + noise(seed + i + 50) * 60, 30 - phase * 14, 0.5 + phase * 1.5, "#d8fca0"); c.restore();
    }
  }
  p.rig.forEach((q, i) => {
    const sink = ease((age - 1.8 - (10 - i) * 0.06) / 3);
    q.y = mix(q.y, 31 - (i % 2) * 1.5, sink);
    q.x += Math.sin(i * 2.3) * sink * (i ? 18 : 7);
  });
  if (melting < 0.99) {
    c.save(); c.globalAlpha = 1 - ease((melting - 0.7) / 0.3);
    p.color = melting > 0.1 ? "#a9d963" : p.color;
    r.fighter(p, age, 1, false);
    for (const i of [0, 4, 6, 7, 9]) {
      const q = p.rig[i], drip = ((age * 1.6 + i * 0.23) % 1) * 14 * melting;
      r.line([[q.x, q.y], [q.x + Math.sin(i) * 2, Math.min(32, q.y + drip)]], "#c2ed83", 1.8);
    }
    c.restore();
  }
  motes(r, 40, 20, age - 2.5, "#accc82", seed, "ash", 12);
}

function freeze(r, frame, p) {
  const { age, seed, scene } = frame;
  if (age < 4.1) {
    r.fighter(p, age < 1.5 ? age : 1.5, 1, false);
    if (age > 1.4) {
      p.freeze = clamp((age - 1.4) * 2); drawStatus(r, p, 0);
      glow(r, 40, -7, 65, scene.accent, 0.6);
    }
    if (age > 1.4 && age < 2.3) {
      const t = age - 1.4;
      r.line([[-42, -15], [40, -15]], "#a6edff66", 5 * (1 - t));
      motes(r, 40, -5, t, scene.accent, seed, "ice", 18);
    }
  } else {
    motes(r, 40, -10, age - 4.1, scene.accent, seed, "ice", 52);
    glow(r, 40, 15, 80, scene.accent, clamp(1 - (age - 4.1)));
  }
}

function vaporize(r, frame, p) {
  const { age, seed, scene } = frame, c = r.ctx;
  if (age < 1.75) r.fighter(p, age, 1, false);
  else if (age < 4.8) {
    const t = age - 1.75;
    p = actor(40 + Math.min(t, 1) * 9, -Math.sin(clamp(t) * Math.PI) * 9, p.color, age, "shock");
    c.save(); c.globalAlpha = clamp(1 - (t - 0.8) / 1.8);
    skeleton(r, p, clamp((t - 1.1) / 2)); c.restore();
    motes(r, 48, -10, t, scene.accent, seed, "ash", 48);
    glow(r, 43, -15, 85, scene.accent, clamp(1.4 - t * 0.45));
  } else motes(r, 48, -10, age - 1.75, scene.accent, seed, "ash", 20);
  if (age > 1.25 && age < 1.9) {
    const x = mix(-40, 45, clamp((age - 1.25) / 0.5));
    glow(r, x, -15, 32, scene.accent); r.circle(x, -15, 5, "#d0fff1");
    r.line([[x - 20, -15], [x, -15]], scene.accent, 3);
  }
}

function incinerate(r, frame, p) {
  const { age, seed, scene } = frame, c = r.ctx;
  const fire = ease((age - 1.1) / 1.3) * (1 - ease((age - 5.2) / 0.8));
  if (age < 5.2) {
    if (age > 2) p.color = "#45342d";
    if (age > 1.7) p = { ...actor(40, -3, p.color, age, "shock"), ground: false };
    r.fighter(p, age, 1, false);
    if (age > 3) { c.save(); c.globalAlpha = ease((age - 3) / 1.4); skeleton(r, p, clamp((age - 4.3) / 1.3)); c.restore(); }
  }
  glow(r, 40, 5, 115, scene.accent, fire);
  for (let i = 0; i < 18; i++) {
    const t = (age * (0.6 + noise(i) * 0.5) + noise(i + seed)) % 1;
    const x = 13 + noise(i + seed + 9) * 54, y = 32 - t * 90 * fire;
    c.save(); c.globalAlpha = Math.sin(t * Math.PI) * fire * 0.8;
    c.fillStyle = i % 3 ? "#ff833d" : "#ffdc87";
    c.beginPath(); c.moveTo(x - 5 * (1 - t), y + 10);
    c.quadraticCurveTo(x - 8, y, x + Math.sin(age * 4 + i) * 6, y - 18 * (1 - t));
    c.quadraticCurveTo(x + 9, y, x + 5 * (1 - t), y + 10); c.fill(); c.restore();
  }
  motes(r, 40, -10, age - 2, "#e8ae7c", seed, "ash", 32);
  if (age > 4.8) {
    c.save(); c.globalAlpha = ease(age - 4.8); c.fillStyle = "#10171b";
    c.beginPath(); c.ellipse(40, 32, 23, 3, 0, 0, TAU); c.fill(); c.restore();
  }
}

function rail(r, frame, p) {
  const { age, seed } = frame, c = r.ctx, hit = age - 1.8;
  if (hit < 0) r.fighter(p, age, 1, false);
  else {
    // Each severed group has its own launch, rotation and floor landing.
    const groups = [[0,1,3,4,5,6], [2,7,8], [9,10]];
    groups.forEach((ids, group) => {
      const t = Math.min(hit, 1.4 + group * 0.2), angle = t * [2.3,-1.9,3.4][group];
      const pivot = p.rig[ids[0]], dx = t * (24 + group * 19), dy = -t * (45 + group * 10) + t * t * 65;
      const pts = new Map(ids.map(i => {
        const q = p.rig[i], x = q.x - pivot.x, y = q.y - pivot.y;
        return [i, [pivot.x + dx + x * Math.cos(angle) - y * Math.sin(angle),
          Math.min(30, pivot.y + dy + x * Math.sin(angle) + y * Math.cos(angle))]];
      }));
      for (const [a,b] of JOINTS) if (pts.has(a) && pts.has(b)) r.line([pts.get(a), pts.get(b)], p.color, 5.5);
      if (pts.has(0)) r.circle(...pts.get(0), 10.5, p.color);
      r.circle(...pts.get(ids[0]), 2.2, "#e56977");
    });
    motes(r, 40, -5, hit, "#e56a81", seed, "spark", 28);
    if (hit < 0.4) {
      c.save(); c.globalAlpha = 1 - hit / 0.4;
      r.line([[-38,-15],[200,-15]], "#87e8ff55", 8);
      r.line([[-38,-15],[200,-15]], "#d9fbff", 1); c.restore();
    }
  }
}

export function drawMenuMontage(r, dt) {
  r.menuMontage ||= new MenuMontage();
  const frame = r.menuMontage.advance(dt, r.reduced);
  const { width, height } = r.menuSize || { width: 1280, height: 720 };
  const portrait = width < 650 && height > width;
  const compact = height <= 600 && width > height;
  const c = r.ctx;
  c.save(); c.setTransform(r.canvas.width / width, 0, 0, r.canvas.height / height, 0, 0);
  backdrop(r, width, height, frame, portrait);
  c.save(); c.globalAlpha = frame.fade;
  const scale = portrait ? Math.min(width / 330, height / 530) : Math.min(width * (compact ? 0.0017 : 0.0024), height * 0.0038, 4.6);
  c.translate(width * (portrait ? 0.58 : compact ? 0.79 : 0.73), height * (portrait ? 0.235 : 0.54));
  const push = r.reduced ? 1 : 1 + ease(frame.age / frame.scene.duration) * 0.035;
  c.scale(scale * push, scale * push);
  platform(r, frame.scene.accent, frame.scene.kind);
  shooter(r, frame.scene, frame.age, COLORS[(frame.take + 2) % COLORS.length]);
  const p = actor(40, 0, COLORS[frame.take % COLORS.length], frame.age);
  ({ tesla: electrocute, melt, ice: freeze, plasma: vaporize, burn: incinerate, rail })[frame.scene.kind](r, frame, p);
  c.restore();
  c.fillStyle = `rgba(20,27,33,${1 - frame.fade})`;
  c.fillRect(0, 0, width, height);
  // The control area keeps a steady dark value across every lighting change.
  const veil = portrait ? c.createLinearGradient(0, height * 0.24, 0, height * 0.53) : c.createLinearGradient(0, 0, width * 0.63, 0);
  veil.addColorStop(0, portrait ? "#141b2100" : "#141b21");
  veil.addColorStop(1, portrait ? "#141b21" : "#141b2100");
  c.fillStyle = veil; c.fillRect(0, 0, width, height);
  c.restore();
}
