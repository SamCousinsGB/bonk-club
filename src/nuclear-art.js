import { NUCLEAR } from "./impact.js";
import { W, H } from "./scale.js";

const sprites = new Map();
function cloudSprite(core) {
  if (sprites.has(core)) return sprites.get(core);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 192;
  const c = canvas.getContext("2d");
  const g = c.createRadialGradient(83, 72, 4, 96, 96, 94);
  for (const [stop, color] of core
    ? [[0,"#fff5ca"],[0.25,"#ffde7c"],[0.55,"#f48039"],[0.8,"#8c3829cc"],[1,"#461e1500"]]
    : [[0,"#826251f0"],[0.45,"#574b43ed"],[0.76,"#302e2cb0"],[1,"#171d2100"]]) g.addColorStop(stop, color);
  c.fillStyle = g; c.fillRect(0, 0, 192, 192);
  sprites.set(core, canvas);
  return canvas;
}

export function drawNuclear(r, f, time) {
  const c = r.ctx, age = f.age;
  const fade = Math.min(1, f.life / 1.25);
  const grow = 1 - Math.exp(-age * 2.7);
  const radius = Math.max(1, Math.min(f.radius, age * NUCLEAR.waveSpeed));
  c.save();
  // One bloom at detonation, followed by a sustained warm exposure and ash.
  c.globalAlpha = fade * Math.min(0.3, age * 0.3);
  c.fillStyle = "#471e12"; c.fillRect(0, 0, W, H);
  if (!r.reduced && age < 0.24) {
    c.globalAlpha = 0.58 * (1 - age / 0.24);
    c.fillStyle = "#fff3d3"; c.fillRect(0, 0, W, H);
  }
  c.globalAlpha = fade;
  for (const [width, color] of [[80,"#ffdb8026"],[30,"#fbc57566"],[7,"#fff1c5"]]) {
    c.beginPath(); c.strokeStyle = color; c.lineWidth = width;
    c.ellipse(f.x, f.y, radius, radius * 0.93, 0, 0, Math.PI * 2); c.stroke();
  }
  const height = 140 + grow * 570, headY = f.y - height;
  const fire = cloudSprite(true), smoke = cloudSprite(false);
  // Cached plumes keep the cloud inexpensive even with several simultaneous nukes.
  for (let n = 0; n < 7; n++) {
    const climb = n / 6, size = (130 + n * 22) * grow;
    c.globalAlpha = fade * 0.88;
    c.drawImage(age < 1.45 ? fire : smoke, f.x - size / 2 + Math.sin(n * 3) * 25 * grow,
      f.y - climb * height - size / 2, size, size * 1.35);
  }
  for (let n = 0; n < 13; n++) {
    const a = n * 2.4, spread = grow * (160 + (n % 4) * 45);
    const size = grow * (260 + (n % 3) * 64);
    const x = f.x + Math.cos(a) * spread, y = headY + Math.sin(a) * 85 * grow;
    c.globalAlpha = fade * 0.95;
    c.drawImage(age < 1.25 + (n % 3) * 0.2 ? fire : smoke, x - size / 2, y - size / 2, size, size);
  }
  // Rolling dust at the detonation floor and long-lived embers use fixed counts.
  for (let n = 0; n < 12; n++) {
    const side = n % 2 ? 1 : -1, travel = age * (170 + (n % 6) * 110);
    const size = 110 + grow * 100;
    c.globalAlpha = fade * 0.6;
    c.drawImage(smoke, f.x + side * travel - size / 2, f.y - 60 - size / 2, size * 1.8, size);
  }
  c.globalAlpha = fade * 0.8;
  for (let n = 0; n < 28; n++) {
    const x = f.x + Math.sin(n * 13.1) * age * 350;
    const y = f.y - age * (180 + n % 7 * 75) + age * age * 90;
    r.line([[x, y],[x - Math.sin(n * 13.1) * 18, y + 24]], n % 2 ? "#ffc45b" : "#ff753e", 3);
  }
  for (const s of f.strikes || []) {
    const remaining = s.at - age;
    if (remaining > 0 && remaining < 0.65) {
      c.globalAlpha = Math.min(0.8, (0.65 - remaining) * 2);
      c.strokeStyle = "#ffc580"; c.lineWidth = 3;
      c.beginPath(); c.ellipse(s.x, s.y, 100, 25, 0, 0, Math.PI * 2); c.stroke();
      r.line([[s.x,s.y-85],[s.x,s.y-20]], "#ffe3b2", 4);
    } else if (remaining <= 0 && remaining > -0.45) {
      const size = 250 + -remaining * 350;
      c.globalAlpha = 1 + remaining / 0.45;
      c.drawImage(fire, s.x - size / 2, s.y - size * 0.85, size, size);
    }
  }
  c.restore();
}
