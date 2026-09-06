import { JOINTS } from "./puppet.js";
import { World, STEP, W, H, ARENAS, COLORS, NAMES, WEAPONS } from "./engine.js";
const TAU = Math.PI * 2;
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.words = [];
    this.shake = 0;
    this.lastEvent = 0;
    this.reduced = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }
  line(points, color, width = 6) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.stroke();
  }
  circle(x, y, r, color) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fillStyle = color;
    c.fill();
  }
  events(events, sound) {
    for (const e of events || []) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      sound?.play(e.type);
      if (
        [
          "hit",
          "ko",
          "parry",
          "explosion",
          "block",
          "jump",
          "shoot",
          "pickup",
        ].includes(e.type)
      ) {
        const count = e.type === "explosion" ? 38 : e.type === "ko" ? 28 : 12;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * TAU,
            v = 70 + Math.random() * (e.type === "explosion" ? 570 : 330);
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            color: e.type === "explosion" ? "#ffb867" : e.color || "#e6f8c7",
            life: 0.2 + Math.random() * 0.6,
            max: 0.8,
            size: 2 + Math.random() * 5,
          });
        }
        if (["hit", "ko", "parry", "explosion"].includes(e.type)) {
          this.shake = e.type === "explosion" ? 16 : e.type === "ko" ? 12 : 7;
          const words = {
            hit: "BONK!",
            ko: "SEE YA.",
            parry: "NOPE!",
            explosion: "OOPS.",
          };
          this.words.push({
            x: e.x,
            y: e.y - 55,
            text: words[e.type],
            color: e.type === "parry" ? "#d5fa43" : "#f5f7e9",
            life: 0.7,
          });
        }
      }
    }
  }
  background(color, time, demo = false) {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(950, 240, 20, 740, 350, 690);
    glow.addColorStop(0, "#b9d6930c");
    glow.addColorStop(1, "#07171544");
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = "#cee5c50a";
    c.lineWidth = 1;
    for (let x = 0; x < W; x += 64) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, H);
      c.stroke();
    }
    for (let y = 16; y < H; y += 64) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
    c.fillStyle = "#0d1d202e";
    for (let n = 0; n < 15; n++) {
      let x = n * 100 - 25,
        y = 310 + Math.sin(n * 23) * 80;
      c.fillRect(x, y, 70 + (n % 3) * 13, H - y);
      c.fillRect(x + 20, y - 20, 18, 20);
    }
    c.fillStyle = "#bde2a10b";
    c.beginPath();
    c.moveTo(1000, -50);
    c.lineTo(1220, -50);
    c.lineTo(900, H);
    c.lineTo(280, H);
    c.fill();
    for (let n = 0; n < 25; n++) {
      const x = (n * 143.7 + time * (3 + (n % 4))) % W,
        y = (n * 97.3 + Math.sin(time * 0.5 + n) * 20) % H;
      this.circle(x, y, n % 3 === 0 ? 2 : 1, "#d5e6bc28");
    }
    if (demo) {
      const g = c.createLinearGradient(0, 0, 730, 0);
      g.addColorStop(0, "#152421ee");
      g.addColorStop(1, "#15242100");
      c.fillStyle = g;
      c.fillRect(0, 0, 800, H);
    }
  }
  platform(p, time) {
    const c = this.ctx;
    c.save();
    c.fillStyle = "#0714143d";
    c.fillRect(p.x + 18, p.y + 22, p.w, p.h + 150);
    c.fillStyle = p.ice ? "#638f95" : "#677665";
    c.fillRect(p.x, p.y, p.w, p.h);
    c.fillStyle = p.ice ? "#b4e6eb" : "#c1cc8f";
    c.fillRect(p.x, p.y, p.w, 5);
    c.fillStyle = "#182c2755";
    c.fillRect(p.x, p.y + p.h - 7, p.w, 7);
    c.strokeStyle = "#253c3050";
    c.lineWidth = 1;
    for (let x = p.x + 20; x < p.x + p.w; x += 44) {
      c.beginPath();
      c.moveTo(x, p.y + 7);
      c.lineTo(x - 10, p.y + p.h - 7);
      c.stroke();
    }
    if (p.move) {
      c.setLineDash([3, 8]);
      c.strokeStyle = "#c5d39755";
      c.beginPath();
      c.moveTo(p.baseX - p.move, p.y + 60);
      c.lineTo(p.baseX + p.move + p.w, p.y + 60);
      c.stroke();
      c.setLineDash([]);
    }
    c.restore();
  }
  weapon(type, x, y, facing = 1, angle = 0, scale = 1) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(facing * scale, scale);
    c.rotate(angle);
    c.lineCap = "round";
    if (type === "bat") {
      this.line(
        [
          [-6, 0],
          [25, 0],
        ],
        "#a8794e",
        7,
      );
      this.line(
        [
          [11, 0],
          [34, 0],
        ],
        "#e1b77a",
        12,
      );
      this.line(
        [
          [-5, 0],
          [4, 0],
        ],
        "#f3ede0",
        6,
      );
    }
    if (type === "sword") {
      this.line(
        [
          [-6, 0],
          [6, 0],
        ],
        "#475c60",
        7,
      );
      this.line(
        [
          [5, -7],
          [5, 7],
        ],
        "#f2ece0",
        4,
      );
      this.line(
        [
          [8, 0],
          [47, 0],
        ],
        "#c888f2",
        8,
      );
      this.circle(47, 0, 4, "#e9bcff");
    }
    if (type === "blaster" || type === "shotgun") {
      c.fillStyle = "#252a2b";
      c.fillRect(-5, -6, type === "shotgun" ? 44 : 28, 10);
      c.fillRect(0, 0, 9, 15);
      c.fillStyle = type === "shotgun" ? "#da995d" : "#8be6c6";
      c.fillRect(3, -7, 15, 5);
      c.fillStyle = "#c4cec1";
      c.fillRect(type === "shotgun" ? 31 : 20, -5, 9, 7);
    }
    if (type === "rocket") {
      c.fillStyle = "#404937";
      c.fillRect(-19, -9, 54, 17);
      c.fillStyle = "#c8dc79";
      c.fillRect(-15, -10, 10, 19);
      c.fillStyle = "#ec905c";
      c.beginPath();
      c.moveTo(36, -8);
      c.lineTo(47, 0);
      c.lineTo(36, 8);
      c.fill();
      this.line(
        [
          [5, 6],
          [0, 18],
        ],
        "#28302d",
        7,
      );
    }
    if (type === "grenade") {
      this.circle(8, 0, 10, "#9fc66f");
      this.line(
        [
          [3, -9],
          [9, -13],
          [12, -8],
        ],
        "#eee1a4",
        3,
      );
      this.line(
        [
          [1, 0],
          [15, 0],
        ],
        "#364c30",
        2,
      );
    }
    c.restore();
  }
  fighter(p, time, scale = 1, showLabel = true) {
    if (!p.alive || !p.rig) return;
    const c = this.ctx,
      col = p.flash > 0 ? "#fff" : COLORS[p.id],
      rig = p.rig;
    c.save();
    c.translate(p.x, p.y);
    c.scale(scale, scale);
    for (const [a, b] of JOINTS)
      this.line(
        [
          [rig[a].x - p.x, rig[a].y - p.y],
          [rig[b].x - p.x, rig[b].y - p.y],
        ],
        col,
        a === 1 && b === 2 ? 7 : 5.5,
      );
    const head = rig[0];
    this.circle(head.x - p.x, head.y - p.y, 10.5, col);
    const angle = p.aimAngle ?? (p.facing === 1 ? 0 : Math.PI);
    this.line(
      [
        [
          head.x - p.x + Math.cos(angle) * 3,
          head.y - p.y + Math.sin(angle) * 3,
        ],
        [
          head.x - p.x + Math.cos(angle) * 7,
          head.y - p.y + Math.sin(angle) * 7,
        ],
      ],
      "#18262c",
      2,
    );
    if (p.weapon) {
      const hand = rig[6];
      this.weapon(p.weapon, hand.x - p.x, hand.y - p.y, 1, angle);
    }
    if (p.block) {
      c.strokeStyle = p.blockTime < 0.18 ? "#eaffbd" : "#eaffbd88";
      c.lineWidth = p.blockTime < 0.18 ? 5 : 2;
      c.beginPath();
      c.arc(rig[1].x - p.x, rig[1].y - p.y, 39, angle - 1.15, angle + 1.15);
      c.stroke();
    }
    if (showLabel) {
      c.font = "700 10px 'DM Sans',sans-serif";
      c.textAlign = "center";
      c.fillStyle = COLORS[p.id];
      c.fillText(NAMES[p.id], 0, p.prone ? -35 : -64);
      if (p.stamina < 97) {
        c.fillStyle = "#ffffff20";
        c.fillRect(-18, 43, 36, 3);
        c.fillStyle = "#d5fa43";
        c.fillRect(-18, 43, (36 * p.stamina) / 100, 3);
      }
    }
    c.restore();
  }
  demo(time, dt = 1 / 60) {
    const c = this.ctx;
    if (
      !this.demoWorld ||
      this.demoWorld.phase === "countdown" ||
      this.demoWorld.phase === "match"
    ) {
      const w = (this.demoWorld = new World({
        players: [0, 1, 2],
        arena: 0,
        shuffle: false,
        target: 5,
      }));
      w.phase = "fight";
      w.weaponTimer = 99;
      w.platforms = [
        { x: 635, y: 570, w: 390, h: 35 },
        { x: 1055, y: 430, w: 220, h: 30 },
        { x: 815, y: 305, w: 155, h: 25 },
      ].map((s) => ({ ...s, baseX: s.x, dx: 0 }));
      w.players.forEach((p, i) =>
        Object.assign(p, { x: [720, 940, 1150][i], y: [400, 400, 325][i] }),
      );
      w.players[1].weapon = "bat";
      w.players[1].ammo = 99;
      w.players[2].weapon = "blaster";
      w.players[2].ammo = 99;
    }
    const w = this.demoWorld;
    for (let n = 0; n < Math.max(1, Math.round(dt / STEP)); n++) {
      const [a, b] = w.players,
        t = w.time;
      w.step(STEP, {
        0: {
          right: a.x < b.x - 49,
          left: a.x > b.x + 49,
          attack: true,
          jump: Math.sin(t * 1.4) > 0.95,
          block: Math.sin(t * 3.5) > 0.65,
          duck: Math.sin(t * 1.7) > 0.92,
        },
        1: {
          right: b.x < a.x - 49,
          left: b.x > a.x + 49,
          attack: Math.sin(t * 4) > 0.25,
          jump: Math.sin(t * 1.8) > 0.96,
        },
        2: {
          attack: Math.sin(t * 2) > 0.8,
          aim: Math.atan2(a.y - 325, a.x - 1150),
        },
      });
    }
    this.background("#283b35", time, true);
    c.save();
    c.globalAlpha = 0.045;
    c.translate(1000, 190);
    c.rotate(-0.13);
    c.fillStyle = "#d5fa43";
    c.font = "900 140px 'Barlow Condensed',Impact,sans-serif";
    c.textAlign = "center";
    c.fillText("BAD COMPANY", 0, 0);
    c.restore();
    for (const p of w.platforms) this.platform(p, time);
    for (const p of w.players) this.fighter(p, time, 1.2, false);
    for (const r of w.ragdolls) {
      for (const [a, b] of JOINTS)
        this.line(
          [
            [r.points[a].x, r.points[a].y],
            [r.points[b].x, r.points[b].y],
          ],
          r.color,
          5.5,
        );
      this.circle(r.points[0].x, r.points[0].y, 10.5, r.color);
    }
    for (const b of w.projectiles)
      this.line(
        [
          [b.x - b.vx * 0.014, b.y - b.vy * 0.014],
          [b.x, b.y],
        ],
        "#f9ed96",
        3,
      );
    this.weapon("rocket", 890, 289, 1, Math.sin(time) * 0.04);
  }
  draw(state, dt, time) {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    if (!state) {
      this.demo(time, dt);
      return;
    }
    this.background(ARENAS[state.arenaIndex].color, time);
    c.save();
    if (!this.reduced && this.shake > 0)
      c.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    this.shake = Math.max(0, this.shake - dt * 40);
    if (state.elapsed > 40) {
      c.fillStyle = `rgba(239,99,67,${Math.min(0.14, (state.elapsed - 40) * 0.007)})`;
      c.fillRect(0, 0, W, H);
      c.fillStyle = "#ffb17e";
      c.font = "600 14px 'DM Sans',sans-serif";
      c.textAlign = "center";
      c.fillText(
        state.elapsed > 45
          ? "SUDDEN DEATH · HEALTH DRAINING"
          : "SUDDEN DEATH IN " + Math.ceil(45 - state.elapsed),
        W / 2,
        125,
      );
    }
    for (const p of state.platforms) this.platform(p, time);
    for (const s of ARENAS[state.arenaIndex].spikes) {
      c.fillStyle = "#e6a384";
      for (let x = s.x; x < s.x + s.w; x += 20) {
        c.beginPath();
        c.moveTo(x, s.y + 2);
        c.lineTo(x + 10, s.y - 20);
        c.lineTo(x + 20, s.y + 2);
        c.fill();
      }
    }
    for (const d of state.drops) {
      if (d.life < 3 && Math.sin(time * 18) < 0) continue;
      c.save();
      c.shadowBlur = 20;
      c.shadowColor = "#d5fa43";
      this.weapon(d.type, d.x, d.y - 4, 1, -0.15 + Math.sin(time * 2) * 0.08);
      c.restore();
      c.textAlign = "center";
      c.fillStyle = "#cfdbb3";
      c.font = "600 9px 'DM Sans',sans-serif";
      c.fillText(WEAPONS[d.type].name, d.x, d.y - 27);
      this.line(
        [
          [d.x - 4, d.y - 43],
          [d.x, d.y - 38],
          [d.x + 4, d.y - 43],
        ],
        "#d5fa43",
        2,
      );
    }
    for (const r of state.ragdolls) {
      c.globalAlpha = Math.min(1, r.life);
      const pts = r.points;
      for (const [a, b] of JOINTS)
        this.line(
          [
            [pts[a].x, pts[a].y],
            [pts[b].x, pts[b].y],
          ],
          r.color,
          7,
        );
      this.circle(pts[0].x, pts[0].y, 11, r.color);
      c.globalAlpha = 1;
    }
    for (const p of state.players) this.fighter(p, time);
    for (const b of state.projectiles) {
      if (b.kind === "rocket") {
        c.save();
        c.translate(b.x, b.y);
        c.rotate(Math.atan2(b.vy, b.vx));
        this.line(
          [
            [-18, 0],
            [-8, 0],
          ],
          "#ffb65d",
          6,
        );
        this.line(
          [
            [-7, 0],
            [8, 0],
          ],
          "#e4f2b5",
          8,
        );
        c.restore();
      } else if (b.kind === "grenade")
        this.weapon("grenade", b.x, b.y, 1, time * 5);
      else {
        this.line(
          [
            [b.x - b.vx * 0.013, b.y - b.vy * 0.013],
            [b.x, b.y],
          ],
          "#faf0a1",
          3,
        );
      }
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 550 * dt;
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.size, p.size);
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const w of this.words) {
      w.life -= dt;
      w.y -= dt * 45;
      c.save();
      c.translate(w.x, w.y);
      c.rotate(-0.15);
      c.globalAlpha = Math.max(0, w.life * 2);
      c.fillStyle = w.color;
      c.font = "900 30px 'Barlow Condensed',Impact,sans-serif";
      c.textAlign = "center";
      c.fillText(w.text, 0, 0);
      c.restore();
    }
    this.words = this.words.filter((w) => w.life > 0);
    c.restore();
  }
}
