import {
  JOINTS,
  makeRig,
  updateRig,
  impulseRig,
  collideRigs,
} from "./puppet.js";
export const W = 1280,
  H = 720,
  STEP = 1 / 120;
export const COLORS = ["#55baff", "#f7d747", "#ff7393", "#81edb0"];
export const NAMES = ["BLUE", "YELLOW", "PINK", "MINT"];
const platform = (x, y, w, h = 22, extra = {}) => ({ x, y, w, h, ...extra });
export const ARENAS = [
  {
    name: "THE USUAL SUSPECTS",
    tag: "A classic place to lose friends.",
    color: "#283c38",
    platforms: [
      platform(180, 565, 920, 38),
      platform(400, 410, 170),
      platform(720, 410, 170),
    ],
    spawns: [
      [310, 470],
      [970, 470],
      [450, 330],
      [820, 330],
    ],
    spikes: [],
  },
  {
    name: "MIND THE GAP",
    tag: "Your friendship has a small gap in it.",
    color: "#33364b",
    platforms: [
      platform(130, 535, 350, 40),
      platform(800, 535, 350, 40),
      platform(555, 405, 170),
    ],
    spawns: [
      [260, 445],
      [1010, 445],
      [400, 445],
      [875, 445],
    ],
    spikes: [{ x: 493, y: 675, w: 294 }],
  },
  {
    name: "POINT TAKEN",
    tag: "Blocking is a perfectly good weapon.",
    color: "#41372f",
    platforms: [platform(200, 570, 880, 32), platform(440, 410, 400)],
    spawns: [
      [285, 470],
      [990, 470],
      [500, 330],
      [760, 330],
    ],
    spikes: [
      { x: 590, y: 570, w: 100 },
      { x: 170, y: 600, w: 50 },
      { x: 1060, y: 600, w: 50 },
    ],
  },
  {
    name: "SOCIAL CLIMBERS",
    tag: "It is lonely at the top.",
    color: "#293c46",
    platforms: [
      platform(140, 590, 280),
      platform(860, 590, 280),
      platform(380, 455, 200),
      platform(700, 455, 200),
      platform(530, 310, 220),
    ],
    spawns: [
      [260, 500],
      [1010, 500],
      [460, 360],
      [810, 360],
    ],
    spikes: [],
  },
  {
    name: "SLIPPERY SLOPE",
    tag: "No brakes. Absolutely no dignity.",
    color: "#304449",
    platforms: [
      platform(170, 565, 940, 38, { ice: true }),
      platform(360, 390, 200, 20, { ice: true }),
      platform(720, 390, 200, 20, { ice: true }),
    ],
    spawns: [
      [300, 470],
      [980, 470],
      [440, 310],
      [820, 310],
    ],
    spikes: [
      { x: 80, y: 645, w: 130 },
      { x: 1070, y: 645, w: 130 },
    ],
  },
  {
    name: "MOVING OUT",
    tag: "The floor has other plans.",
    color: "#413344",
    platforms: [
      platform(120, 570, 260),
      platform(900, 570, 260),
      platform(470, 440, 200, 22, { move: 140, speed: 1.1 }),
      platform(390, 300, 160, 22, { move: 130, speed: -0.8 }),
      platform(790, 300, 160, 22, { move: 90, speed: 0.9 }),
    ],
    spawns: [
      [240, 480],
      [1030, 480],
      [460, 205],
      [850, 205],
    ],
    spikes: [],
  },
  {
    name: "BAD NEIGHBOURS",
    tag: "A very short commute to violence.",
    color: "#403c28",
    platforms: [
      platform(310, 570, 660, 40),
      platform(160, 420, 170),
      platform(950, 420, 170),
    ],
    spawns: [
      [395, 480],
      [880, 480],
      [245, 330],
      [1030, 330],
    ],
    spikes: [
      { x: 130, y: 630, w: 200 },
      { x: 950, y: 630, w: 200 },
    ],
  },
  {
    name: "LAST RESORT",
    tag: "Smaller island. Bigger problems.",
    color: "#2e4241",
    platforms: [
      platform(400, 555, 480, 45),
      platform(180, 400, 180, 20),
      platform(920, 400, 180, 20),
      platform(550, 310, 180, 20),
    ],
    spawns: [
      [470, 465],
      [810, 465],
      [260, 300],
      [1020, 300],
    ],
    spikes: [
      { x: 50, y: 675, w: 380 },
      { x: 850, y: 675, w: 380 },
    ],
  },
];
export const WEAPONS = {
  bat: {
    name: "BONK BAT",
    range: 94,
    damage: 35,
    force: 760,
    cooldown: 0.65,
    ammo: 8,
    kind: "melee",
  },
  sword: {
    name: "POOL NOODLE",
    range: 112,
    damage: 28,
    force: 520,
    cooldown: 0.38,
    ammo: 12,
    kind: "melee",
  },
  blaster: {
    name: "PEW PEW",
    damage: 17,
    force: 350,
    cooldown: 0.25,
    ammo: 14,
    kind: "bullet",
    speed: 1300,
  },
  shotgun: {
    name: "PERSONAL SPACE",
    damage: 10,
    force: 230,
    cooldown: 0.85,
    ammo: 5,
    kind: "pellet",
    speed: 1050,
  },
  rocket: {
    name: "BAD IDEA",
    damage: 64,
    force: 1100,
    cooldown: 1.1,
    ammo: 3,
    kind: "rocket",
    speed: 680,
  },
  grenade: {
    name: "HOT POTATO",
    damage: 58,
    force: 1050,
    cooldown: 0.9,
    ammo: 4,
    kind: "grenade",
    speed: 470,
  },
};
export const emptyInput = () => ({
  left: false,
  right: false,
  jump: false,
  attack: false,
  block: false,
  pickup: false,
  duck: false,
  aim: null,
});
export function cleanInput(input) {
  const out = emptyInput();
  if (input && typeof input === "object")
    for (const k in out) if (k !== "aim") out[k] = input[k] === true;
  if (typeof input?.aim === "number" && Number.isFinite(input.aim))
    out.aim = Math.max(-Math.PI, Math.min(Math.PI, input.aim));
  return out;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class World {
  constructor({
    players = [0, 1],
    target = 5,
    arena = 0,
    shuffle = true,
    random = Math.random,
  } = {}) {
    if (
      players.length < 2 ||
      players.length > 4 ||
      new Set(players).size !== players.length ||
      players.some((i) => !Number.isInteger(i) || i < 0 || i > 3)
    )
      throw new Error("Bonk Club requires 2–4 distinct players.");
    this.ids = players;
    this.target = target;
    this.arenaIndex = arena;
    this.shuffle = shuffle;
    this.random = random;
    this.scores = [0, 0, 0, 0];
    this.round = 1;
    this.time = 0;
    this.events = [];
    this.nextEvent = 0;
    this.startRound();
  }
  startRound() {
    this.arena = ARENAS[this.arenaIndex];
    this.platforms = this.arena.platforms.map((p) => ({
      ...p,
      baseX: p.x,
      dx: 0,
    }));
    this.players = this.ids.map((id, n) => {
      const [x, y] = this.arena.spawns[n];
      return {
        id,
        x,
        y,
        vx: 0,
        vy: 0,
        hp: 100,
        alive: true,
        facing: n % 2 ? -1 : 1,
        ground: false,
        coyote: 0,
        jumps: 0,
        jumpHeld: false,
        pickHeld: false,
        block: false,
        blockTime: 0,
        stamina: 100,
        stun: 0,
        cooldown: 0,
        swing: 0,
        weapon: null,
        ammo: 0,
        walk: 0,
        flash: 0,
        prone: false,
        aimAngle: n % 2 ? Math.PI : 0,
        rig: null,
        bodyAngle: 0,
        angularVelocity: 0,
        landing: 0,
      };
    });
    this.projectiles = [];
    this.drops = [];
    this.ragdolls = [];
    this.phase = "countdown";
    this.phaseTime = 2.4;
    this.elapsed = 0;
    this.weaponTimer = 2;
    this.hitstop = 0;
    this.winner = null;
    this.events = [];
  }
  event(type, data = {}) {
    this.events.push({ id: ++this.nextEvent, type, ...data });
    if (this.events.length > 35) this.events.shift();
  }
  step(dt, inputs = {}) {
    dt = clamp(dt, 0, 0.025);
    this.time += dt;
    if (this.phase === "match") return;
    if (this.phase === "result") {
      for (const p of this.players)
        if (p.alive) {
          this.move(p, emptyInput(), dt);
          updateRig(p, dt, this.platforms, this.time);
        }
      this.updateRagdolls(dt);
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        if (this.winner !== null && this.scores[this.winner] >= this.target) {
          this.phase = "match";
          this.event("match", { winner: this.winner });
        } else {
          this.round++;
          this.arenaIndex = this.shuffle
            ? (this.arenaIndex +
                1 +
                Math.floor(this.random() * (ARENAS.length - 1))) %
              ARENAS.length
            : this.arenaIndex;
          this.startRound();
        }
      }
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    for (const p of this.platforms) {
      const old = p.x;
      if (p.move) p.x = p.baseX + Math.sin(this.time * p.speed) * p.move;
      p.dx = p.x - old;
    }
    const active = this.phase === "fight";
    if (!active) {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.phase = "fight";
        this.event("fight");
      }
    } else {
      this.elapsed += dt;
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) {
        this.spawnWeapon();
        this.weaponTimer = 5 + this.random() * 3;
      }
    }
    for (const p of this.players) {
      if (!p.alive) continue;
      const input = active ? cleanInput(inputs[p.id]) : emptyInput();
      this.move(p, input, dt);
    }
    // Resolve defence before attacks so neither slot has a blocking-order advantage.
    for (const p of this.players) {
      if (!p.alive) continue;
      const i = active ? cleanInput(inputs[p.id]) : emptyInput();
      if (i.attack && p.cooldown <= 0 && p.stun <= 0 && !p.block)
        this.attack(p);
      if (i.pickup && !p.pickHeld) this.pickup(p);
      p.pickHeld = i.pickup;
    }
    for (let a = 0; a < this.players.length; a++)
      for (let b = a + 1; b < this.players.length; b++)
        this.collidePlayers(this.players[a], this.players[b]);
    for (const p of this.players)
      if (p.alive) updateRig(p, dt, this.platforms, this.time);
    for (let a = 0; a < this.players.length; a++)
      for (let b = a + 1; b < this.players.length; b++)
        collideRigs(this.players[a], this.players[b]);
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    this.updateRagdolls(dt);
    if (active) {
      for (const p of this.players) {
        if (!p.alive) continue;
        if (p.y > H + 100 || p.x < -130 || p.x > W + 130) this.kill(p);
        for (const s of this.arena.spikes)
          if (
            p.x > s.x - 9 &&
            p.x < s.x + s.w + 9 &&
            p.y + (p.prone ? 10 : 30) > s.y - 20 &&
            p.y - (p.prone ? 10 : 25) < s.y + 15
          )
            this.kill(p);
        if (this.elapsed > 45) {
          p.hp -= dt * 8;
          if (p.hp <= 0) this.kill(p);
        }
      }
      const alive = this.players.filter((p) => p.alive);
      if (alive.length <= 1) {
        this.winner = alive[0]?.id ?? null;
        if (this.winner !== null) this.scores[this.winner]++;
        this.phase = "result";
        this.phaseTime = 2.8;
        this.event("round", { winner: this.winner });
      }
    }
  }
  move(p, i, dt) {
    const wasProne = p.prone;
    p.prone = !!i.duck;
    if (
      wasProne &&
      !p.prone &&
      this.platforms.some(
        (s) =>
          p.x + 15 > s.x &&
          p.x - 15 < s.x + s.w &&
          p.y - 48 < s.y + s.h &&
          p.y - 10 > s.y,
      )
    )
      p.prone = true;
    if (p.ground && wasProne !== p.prone) p.y += p.prone ? 20 : -20;
    const radius = p.prone ? 34 : 15,
      bottom = p.prone ? 10 : 30,
      top = p.prone ? 10 : 28;

    p.cooldown = Math.max(0, p.cooldown - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.swing = Math.max(0, p.swing - dt);
    p.flash = Math.max(0, p.flash - dt);
    const wasBlock = p.block;
    p.block = i.block && p.stamina > 2 && p.stun <= 0;
    p.blockTime = p.block ? (wasBlock ? p.blockTime + dt : 0) : 0;
    p.stamina = clamp(p.stamina + (p.block ? -12 : 25) * dt, 0, 100);
    p.coyote = p.ground ? 0.09 : Math.max(0, p.coyote - dt);
    const dir = Number(i.right) - Number(i.left);
    if (dir && p.stun <= 0) {
      p.facing = dir;
      const max = p.prone ? 130 : p.block ? 100 : 330;
      p.vx += dir * (p.prone ? 550 : p.ground ? 2800 : 1700) * dt;
      if (Math.abs(p.vx) > max && Math.sign(p.vx) === dir)
        p.vx += (dir * max - p.vx) * Math.min(1, dt * 6);
    } else if (p.ground)
      p.vx *= Math.pow(p.ice ? 0.985 : p.prone ? 0.984 : 0.86, dt * 120);
    else p.vx *= Math.pow(0.996, dt * 120);
    if (i.jump && !p.jumpHeld && p.stun <= 0 && (p.coyote > 0 || p.jumps < 2)) {
      p.vy = p.jumps === 0 ? -700 : -590;
      p.jumps++;
      p.ground = false;
      p.coyote = 0;
      this.event("jump", { x: p.x, y: p.y + 28, color: COLORS[p.id] });
    }
    p.jumpHeld = i.jump;
    p.aimAngle = i.aim === null ? (p.facing === 1 ? 0 : Math.PI) : i.aim;
    if (i.aim !== null && Math.abs(Math.cos(i.aim)) > 0.1)
      p.facing = Math.sign(Math.cos(i.aim));
    p.vy = Math.min(p.vy + 1800 * dt, 1150);
    const oldX = p.x,
      oldY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ground = false;
    p.ice = false;
    for (const s of this.platforms) {
      if (
        p.x + radius <= s.x ||
        p.x - radius >= s.x + s.w ||
        p.y + bottom <= s.y ||
        p.y - top >= s.y + s.h
      )
        continue;
      if (oldY + bottom <= s.y + 3 && p.vy >= 0) {
        p.y = s.y - bottom;
        if (p.vy > 220) {
          p.landing = Math.min(1, p.vy / 900);
          p.angularVelocity += (p.vx / 330) * 1.8;
        }
        p.vy = 0;
        p.ground = true;
        p.jumps = 0;
        p.ice = !!s.ice;
        p.x += s.dx;
      } else if (oldY - top >= s.y + s.h - 3 && p.vy < 0) {
        p.y = s.y + s.h + top;
        p.vy = Math.abs(p.vy) * 0.2;
      } else if (oldX < s.x) {
        p.x = s.x - radius;
        p.vx = -Math.abs(p.vx) * 0.25;
      } else if (oldX > s.x + s.w) {
        p.x = s.x + s.w + radius;
        p.vx = Math.abs(p.vx) * 0.25;
      }
    }
    p.walk += p.vx * dt * 0.032;
  }
  collidePlayers(a, b) {
    if (
      !a.alive ||
      !b.alive ||
      Math.abs(a.y - b.y) > (a.prone ? 10 : 28) + (b.prone ? 10 : 28)
    )
      return;
    const dx = b.x - a.x,
      overlap = (a.prone ? 33 : 15) + (b.prone ? 33 : 15) - Math.abs(dx);
    if (overlap <= 0) return;
    const sign = dx >= 0 ? 1 : -1;
    a.x -= sign * overlap * 0.5;
    b.x += sign * overlap * 0.5;
    const closing = (a.vx - b.vx) * sign;
    if (closing > 0) {
      a.vx -= sign * closing * 0.52;
      b.vx += sign * closing * 0.52;
    }
  }
  attack(p) {
    const w = p.weapon
      ? WEAPONS[p.weapon]
      : { range: 73, damage: 25, force: 480, cooldown: 0.32, kind: "melee" };
    p.cooldown = w.cooldown;
    p.swing = 0.22;
    const angle = p.aimAngle ?? (p.facing === 1 ? 0 : Math.PI),
      ax = Math.cos(angle),
      ay = Math.sin(angle);
    impulseRig(p, p.x + ax * 30, p.y - 10 + ay * 30, ax * 90, ay * 90);
    if (w.kind === "melee") {
      let hit = false;
      for (const q of this.players) {
        if (q.id === p.id || !q.alive) continue;
        const dx = q.x - p.x,
          dy = q.y - (p.y - 10),
          along = dx * ax + dy * ay,
          across = Math.abs(-dx * ay + dy * ax);
        if (along > -9 && along < w.range && across < (q.prone ? 17 : 40)) {
          this.hit(
            q,
            p,
            w.damage,
            w.force,
            Math.abs(ax) > 0.05 ? ax : p.facing * 0.1,
            ay * 0.8 - 0.5,
          );
          hit = true;
        }
      }
      if (!hit) this.event("swing", { x: p.x, y: p.y });
    } else {
      const count = w.kind === "pellet" ? 5 : 1;
      for (let n = 0; n < count; n++) {
        const spread = count > 1 ? (n - 2) * 0.12 : 0;
        this.projectiles.push({
          x: p.x + ax * 40,
          y: p.y - 10 + ay * 40,
          vx: w.speed * Math.cos(angle + spread),
          vy:
            w.speed * Math.sin(angle + spread) -
            (w.kind === "grenade" ? 330 : 0),
          owner: p.id,
          kind: w.kind,
          damage: w.damage,
          force: w.force,
          life: w.kind === "grenade" ? 1.5 : 2.2,
          r: w.kind === "rocket" ? 8 : w.kind === "grenade" ? 7 : 4,
        });
      }
      const recoil = w.kind === "rocket" ? 240 : w.kind === "pellet" ? 150 : 40;
      p.vx -= ax * recoil;
      p.vy -= ay * recoil;
      impulseRig(
        p,
        p.x + ax * 25,
        p.y - 10 + ay * 25,
        -ax * recoil * 2,
        -ay * recoil * 2,
      );
      this.event("shoot", {
        x: p.x + ax * 40,
        y: p.y - 10 + ay * 40,
        kind: w.kind,
      });
    }
    if (p.weapon) {
      p.ammo--;
      if (p.ammo <= 0) {
        p.weapon = null;
        p.ammo = 0;
      }
    }
  }
  hit(q, p, damage, force, dir, vertical = -0.5) {
    const front = (p.x - q.x) * q.facing > -5;
    if (q.block && front) {
      const parry = q.blockTime < 0.18;
      q.stamina = Math.max(0, q.stamina - (parry ? 5 : 23));
      if (parry) {
        p.vx = -dir * 880;
        p.vy = -440;
        p.stun = 0.32;
        if (p.id !== undefined) impulseRig(p, p.x, p.y - 15, -dir * 900, -440);
        q.cooldown = 0;
        this.hitstop = 0.075;
        this.event("parry", {
          x: (p.x + q.x) / 2,
          y: q.y - 10,
          color: COLORS[q.id],
        });
      } else {
        q.vx += dir * force * 0.28;
        q.vy -= 70;
        p.vx -= dir * 240;
        p.stun = 0.12;
        this.event("block", { x: q.x, y: q.y - 10 });
      }
      return;
    }
    q.hp = Math.max(0, q.hp - damage);
    q.vx = dir * force * (1 + (100 - q.hp) / 220);
    q.vy = Math.min(q.vy, force * vertical);
    q.stun = damage > 30 ? 0.4 : 0.26;
    impulseRig(q, q.x - dir * 10, q.y - 12, dir * force, force * vertical);
    q.flash = 0.15;
    q.block = false;
    this.hitstop = Math.max(this.hitstop, damage > 30 ? 0.065 : 0.045);
    this.event("hit", { x: q.x, y: q.y - 10, color: COLORS[q.id], force });
    if (q.hp <= 0) this.kill(q);
  }
  kill(p) {
    if (!p.alive) return;
    p.alive = false;
    p.hp = 0;
    if (p.weapon)
      this.drops.push({
        x: p.x,
        y: p.y,
        vx: p.vx * 0.4,
        vy: -200,
        type: p.weapon,
        ammo: p.ammo,
        life: 10,
      });
    const points = (p.rig || makeRig(p)).map((q) => ({ ...q }));
    this.ragdolls.push({ points, color: COLORS[p.id], life: 5 });
    this.event("ko", { x: p.x, y: p.y, color: COLORS[p.id] });
  }
  pickup(p) {
    let best = null,
      dist = 62;
    for (const d of this.drops) {
      const v = Math.hypot(p.x - d.x, p.y - d.y);
      if (v < dist) {
        best = d;
        dist = v;
      }
    }
    if (best) {
      if (p.weapon)
        this.drops.push({
          x: p.x,
          y: p.y - 20,
          vx: -p.facing * 120,
          vy: -220,
          type: p.weapon,
          ammo: p.ammo,
          life: 12,
        });
      p.weapon = best.type;
      p.ammo = best.ammo;
      this.drops = this.drops.filter((d) => d !== best);
      this.event("pickup", { x: p.x, y: p.y, color: COLORS[p.id] });
    }
  }
  spawnWeapon() {
    if (this.drops.length >= 5) return;
    const s = this.platforms[Math.floor(this.random() * this.platforms.length)];
    const type = Object.keys(WEAPONS)[Math.floor(this.random() * 6)];
    this.drops.push({
      x: s.x + s.w * (0.2 + this.random() * 0.6),
      y: s.y - 180,
      vx: 0,
      vy: 0,
      type,
      ammo: WEAPONS[type].ammo,
      life: 18,
    });
  }
  updateDrops(dt) {
    for (const d of this.drops) {
      d.life -= dt;
      const oldY = d.y;
      d.vy += 1000 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      for (const s of this.platforms)
        if (
          d.x > s.x &&
          d.x < s.x + s.w &&
          oldY + 8 <= s.y + 2 &&
          d.y + 8 >= s.y &&
          d.vy > 0
        ) {
          d.y = s.y - 8;
          d.vy = 0;
          d.vx *= 0.9;
          d.x += s.dx;
        }
    }
    this.drops = this.drops.filter((d) => d.life > 0 && d.y < H + 100);
  }
  explode(b) {
    this.event("explosion", { x: b.x, y: b.y });
    for (const p of this.players) {
      if (!p.alive) continue;
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      if (dist < 145) {
        const scale = 1 - dist / 190;
        const source = { x: b.x, y: b.y, vx: 0, vy: 0, stun: 0 };
        this.hit(
          p,
          source,
          b.damage * scale,
          b.force * scale,
          Math.sign(p.x - b.x) || 1,
          -0.7,
        );
      }
    }
  }
  updateProjectiles(dt) {
    for (const b of this.projectiles) {
      b.life -= dt;
      const oldY = b.y;
      if (b.kind === "grenade") b.vy += 1100 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let impact = false;
      for (const s of this.platforms)
        if (
          b.x > s.x - b.r &&
          b.x < s.x + s.w + b.r &&
          b.y > s.y - b.r &&
          b.y < s.y + s.h + b.r
        ) {
          if (b.kind === "grenade") {
            if (oldY <= s.y) {
              b.y = s.y - b.r;
              b.vy = -Math.abs(b.vy) * 0.6;
              b.vx *= 0.75;
            } else b.vx *= -0.6;
          } else impact = true;
        }
      if (b.kind !== "grenade")
        for (const p of this.players) {
          if (
            !p.alive ||
            p.id === b.owner ||
            Math.abs(p.x - b.x) > (p.prone ? 34 : 18) + b.r ||
            Math.abs(p.y - b.y) > (p.prone ? 10 : 28) + b.r
          )
            continue;
          impact = true;
          if (b.kind !== "rocket") {
            const source = {
              x: b.x - Math.sign(b.vx) * 35,
              y: b.y,
              vx: 0,
              vy: 0,
              stun: 0,
            };
            if (
              p.block &&
              p.blockTime < 0.18 &&
              (source.x - p.x) * p.facing > 0
            ) {
              b.owner = p.id;
              b.vx *= -1;
              b.x = p.x + p.facing * 35;
              impact = false;
              this.event("parry", { x: p.x, y: p.y, color: COLORS[p.id] });
              break;
            }
            this.hit(p, source, b.damage, b.force, Math.sign(b.vx));
          }
          break;
        }
      if (
        (impact || b.life <= 0) &&
        (b.kind === "rocket" || b.kind === "grenade")
      )
        this.explode(b);
      if (impact) b.life = 0;
    }
    this.projectiles = this.projectiles.filter(
      (b) => b.life > 0 && b.x > -200 && b.x < W + 200 && b.y < H + 200,
    );
  }
  updateRagdolls(dt) {
    const joints = JOINTS;
    for (const rag of this.ragdolls) {
      rag.life -= dt;
      for (const p of rag.points) {
        const vx = (p.x - p.px) * 0.993,
          vy = (p.y - p.py) * 0.993;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + 1800 * dt * dt;
      }
      for (let k = 0; k < 4; k++)
        for (const [a, b, len] of joints) {
          const p = rag.points[a],
            q = rag.points[b],
            dx = q.x - p.x,
            dy = q.y - p.y,
            d = Math.hypot(dx, dy) || 1,
            f = ((d - len) / d) * 0.5;
          p.x += dx * f;
          p.y += dy * f;
          q.x -= dx * f;
          q.y -= dy * f;
        }
      for (const p of rag.points)
        for (const s of this.platforms)
          if (
            p.x > s.x &&
            p.x < s.x + s.w &&
            p.py <= s.y + 5 &&
            p.y >= s.y - 4 &&
            p.y < s.y + s.h
          ) {
            p.y = s.y - 4;
            p.py = p.y + (p.y - p.py) * 0.35;
            p.px = p.x - (p.x - p.px) * 0.7;
          }
    }
    this.ragdolls = this.ragdolls.filter((r) => r.life > 0);
  }
  snapshot() {
    return {
      players: this.players,
      platforms: this.platforms,
      projectiles: this.projectiles,
      drops: this.drops,
      ragdolls: this.ragdolls,
      scores: this.scores,
      phase: this.phase,
      phaseTime: this.phaseTime,
      round: this.round,
      arenaIndex: this.arenaIndex,
      elapsed: this.elapsed,
      time: this.time,
      winner: this.winner,
      target: this.target,
      events: this.events,
    };
  }
}
