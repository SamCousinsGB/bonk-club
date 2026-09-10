import { drawBlood } from "./gore.js";
import { drawDeath, drawStatus } from "./death-art.js";
import { drawWreckage, drawRifts } from "./blackhole-art.js";
import { drawCraters, clipCraters, drawScorchedPlatforms, drawAshSkeleton } from "./nuclear-art.js";
import { PARRY } from "./impact.js";
import { sceneDetail, ambientDetail, pickupLabels } from "./scene-detail.js";
import { drawHair } from "./identity.js";
import {
  drawNewWeapon,
  drawSpecialProjectile,
  drawFields,
} from "./arsenal-art.js";
import { RARITY_COLORS } from "./arsenal.js";
import {
  drawEnvironment,
  drawSurface,
  drawCover,
  drawHazards,
} from "./environment.js";
import { SUDDEN_DEATH } from "./scale.js";
import { JOINTS } from "./puppet.js";
import { drawChunks } from "./prop-art.js";
import { World, STEP, W, H, ARENAS, COLORS, NAMES, WEAPONS } from "./engine.js";
const TAU = Math.PI * 2;
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.words = [];
    this.impacts = [];
    this.shake = 0;
    this.lastEvent = 0;
    this.scenery = new Map();
    this.pickupArt = new Map();
    this.localId = null;
    document.fonts?.ready.then(() => this.pickupArt.clear());
    this.reduced = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }
  resize(width, height, follow = false) {
    const fit = follow ? Math.max(width / W, height / H) : Math.min(width / W, height / H);
    const pixels = Math.round(Math.max(960, Math.min(W, W * fit * Math.min(1.5, devicePixelRatio || 1))));
    if (this.canvas.width === pixels) return;
    this.canvas.width = pixels;
    this.canvas.height = Math.round(pixels * H / W);
  }
  pickup(type) {
    if (this.pickupArt.has(type)) return this.pickupArt.get(type);
    const sprite = document.createElement("canvas"), label = document.createElement("canvas");
    sprite.width = 180; sprite.height = 140;
    const measure = label.getContext("2d");
    measure.font = "600 18px 'DM Sans',sans-serif";
    label.width = Math.ceil(measure.measureText(WEAPONS[type].name).width)+20; label.height = 32;
    const main = this.ctx, c = sprite.getContext("2d");
    this.ctx = c;
    try {
      c.shadowBlur = 20;
      c.shadowColor = RARITY_COLORS[WEAPONS[type].rarity];
      this.weapon(type, 90, 70, 1, 0);
    } finally { this.ctx = main; }
    const text = label.getContext("2d");
    text.textAlign = "center";
    text.fillStyle = RARITY_COLORS[WEAPONS[type].rarity];
    text.font = "600 18px 'DM Sans',sans-serif";
    text.lineJoin = "round"; text.lineWidth = 5; text.strokeStyle = "#0d1929ee";
    text.strokeText(WEAPONS[type].name, label.width/2, 24);
    text.fillText(WEAPONS[type].name, label.width/2, 24);
    const art = { sprite, label };
    this.pickupArt.set(type, art);
    return art;
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
      sound?.play(
        e.type === "shoot" &&
          ["rail", "plasma", "rocket", "pellet"].includes(e.kind)
          ? e.kind
          : e.type,
        e,
      );
      if (e.type === "hit" || e.type === "parry") {
        this.impacts.push({ x:e.x, y:e.y, age:0, life:e.melee ? 0.24 : 0.15,
          size:e.move === "spin" ? 65 : e.melee ? 48 : Math.min(46,23+(e.damage||0)*.2), color:e.type === "parry" ? "#d5fa43" : "#fff1ce" });
        if (this.impacts.length > 32) this.impacts.shift();
      }
      if(e.type === "explosion" && !e.nuclear) {
        this.impacts.push({x:e.x,y:e.y,age:0,life:.45,size:e.radius||180,color:"#ffd08c",blast:true});
        if(this.impacts.length>32)this.impacts.shift();
      }
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
          "coverhit",
          "break",
        ].includes(e.type)
      ) {
        const count = e.ash ? 0 : e.nuclear
          ? 24
          : e.type === "explosion"
            ? 38
            : e.type === "ko"
              ? 28
              : 12;
        for (let i = 0; i < count && this.particles.length < 240; i++) {
          const a = Math.random() * TAU,
            v =
              70 +
              Math.random() *
                (e.nuclear ? 400 : e.type === "explosion" ? 570 : 330);
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
          this.shake = Math.max(this.shake,
            e.nuclear ? 44 : e.type === "explosion" ? 18 :
            e.type === "ko" ? 12 : e.melee ? (e.move === "spin" ? 13 : 8) :
            e.type === "parry" ? 7 : Math.min(7, 2 + (e.damage || 0) / 16));
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
    for (let n = 0; n < Math.ceil(W / 100); n++) {
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
  city(arena, platforms) {
    if (!arena.city) return;
    const c = this.ctx;
    // Distant windows establish the height beyond the open building edges.
    for (let n = 0; n < Math.ceil(W / 83); n++) {
      const x = n * 83 - 20,
        roof = 270 + Math.sin(n * 7.1) * 125;
      c.fillStyle = "#0a192b99";
      c.fillRect(x, roof, 66, H - roof);
      for (let y = roof + 15; y < H; y += 28)
        for (let k = 0; k < 3; k++) {
          c.fillStyle =
            (n + k + Math.floor(y / 28)) % 3 ? "#a6c7ef12" : "#ffcd791e";
          c.fillRect(x + 10 + k * 17, y, 7, 11);
        }
    }
    for (const tower of arena.towers || []) {
      c.fillStyle = "#0916219c";
      c.fillRect(tower.x, tower.y, tower.w, tower.h);
      c.strokeStyle = "#819aab22";
      c.lineWidth = 3;
      c.strokeRect(tower.x, tower.y, tower.w, tower.h);
      c.save();
      c.beginPath();
      c.rect(tower.x, tower.y, tower.w, tower.h);
      c.clip();
      const windowHeight = arena.name ? 200 : 118;
      for (
        let y = tower.y + (arena.name ? 15 : 28);
        y < H;
        y += arena.name ? 320 : 180
      ) {
        for (let x = tower.x + 18; x < tower.x + tower.w - 30; x += 90) {
          const light = c.createLinearGradient(x, y, x + 66, y + 110);
          light.addColorStop(0, "#8ebed51c");
          light.addColorStop(1, "#57789508");
          c.fillStyle = light;
          c.fillRect(x, y, 66, windowHeight);
          c.strokeStyle = "#9ccad525";
          c.lineWidth = 2;
          c.strokeRect(x, y, 66, windowHeight);
          this.line(
            [
              [x + 33, y],
              [x + 33, y + windowHeight],
            ],
            "#9ccad51a",
            1,
          );
        }
        c.fillStyle = "#e7dcb855";
        c.fillRect(tower.x + 35, y - 15, 80, 3);
        c.fillRect(tower.x + tower.w - 115, y - 15, 80, 3);
      }
      c.restore();
    }
    for (const p of platforms)
      if (p.elevator) {
        const top = Math.min(p.baseY, p.baseY + p.travel) - 90;
        const bottom = Math.max(p.baseY, p.baseY + p.travel) + p.h;
        c.fillStyle = "#050f1bd9";
        c.fillRect(p.x - 3, top, p.w + 6, bottom - top);
        for (const x of [p.x + 3, p.x + p.w - 3]) {
          this.line(
            [
              [x, top],
              [x, bottom],
            ],
            "#637e8a77",
            3,
          );
          this.line(
            [
              [x + 5, top],
              [x + 5, p.y],
            ],
            "#a5bac644",
            1,
          );
        }
        for (let y = top + 18; y < bottom; y += 40) {
          this.line(
            [
              [p.x - 5, y],
              [p.x + 8, y],
            ],
            "#70859466",
            2,
          );
          this.line(
            [
              [p.x + p.w - 8, y],
              [p.x + p.w + 5, y],
            ],
            "#70859466",
            2,
          );
        }
      }
  }
  table(p) {
    if (p.hp <= 0) return;
    const c = this.ctx, x = p.x + p.w / 2, y = p.y + p.h / 2;
    c.save(); c.translate(x,y); c.rotate(p.angle || 0); c.translate(-x,-y);
    this.tableArt(p);
    c.restore();
  }
  tableArt(p) {
    if (p.hp <= 0) return;
    const c = this.ctx;
    if (drawCover(c, p)) return;
    c.fillStyle = "#14202a99";
    c.fillRect(p.x + 7, p.y + p.h - 3, p.w, 7);
    c.fillStyle = "#362d2b";
    c.fillRect(p.x + 5, p.y + 7, 7, p.h - 7);
    c.fillRect(p.x + p.w - 12, p.y + 7, 7, p.h - 7);
    c.fillStyle = "#825941";
    c.fillRect(p.x + 8, p.y + 8, p.w - 16, p.h - 18);
    c.fillStyle = "#b88b62";
    c.fillRect(p.x, p.y, p.w, 9);
    c.fillStyle = "#e1b582";
    c.fillRect(p.x, p.y, p.w, 3);
    this.line(
      [
        [p.x + 15, p.y + 21],
        [p.x + p.w - 17, p.y + 21],
      ],
      "#d29c6533",
      1,
    );
    if (p.hp < p.maxHp * 0.7)
      this.line(
        [
          [p.x + p.w * 0.48, p.y + 2],
          [p.x + p.w * 0.4, p.y + 19],
          [p.x + p.w * 0.57, p.y + 26],
          [p.x + p.w * 0.49, p.y + p.h - 12],
        ],
        "#271f23",
        3,
      );
    if (p.hp < p.maxHp * 0.35)
      this.line(
        [
          [p.x + 13, p.y + 8],
          [p.x + 29, p.y + 27],
          [p.x + 17, p.y + p.h - 10],
        ],
        "#271f23",
        3,
      );
  }
  fragments(debris) {
    const c = this.ctx;
    for (const d of debris || []) {
      c.save();
      c.translate(d.x, d.y);
      c.rotate(d.angle);
      c.globalAlpha = Math.min(1, d.life);
      c.fillStyle = "#b48660";
      c.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      c.restore();
    }
  }
  platform(p, time) {
    if (p.hp === 0) return;
    if (p.destructible) {
      const c = this.ctx,
        glass = p.panel === "glass",
        wear = 1 - p.hp / p.maxHp;
      c.fillStyle = glass ? "#5397aa88" : "#9b6942";
      c.fillRect(p.x, p.y, p.w, p.h);
      c.strokeStyle = glass ? "#b9f1f8" : "#e3b77b";
      c.lineWidth = 2;
      c.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      for (let x = p.x + 18; x < p.x + p.w - 8; x += 22) {
        c.beginPath();
        c.moveTo(x, p.y + 3);
        c.lineTo(x + (glass ? 12 : 0), p.y + p.h - 3);
        c.stroke();
      }
      c.fillStyle = "#ffe0a4";
      for (const x of [p.x + 4, p.x + p.w - 10])
        c.fillRect(x, p.y + 4, 6, Math.max(4, p.h - 8));
      if (wear > 0) {
        c.strokeStyle = "#17252b";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(p.x + p.w * 0.46, p.y);
        c.lineTo(p.x + p.w * 0.52, p.y + p.h * 0.55);
        c.lineTo(p.x + p.w * (0.45 + wear * 0.2), p.y + p.h);
        c.stroke();
        c.fillStyle = "#ffe0a4";
        c.fillRect(p.x, p.y - 5, p.w * (1 - wear), 2);
      }
      return;
    }
    const c = this.ctx;
    if (drawSurface(c, p)) return;
    c.save();
    c.fillStyle = "#0714143d";
    c.fillRect(p.x + 18, p.y + 22, p.w, p.h + 150);
    c.fillStyle = p.elevator
      ? "#3c4853"
      : p.material
        ? "#586774"
        : p.ice
          ? "#638f95"
          : "#677665";
    c.fillRect(p.x, p.y, p.w, p.h);
    c.fillStyle = p.elevator
      ? "#efb656"
      : p.material
        ? "#a0b3bc"
        : p.ice
          ? "#b4e6eb"
          : "#c1cc8f";
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
    if (p.elevator) {
      for (let x = p.x + 8; x < p.x + p.w - 6; x += 20)
        this.line(
          [
            [x, p.y + 8],
            [x - 5, p.y + 14],
          ],
          "#e4ac56",
          4,
        );
      this.line(
        [
          [p.x + 3, p.y - 38],
          [p.x + 3, p.y],
        ],
        "#aebdc5",
        4,
      );
      this.line(
        [
          [p.x + p.w - 3, p.y - 38],
          [p.x + p.w - 3, p.y],
        ],
        "#aebdc5",
        4,
      );
      c.fillStyle = "#e9b450";
      c.fillRect(p.x + 10, p.y + 8, 4, 4);
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
    drawNewWeapon(this, type);
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
    if (["minigun", "railgun", "plasma", "barrage"].includes(type)) {
      const accent = {
        minigun: "#f3c66e",
        railgun: "#76e9ff",
        plasma: "#d699ff",
        barrage: "#ffa780",
      }[type];
      c.fillStyle = "#18212c";
      c.fillRect(-12, -10, 36, 19);
      c.fillRect(-2, 6, 9, 14);
      c.fillStyle = "#6b7a86";
      c.fillRect(-9, -9, 23, 10);
      if (type === "minigun") {
        this.circle(-7, 6, 11, "#424c55");
        for (let y = -7; y <= 7; y += 7)
          this.line(
            [
              [14, y],
              [45, y],
            ],
            "#a7b8c0",
            4,
          );
        c.fillStyle = "#3e4e59";
        c.fillRect(30, -11, 7, 22);
      } else if (type === "railgun") {
        this.line(
          [
            [8, -7],
            [57, -7],
          ],
          "#93adbb",
          5,
        );
        this.line(
          [
            [8, 7],
            [57, 7],
          ],
          "#93adbb",
          5,
        );
        this.line(
          [
            [10, 0],
            [58, 0],
          ],
          accent,
          3,
        );
        for (let x = 12; x < 40; x += 9) {
          c.fillStyle = accent;
          c.fillRect(x, -11, 3, 22);
        }
      } else if (type === "plasma") {
        this.circle(19, 0, 13, "#584279");
        this.circle(19, 0, 8, accent);
        c.fillStyle = "#9aaec2";
        c.fillRect(30, -9, 10, 18);
        this.line(
          [
            [40, -7],
            [48, -11],
          ],
          accent,
          3,
        );
        this.line(
          [
            [40, 7],
            [48, 11],
          ],
          accent,
          3,
        );
      } else {
        c.fillStyle = "#4d5860";
        c.fillRect(-20, -15, 57, 29);
        for (let y = -10; y <= 10; y += 10) {
          this.line(
            [
              [-15, y],
              [38, y],
            ],
            "#91a3a5",
            6,
          );
          this.circle(38, y, 3, accent);
        }
      }
      c.fillStyle = accent;
      c.fillRect(-8, -8, 13, 3);
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
      col = p.flash > 0 ? "#fff" : p.color || COLORS[p.id],
      rig = p.rig;
    c.save();
    c.translate(p.x, p.y);
    c.scale(scale, scale);
    if (p.ground) {
      c.fillStyle="#030e1b70"; c.beginPath(); c.ellipse(0,p.prone?11:31,p.prone?37:24,4,0,0,TAU); c.fill();
    }
    for (const [a,b] of JOINTS)
      this.line([[rig[a].x-p.x,rig[a].y-p.y],[rig[b].x-p.x,rig[b].y-p.y]],"#081626d9",a===1&&b===2?11:9);
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
    this.circle(head.x - p.x, head.y - p.y, 13, "#081626dd");
    this.circle(head.x - p.x, head.y - p.y, 10.5, col);
    const neck = rig[1];
    drawHair(
      c,
      p.hair,
      head.x - p.x,
      head.y - p.y,
      Math.atan2(head.y - neck.y, head.x - neck.x) + Math.PI / 2,
      p.facing,
    );
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
    if (p.swing > 0 && ["punch", "kick", "spin"].includes(p.meleeMove)) {
      const progress = 1 - p.swing / p.swingDuration;
      c.globalAlpha = Math.sin(progress * Math.PI) * 0.6;
      c.strokeStyle = p.color || COLORS[p.id];
      c.lineWidth = p.meleeMove === "spin" ? 6 : 4;
      c.beginPath();
      c.arc(
        0,
        -10,
        p.meleeMove === "spin" ? 59 : p.meleeMove === "kick" ? 48 : 38,
        angle + (p.meleeMove === "spin" ? progress * Math.PI * 2 - 2 : -0.6),
        angle + (p.meleeMove === "spin" ? progress * Math.PI * 2 : 0.6),
      );
      c.stroke();
      c.globalAlpha = 1;
    }
    if (p.burn > 0)
      for (let n = 0; n < 3; n++)
        this.circle(
          Math.sin(time * 12 + n * 3) * 12,
          5 - n * 12,
          5,
          "#ffac58aa",
        );
    if (p.chill > 0) {
      c.strokeStyle = "#b7f4ff";
      c.lineWidth = 2;
      c.strokeRect(-21, -34, 42, 59);
    }
    if (p.block) {
      c.strokeStyle = "#eaffbd";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(rig[1].x - p.x, rig[1].y - p.y, 39, angle - 1.15, angle + 1.15);
      c.stroke();
    }
    if (showLabel) {
      c.font = "700 18px 'DM Sans',sans-serif";
      c.textAlign = "center";
      c.fillStyle = p.color || COLORS[p.id];
      c.strokeStyle = "#0c1729ee"; c.lineWidth = 5; c.lineJoin="round";
      c.strokeText(p.name || NAMES[p.id], 0, p.prone ? -35 : -64);
      c.fillText(p.name || NAMES[p.id], 0, p.prone ? -35 : -64);
      if(p.id===this.localId) {
        c.fillStyle="#fff9df"; c.beginPath(); c.moveTo(-6,-88); c.lineTo(6,-88); c.lineTo(0,-81); c.fill();
      }
      if(p.hp<100) {
        c.fillStyle="#081626cc";c.fillRect(-22,p.prone?-26:-56,44,4);
        c.fillStyle=p.color;c.fillRect(-22,p.prone?-26:-56,44*p.hp/100,4);
      }
      if (!p.weapon && p.parryCooldown > 0) {
        c.fillStyle = "#ffffff20";
        c.fillRect(-18, 43, 36, 3);
        c.fillStyle = "#d5fa43";
        c.fillRect(-18, 43, 36 * (1 - p.parryCooldown / PARRY.cooldown), 3);
      }
    }
    c.restore();
  }
  demo(time, dt = 1 / 60) {
    const c = this.ctx;
    if (!this.demoWorld || this.demoWorld.phase === "countdown") {
      const w = (this.demoWorld = new World({
        players: [0, 1, 2],
        arena: 0,
        shuffle: false,
      }));
      w.phase = "fight";
      w.weaponTimer = 999;
      w.hazardTimer = 999;
      w.drops = [];
      w.platforms = [
        { x: 635, y: 570, w: 390, h: 35 },
        { x: 1055, y: 430, w: 220, h: 30 },
        { x: 815, y: 305, w: 155, h: 25 },
      ].map((s, i) => ({
        ...s,
        id: "floor" + i,
        baseX: s.x,
        baseY: s.y,
        dx: 0,
        dy: 0,
      }));
      w.players.forEach((p, i) =>
        Object.assign(p, { x: [720, 940, 1150][i], y: [400, 400, 325][i] }),
      );
      w.players[1].weapon = "bat";
      w.players[1].ammo = 99;
      w.cover = [
        {
          id: "cover0",
          x: 820,
          y: 520,
          w: 90,
          h: 50,
          hp: 75,
          maxHp: 75,
          kind: "table",
        },
      ];
      w.players[2].weapon = "plasma";
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
    this.city(
      { city: true, towers: [{ x: 635, y: 130, w: 640, h: 650 }] },
      w.platforms,
    );
    for (const p of w.platforms) this.platform(p, time);
    for (const p of w.players) this.fighter(p, time, 1.2, false);
    for (const c of w.cover) this.table(c);
    this.fragments(w.debris);
    drawChunks(this.ctx, w.chunks);
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
    c.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    if (!state) {
      c.save();
      c.scale(2, 2);
      this.demo(time, dt);
      c.restore();
      return;
    }
    const arena = ARENAS[state.arenaIndex];
    c.save();
    const pressure = Math.max(0, ...state.fields.filter(f => f.kind === "shockwave").map(f => 21 * Math.max(0, 1 - f.age / 3.2)));
    this.shake = Math.max(this.shake, pressure);
    if (!this.reduced && this.shake > 0)
      c.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    this.shake = Math.max(0, this.shake - dt * 40);

    if (arena.theme) {
      if (!this.scenery.has(state.arenaIndex)) {
        const layer = document.createElement("canvas");
        layer.width = W;
        layer.height = H;
        drawEnvironment(layer.getContext("2d"), arena);
        sceneDetail(layer.getContext("2d"), arena);
        // Keep only a few backdrops in memory on phones.
        if (this.scenery.size >= 3)
          this.scenery.delete(this.scenery.keys().next().value);
        this.scenery.set(state.arenaIndex, layer);
      }
      c.drawImage(this.scenery.get(state.arenaIndex), 0, 0);
    } else {
      this.background(arena.color, time);
      this.city(arena, state.platforms);
    }
    ambientDetail(this, arena, time);
    if (state.elapsed > SUDDEN_DEATH - 10) {
      c.fillStyle = `rgba(239,99,67,${Math.min(0.14, (state.elapsed - (SUDDEN_DEATH - 10)) * 0.007)})`;
      c.fillRect(0, 0, W, H);
    }
    drawCraters(this, state);
    drawRifts(this,state);
    c.save(); clipCraters(c,state);
    drawScorchedPlatforms(this,state.platforms,time);
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
    c.restore();
    for (const p of state.platforms) if (p.move || p.travel) this.platform(p,time);
    drawWreckage(this,state.wreckage,time);
    for (const d of state.drops) {
      if (d.life < 3 && Math.sin(time * 18) < 0) continue;
      const art = this.pickup(d.type);
      c.save();
      c.translate(d.x, d.y - 4);
      c.rotate(d.angle ?? -0.15 + Math.sin(time * 2) * 0.08);
      c.drawImage(art.sprite, -90, -70);
      c.restore();
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
    for(const label of pickupLabels(state.drops,state.players,state.players.find(p=>p.id===this.localId&&p.alive),type=>this.pickup(type),WEAPONS))
      c.drawImage(label.art.label,label.x,label.y);
    for (const r of state.ragdolls) {
      if (r.ash || r.effect) continue;
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
      drawHair(
        c,
        r.hair,
        pts[0].x,
        pts[0].y,
        Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x) + Math.PI / 2,
        r.facing || 1,
      );
      c.globalAlpha = 1;
    }
    for (const p of state.players) {this.fighter(p, time);drawStatus(this,p,time);}
    for (const cover of state.cover || []) this.table(cover);
    drawHazards(c, state.hazards, time);
    this.fragments(state.debris);
    drawChunks(this.ctx, state.chunks);
    drawBlood(this,state.blood);
    drawFields(this, state.fields, time);
    for (const rag of state.ragdolls) {
      if(drawDeath(this,rag,time))continue;
      if(rag.ash)drawAshSkeleton(this,rag);
    }
    for (const b of state.projectiles) {
      if (drawSpecialProjectile(this, b, time)) continue;
      if (b.kind === "rail") {
        this.line(
          [
            [b.x - b.vx * 0.05, b.y - b.vy * 0.05],
            [b.x, b.y],
          ],
          "#57d9ff44",
          14,
        );
        this.line(
          [
            [b.x - b.vx * 0.05, b.y - b.vy * 0.05],
            [b.x, b.y],
          ],
          "#c8fbff",
          4,
        );
      } else if (b.kind === "plasma") {
        this.circle(b.x, b.y, 19, "#c77eff22");
        this.circle(b.x, b.y, 11, "#c08bf6");
        this.circle(b.x, b.y, 5, "#f4dcff");
        this.line(
          [
            [b.x - b.vx * 0.04, b.y - b.vy * 0.04],
            [b.x, b.y],
          ],
          "#c987ff55",
          7,
        );
      } else if (b.kind === "rocket") {
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
    for (const hit of this.impacts) {
      hit.age += dt;
      const t = Math.min(1, hit.age / hit.life), radius = hit.size * (hit.blast ? Math.sqrt(t) : 0.35 + t);
      c.globalAlpha = 1 - t;
      c.strokeStyle = hit.color; c.lineWidth = 3 * (1 - t) + 1;
      c.beginPath(); c.arc(hit.x, hit.y, radius, 0, TAU); c.stroke();
      if(hit.blast){c.globalAlpha=(1-t)*.16;this.circle(hit.x,hit.y,radius,hit.color);continue;}
      for (let n = 0; n < 6; n++) {
        const a = n * TAU / 6;
        this.line([[hit.x + Math.cos(a) * radius * 0.6, hit.y + Math.sin(a) * radius * 0.6],
          [hit.x + Math.cos(a) * radius * 1.2, hit.y + Math.sin(a) * radius * 1.2]], hit.color, 2);
      }
    }
    this.impacts = this.impacts.filter(hit => hit.age < hit.life);
    c.globalAlpha = 1;
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
