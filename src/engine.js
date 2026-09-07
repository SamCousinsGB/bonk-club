import { PALETTE, defaultProfile, availableProfile } from "./identity.js";
import { meleeAttack } from "./melee.js";
import {
  steerSpecial,
  impactSpecial,
  expireSpecial,
  updateFields,
} from "./specials.js";
import {
  WEAPONS,
  chooseWeapon,
  WeaponRotation,
  firingRecoil,
} from "./arsenal.js";
export { WEAPONS } from "./arsenal.js";
import { preparePlatforms } from "./terrain.js";
import { BotController } from "./bots.js";
import { THEMED_ARENAS, breakable } from "./maps.js";
import { updateHazards } from "./hazards.js";
import { SKYSCRAPERS } from "./skyscrapers.js";
import { segmentBox, playerBox } from "./collision.js";
import {
  JOINTS,
  makeRig,
  updateRig,
  impulseRig,
  collideRigs,
} from "./puppet.js";
import {
  W,
  H,
  RUN_SPEED,
  CRAWL_SPEED,
  GUARD_SPEED,
  SUDDEN_DEATH,
  expandArena,
} from "./scale.js";
export { W, H } from "./scale.js";
export const STEP = 1 / 120;
export const COLORS = ["#55baff", "#f7d747", "#ff7393", "#81edb0"];
export const NAMES = ["BLUE", "YELLOW", "PINK", "MINT"];
const platform = (x, y, w, h = 22, extra = {}) => ({ x, y, w, h, ...extra });
export const ARENAS = [
  {
    name: "PLATFORMS",
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
    name: "SPLIT FLOOR",
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
    name: "SPIKES",
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
    name: "TIERS",
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
    name: "ICE",
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
    name: "MOVING PLATFORMS",
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
    name: "SIDE BALCONIES",
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
    name: "ISLAND",
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
]
  .map(expandArena)
  .concat(SKYSCRAPERS, THEMED_ARENAS);
export const CITY_ARENAS = ARENAS.flatMap((a, i) => (a.city ? [i] : []));
export const emptyInput = () => ({
  left: false,
  right: false,
  jump: false,
  attack: false,
  block: false,
  throw: false,
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
    bots = [],
    arena = 0,
    shuffle = true,
    random = Math.random,
    arenaPool = null,
  } = {}) {
    if (
      players.length < 1 ||
      players.length > 4 ||
      new Set(players).size !== players.length ||
      players.some((i) => !Number.isInteger(i) || i < 0 || i > 3)
    )
      throw new Error("Choose 1–4 distinct player slots.");
    this.ids = players.length === 1 ? [0, 1, 2, 3] : [...players];
    this.botIds = new Set(
      players.length === 1
        ? this.ids.filter((id) => !players.includes(id))
        : bots,
    );
    this.occupants = [0, 0, 0, 0];
    this.profiles = {};
    this.weaponRotation = new WeaponRotation(random);
    this.ai = new BotController();
    this.arenaIndex = arena;
    this.shuffle = shuffle;
    this.arenaPool = arenaPool || ARENAS.map((_, i) => i);
    this.remainingArenas = this.arenaPool.filter((i) => i !== arena);
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
    this.terrainVersion = 0;
    this.platforms = preparePlatforms(this.arena, this.arenaIndex).map(
      (p, i) => ({
        id: "floor" + i,
        ...p,
        baseX: p.x,
        baseY: p.y,
        dx: 0,
        dy: 0,
      }),
    );
    this.players = this.ids.map((id) => this.makePlayer(id));
    this.ai.reset();
    this.projectiles = [];
    this.fields = [];
    const featured = this.weaponRotation.opening(this.round);
    const seenWeapons = new Set();
    this.drops = (this.arena.weapons || []).map(([x, y], index) => {
      const type = featured[index] || chooseWeapon(this.random, seenWeapons);
      seenWeapons.add(type);
      return {
        x,
        y,
        type,
        ammo: WEAPONS[type].ammo,
        vx: 0,
        vy: 0,
        life: SUDDEN_DEATH,
      };
    });
    this.cover = (this.arena.cover || []).map((c, i) => ({
      ...c,
      id: "cover" + i,
      dx: 0,
      dy: 0,
    }));
    this.debris = [];
    this.hazards = [];
    this.nextHazard = 0;
    this.hazardTimer = 8 + this.random() * 4;
    this.ragdolls = [];
    this.phase = "countdown";
    this.phaseTime = 2.4;
    this.elapsed = 0;
    this.weaponTimer = 2;
    this.hitstop = 0;
    this.winner = null;
    this.events = [];
  }
  makePlayer(id) {
    const [x, y] = this.arena.spawns[this.ids.indexOf(id)];
    return {
      id,
      ...(this.profiles[id] || defaultProfile(id)),
      bot: this.botIds.has(id),
      occupant: this.occupants[id],
      x,
      y,
      vx: 0,
      vy: 0,
      hp: 100,
      alive: true,
      facing: id % 2 ? -1 : 1,
      ground: false,
      coyote: 0,
      jumps: 0,
      jumpHeld: false,
      throwHeld: false,
      pickupCooldown: 0,
      support: null,
      block: false,
      blockTime: 0,
      stamina: 100,
      stun: 0,
      cooldown: 0,
      recoilTime: 0,
      swing: 0,
      swingDuration: 0.22,
      meleeMove: "punch",
      comboStep: 0,
      comboTime: 0,
      airLunge: false,
      rush: 0,
      burn: 0,
      chill: 0,
      weapon: null,
      ammo: 0,
      walk: 0,
      flash: 0,
      prone: false,
      aimAngle: id % 2 ? Math.PI : 0,
      rig: null,
      bodyAngle: 0,
      angularVelocity: 0,
      landing: 0,
    };
  }
  setProfiles(roster) {
    const used = [];
    for (const entry of roster) {
      const profile = availableProfile(entry, used, defaultProfile(entry.id));
      this.profiles[entry.id] = profile;
      used.push(profile);
    }
    for (const p of this.players) {
      if (p.bot) {
        const profile = availableProfile(defaultProfile(p.id), used);
        profile.name = PALETTE.find(
          (c) => c.value === profile.color,
        ).name.toUpperCase();
        this.profiles[p.id] = profile;
        used.push(profile);
      }
      Object.assign(p, this.profiles[p.id] || defaultProfile(p.id));
    }
  }
  replacePlayer(id, bot) {
    if (!this.ids.includes(id) || this.botIds.has(id) === bot) return;
    if (bot) {
      this.botIds.add(id);
      delete this.profiles[id];
    } else this.botIds.delete(id);
    this.scores[id] = 0;
    this.occupants[id]++;
    this.ai.forget(id);
    const previous = this.players.find((p) => p.id === id);
    // A live fighter is taken over in place. Eliminated arrivals enter at a clear spawn.
    const p =
      !previous.alive && this.phase === "fight"
        ? this.makePlayer(id)
        : previous;
    if (p !== previous) {
      const surfaces = this.platforms.filter(
        (s) => s.hp !== 0 && !s.move && !s.travel && s.w >= 100,
      );
      const choices = surfaces
        .flatMap((s) =>
          [s.x + 35, s.x + s.w - 35].map((x) => ({ x, y: s.y - 30 })),
        )
        .filter(
          (q) =>
            !this.solids().some(
              (s) =>
                q.x + 16 > s.x &&
                q.x - 16 < s.x + s.w &&
                q.y + 29 > s.y &&
                q.y - 29 < s.y + s.h,
            ),
        )
        .filter(
          (q) =>
            !this.hazards.some(
              (h) =>
                Math.abs(q.x - h.x) < h.w / 2 + 30 &&
                q.y > h.y - h.h - 30 &&
                q.y < h.y + 30,
            ),
        );
      choices.sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      );
      if (choices[0]) Object.assign(p, choices[0]);
      this.players[this.players.indexOf(previous)] = p;
    }
    Object.assign(p, {
      bot,
      ...(this.profiles[id] || defaultProfile(id)),
      occupant: this.occupants[id],
      jumpHeld: false,
      throwHeld: false,
      block: false,
    });
    if (this.phase === "result" && this.winner === id) this.winner = null;
  }
  event(type, data = {}) {
    this.events.push({ id: ++this.nextEvent, type, ...data });
    if (this.events.length > 35) this.events.shift();
  }
  step(dt, inputs = {}) {
    dt = clamp(dt, 0, 0.025);
    this.time += dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    this.movePlatforms();
    this.updateCover(dt);
    this.updateDebris(dt);
    if (this.phase === "result") {
      updateFields(this, dt);
      for (const p of this.players)
        if (p.alive) {
          this.move(p, emptyInput(), dt);
          updateRig(p, dt, this.solids(), this.time);
        }
      this.updateRagdolls(dt);
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.round++;
        if (this.shuffle) {
          if (!this.remainingArenas.length)
            this.remainingArenas = [...this.arenaPool];
          const choices = this.remainingArenas.filter(
            (i) => i !== this.arenaIndex,
          );
          this.arenaIndex =
            choices[Math.floor(this.random() * choices.length)] ??
            this.arenaIndex;
          this.remainingArenas = this.remainingArenas.filter(
            (i) => i !== this.arenaIndex,
          );
        }
        this.startRound();
      }
      return;
    }
    const active = this.phase === "fight";
    if (active && this.botIds.size)
      inputs = { ...inputs, ...this.ai.inputs(this, dt) };
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
        this.weaponTimer = 3 + this.random() * 2;
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
      if (i.throw && !p.throwHeld && p.stun <= 0) this.throwWeapon(p);
      p.throwHeld = i.throw;
      if (!i.throw && p.cooldown <= 0 && p.stun <= 0 && !p.block) {
        if (i.block && p.weapon && WEAPONS[p.weapon].alt) this.attack(p, true);
        else if (i.attack) this.attack(p);
      }
    }
    for (let a = 0; a < this.players.length; a++)
      for (let b = a + 1; b < this.players.length; b++)
        this.collidePlayers(this.players[a], this.players[b]);
    for (const p of this.players)
      if (p.alive) updateRig(p, dt, this.solids(), this.time);
    for (let a = 0; a < this.players.length; a++)
      for (let b = a + 1; b < this.players.length; b++)
        collideRigs(this.players[a], this.players[b]);
    updateFields(this, dt);
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    if (active) for (const p of this.players) if (p.alive) this.pickup(p);
    this.updateRagdolls(dt);
    if (active) updateHazards(this, dt);
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
        if (this.elapsed > SUDDEN_DEATH) {
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
  solids() {
    return [
      ...this.platforms.filter((p) => p.hp !== 0),
      ...this.cover.filter((c) => c.hp > 0),
    ];
  }
  movePlatforms() {
    for (const p of this.platforms) {
      const oldX = p.x,
        oldY = p.y;
      if (p.move) p.x = p.baseX + Math.sin(this.time * p.speed) * p.move;
      if (p.travel)
        p.y =
          p.baseY +
          ((1 - Math.cos(this.time * p.speed + (p.phase || 0))) * p.travel) / 2;
      p.dx = p.x - oldX;
      p.dy = p.y - oldY;
    }
  }
  move(p, i, dt) {
    const solids = this.solids();
    const support = p.ground && solids.find((s) => s.id === p.support);
    if (support) {
      p.x += support.dx || 0;
      p.y += support.dy || 0;
    }
    p.pickupCooldown = Math.max(0, p.pickupCooldown - dt);
    p.comboTime = Math.max(0, p.comboTime - dt);
    p.rush = Math.max(0, p.rush - dt);
    p.chill = Math.max(0, p.chill - dt);
    if (p.burn > 0) {
      p.burn = Math.max(0, p.burn - dt);
      p.hp = Math.max(0, p.hp - 5 * dt);
      if (!p.hp) this.kill(p);
    }
    if (p.ground) p.airLunge = false;
    const wasProne = p.prone;
    p.prone = !!i.duck;
    if (
      wasProne &&
      !p.prone &&
      solids.some(
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
    p.recoilTime = Math.max(0, p.recoilTime - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.swing = Math.max(0, p.swing - dt);
    p.flash = Math.max(0, p.flash - dt);
    const wasBlock = p.block;
    p.block = !p.weapon && i.block && p.stamina > 2 && p.stun <= 0;
    p.blockTime = p.block ? (wasBlock ? p.blockTime + dt : 0) : 0;
    p.stamina = clamp(p.stamina + (p.block ? -12 : 25) * dt, 0, 100);
    p.coyote = p.ground ? 0.09 : Math.max(0, p.coyote - dt);
    const dir = Number(i.right) - Number(i.left);
    if (dir && p.stun <= 0) {
      p.facing = dir;
      const max =
        (p.prone ? CRAWL_SPEED : p.block ? GUARD_SPEED : RUN_SPEED) *
        (p.chill > 0 ? 0.58 : 1);
      const acceleration =
        (p.prone ? 400 : p.ground ? 1500 : 950) * (p.recoilTime > 0 ? 0.3 : 1);
      // Input approaches the run speed. External hit/recoil velocity can exceed it,
      // but holding a direction must never add more speed above that limit.
      if (p.vx * dir < max)
        p.vx += dir * Math.min(acceleration * dt, max - p.vx * dir);
      else
        p.vx +=
          (dir * max - p.vx) * Math.min(1, dt * (p.recoilTime > 0 ? 0.6 : 3));
    } else if (p.ground)
      p.vx *= Math.pow(
        p.recoilTime > 0 ? 0.993 : p.ice ? 0.985 : p.prone ? 0.984 : 0.86,
        dt * 120,
      );
    else p.vx *= Math.pow(0.996, dt * 120);
    if (i.jump && !p.jumpHeld && p.stun <= 0 && (p.coyote > 0 || p.jumps < 2)) {
      p.vy = p.jumps === 0 ? -700 : -590;
      p.jumps++;
      p.ground = false;
      p.coyote = 0;
      this.event("jump", { x: p.x, y: p.y + 28, color: p.color });
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
    p.support = null;
    p.ice = false;
    for (const s of solids) {
      if (
        p.x + radius <= s.x ||
        p.x - radius >= s.x + s.w ||
        p.y + bottom <= s.y ||
        p.y - top >= s.y + s.h
      )
        continue;
      if (
        oldY + bottom <= s.y - (support === s ? 0 : s.dy || 0) + 3 &&
        p.vy >= 0
      ) {
        p.y = s.y - bottom;
        if (p.vy > 220) {
          p.landing = Math.min(1, p.vy / 900);
          p.angularVelocity += (p.vx / RUN_SPEED) * 1.8;
        }
        p.vy = 0;
        p.ground = true;
        p.jumps = 0;
        p.ice = !!s.ice;
        p.support = s.id;
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
  attack(p, alternate = false) {
    const base = p.weapon ? WEAPONS[p.weapon] : { kind: "melee" };
    if (alternate && (!base.alt || p.ammo < base.alt.ammoCost)) return;
    const w = alternate ? { ...base, ...base.alt } : base;
    if (w.proneOnly && (!p.prone || !p.ground)) return;
    const angle = p.aimAngle ?? (p.facing === 1 ? 0 : Math.PI),
      ax = Math.cos(angle),
      ay = Math.sin(angle);
    if (w.kind === "melee") {
      meleeAttack(this, p, w);
    } else {
      p.cooldown = w.cooldown;
      p.swing = 0.16;
      p.swingDuration = 0.16;
      p.meleeMove = "weapon";
      p.comboTime = 0;
      const count = w.count || (w.kind === "pellet" ? 5 : 1);
      for (let n = 0; n < count; n++) {
        const spread =
          count > 1
            ? (n - (count - 1) / 2) *
              (w.spread || (w.kind === "rocket" ? 0.18 : 0.12))
            : (this.random() - 0.5) * (w.spread || 0);
        this.projectiles.push({
          x: p.x + ax * 12,
          y: p.y - 10 + ay * 12,
          vx: w.speed * Math.cos(angle + spread),
          vy:
            w.speed * Math.sin(angle + spread) -
            (w.kind === "grenade" ? (w.lift ?? 330) : 0),
          owner: p.id,
          weapon: p.weapon,
          homing: !!w.homing,
          cluster: !!w.cluster,
          nuclear: !!w.nuclear,
          alternate,
          burn: w.burn || 0,
          chill: w.chill || 0,
          kind: w.kind,
          damage: w.damage,
          force: w.force,
          life:
            w.life ||
            (w.kind === "grenade" ? 1.5 : w.kind === "rail" ? 0.8 : 4.5),
          radius: w.radius || 145,
          bounces: w.bounces || (w.kind === "plasma" ? 2 : 0),
          hitIds: [],
          r:
            w.r ||
            (["force", "saw"].includes(w.kind)
              ? 18
              : ["flame", "singularity"].includes(w.kind)
                ? 10
                : w.kind === "plasma"
                  ? 11
                  : w.kind === "rocket"
                    ? 8
                    : w.kind === "grenade"
                      ? 7
                      : 4),
        });
      }
      const recoil = firingRecoil(w, p);
      if (recoil >= 60)
        p.recoilTime = Math.max(
          p.recoilTime,
          Math.min(0.32, 0.12 + recoil / 2000),
        );
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
      p.ammo -= w.ammoCost || 1;
      if (p.ammo <= 0) {
        p.weapon = null;
        p.ammo = 0;
      }
    }
  }
  hit(q, p, damage, force, dir, vertical = -0.5, options = {}) {
    if (q.weapon) q.block = false;
    const front = (p.x - q.x) * q.facing > -5;
    if (q.block && front && options.finisher && q.blockTime >= 0.18) {
      q.stamina = Math.max(0, q.stamina - 42);
      if (q.stamina <= 0) q.block = false;
    }
    if (q.block && front) {
      const parry = q.blockTime < 0.18;
      q.stamina = Math.max(0, q.stamina - (parry ? 5 : 23));
      if (parry) {
        p.vx = -dir * 880;
        p.vy = -440;
        p.stun = 0.32;
        p.comboTime = 0;
        p.rush = 0;
        if (p.id !== undefined) impulseRig(p, p.x, p.y - 15, -dir * 900, -440);
        q.cooldown = 0;
        this.hitstop = 0.075;
        this.event("parry", {
          x: (p.x + q.x) / 2,
          y: q.y - 10,
          color: q.color,
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
    if (q.rush > 0 && !q.weapon && options.projectile) damage *= 0.65;
    q.hp = Math.max(0, q.hp - damage);
    const knockback = dir * force * (1 + (100 - q.hp) / 220);
    // A following low-force pellet must not cancel a launch in the same direction.
    q.vx =
      q.vx * knockback > 0 && Math.abs(q.vx) > Math.abs(knockback)
        ? q.vx
        : knockback;
    q.vy = Math.min(q.vy, force * vertical);
    q.stun = Math.max(q.stun, options.stun ?? (damage > 30 ? 0.4 : 0.26));
    if (q.rush > 0 && !q.weapon && options.projectile)
      q.stun = Math.min(q.stun, 0.035);
    if (q.stun > 0.2) q.comboTime = 0;
    impulseRig(q, q.x - dir * 10, q.y - 12, dir * force, force * vertical);
    q.flash = 0.15;
    q.block = false;
    this.hitstop = Math.max(
      this.hitstop,
      options.hitstop ?? (damage > 30 ? 0.065 : 0.045),
    );
    this.event("hit", { x: q.x, y: q.y - 10, color: q.color, force });
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
    this.ragdolls.push({
      points,
      color: p.color,
      hair: p.hair,
      facing: p.facing,
      life: 5,
    });
    this.event("ko", { x: p.x, y: p.y, color: p.color });
  }
  pickup(p) {
    if (p.weapon || p.pickupCooldown > 0 || !p.alive) return;
    let best = null,
      dist = 48;
    for (const d of this.drops) {
      if (d.armed || d.lock > 0 || (d.owner === p.id && d.ownerLock > 0))
        continue;
      const v = Math.hypot(p.x - d.x, p.y - d.y);
      if (
        v < dist &&
        !this.solids().some((s) => segmentBox(p.x, p.y, d.x, d.y, s))
      ) {
        best = d;
        dist = v;
      }
    }
    if (best) {
      p.weapon = best.type;
      p.block = false;
      p.blockTime = 0;
      p.ammo = best.ammo;
      this.drops = this.drops.filter((d) => d !== best);
      this.event("pickup", { x: p.x, y: p.y, color: p.color });
    }
  }
  throwWeapon(p) {
    if (!p.weapon) return;
    if (p.weapon === "nuke") {
      this.attack(p);
      p.pickupCooldown = 0.35;
      this.event("throw", { x: p.x, y: p.y });
      return;
    }
    const ax = Math.cos(p.aimAngle),
      ay = Math.sin(p.aimAngle);
    this.drops.push({
      x: p.x + ax * 12,
      y: p.y - 10 + ay * 12,
      vx: ax * 850 + p.vx * 0.4,
      vy: ay * 850 - 140 + p.vy * 0.2,
      type: p.weapon,
      ammo: p.ammo,
      life: 18,
      owner: p.id,
      lock: 0.22,
      ownerLock: 1,
      armed: true,
      angle: p.aimAngle,
      spin: p.facing * 17,
    });
    p.weapon = null;
    p.ammo = 0;
    p.pickupCooldown = 0.35;
    p.swing = 0.22;
    p.cooldown = Math.max(p.cooldown, 0.22);
    impulseRig(p, p.x + ax * 25, p.y - 10, ax * 250, ay * 250);
    this.event("throw", { x: p.x, y: p.y });
  }
  spawnWeapon() {
    if (this.drops.length >= 12) return;
    const platforms = this.platforms.filter((p) => p.hp !== 0 && p.w >= 90);
    const s = platforms[Math.floor(this.random() * platforms.length)];
    if (!s) return;
    const type = chooseWeapon(
      this.random,
      new Set(this.drops.map((d) => d.type)),
    );
    const x = s.x + s.w * (0.2 + this.random() * 0.6);
    // Spawn within the chosen storey instead of falling onto the roof above it.
    this.drops.push({
      x,
      y: s.y - 75,
      vx: 0,
      vy: 0,
      type,
      ammo: WEAPONS[type].ammo,
      life: 60,
    });
  }
  updateDrops(dt) {
    for (const d of this.drops) {
      d.life -= dt;
      d.lock = Math.max(0, (d.lock || 0) - dt);
      d.ownerLock = Math.max(0, (d.ownerLock || 0) - dt);
      const support = this.solids().find((s) => s.id === d.support);
      if (support) {
        d.x += support.dx || 0;
        d.y += support.dy || 0;
      }
      d.support = null;
      const x = d.x,
        y = d.y;
      d.vy += 1000 * dt;
      const endX = x + d.vx * dt,
        endY = y + d.vy * dt;
      d.angle = (d.angle || 0) + (d.spin || 0) * dt;
      const hits = this.solids().map((s) => ({
        s,
        hit: segmentBox(x, y, endX, endY, s, 7),
      }));
      if (d.armed)
        for (const p of this.players) {
          if (!p.alive || (p.id === d.owner && d.ownerLock > 0)) continue;
          hits.push({ p, hit: segmentBox(x, y, endX, endY, playerBox(p), 7) });
        }
      const collision = hits
        .filter((c) => c.hit)
        .sort((a, b) => a.hit.t - b.hit.t)[0];
      d.x = endX;
      d.y = endY;
      if (collision) {
        const { s, p, hit } = collision;
        d.x = x + (endX - x) * hit.t + hit.nx * 0.2;
        d.y = y + (endY - y) * hit.t + hit.ny * 0.2;
        if (p)
          this.hit(p, { x, y, vx: 0, vy: 0 }, 22, 560, Math.sign(d.vx) || 1);
        if (breakable(s) && d.armed) this.damageCover(s, 38, d.vx, d.vy);
        if (s && hit.ny === -1) {
          d.y = s.y - 7;
          d.vy = 0;
          d.vx *= 0.85;
          d.spin = 0;
          d.angle = -0.12;
          d.support = s.id;
        } else {
          if (hit.nx) d.vx *= -0.3;
          if (hit.ny) d.vy *= -0.3;
          if (p) {
            d.vx *= -0.25;
            d.vy = -160;
          }
          d.spin = (d.spin || 0) * 0.4;
        }
        d.armed = false;
      }
    }
    this.drops = this.drops.filter(
      (d) => d.life > 0 && d.y < H + 100 && d.x > -150 && d.x < W + 150,
    );
  }
  damageCover(c, damage, vx = 0, vy = 0) {
    if (!breakable(c) || c.hp <= 0) return;
    c.hp = Math.max(0, c.hp - damage);
    this.event(c.hp ? "coverhit" : "break", {
      x: c.x + c.w / 2,
      y: c.y + c.h / 2,
      color: "#c89566",
    });
    if (c.hp > 0) return;
    this.terrainVersion++;
    for (let n = 0; n < 9; n++)
      this.debris.push({
        x: c.x + ((n % 3) * c.w) / 3,
        y: c.y + (Math.floor(n / 3) * c.h) / 3,
        vx: vx * 0.2 + (this.random() - 0.5) * 320,
        vy: Math.min(-80, vy * 0.2 - this.random() * 260),
        angle: this.random() * Math.PI,
        spin: (this.random() - 0.5) * 18,
        w: 12 + this.random() * 20,
        h: 5 + this.random() * 6,
        life: 2.5,
      });
    this.debris = this.debris.slice(-90);
  }
  updateCover(dt) {
    for (const c of this.cover) {
      c.dx = 0;
      c.dy = 0;
      if (c.hp <= 0) continue;
      const floors = this.platforms.filter(
        (p) => p.hp !== 0 && c.x + c.w > p.x + 3 && c.x < p.x + p.w - 3,
      );
      const support =
        floors.find(
          (p) =>
            p.id === c.support && Math.abs(c.y + c.h - (p.y - (p.dy || 0))) < 4,
        ) || floors.find((p) => Math.abs(c.y + c.h - p.y) < 3);
      if (support) {
        const oldY = c.y;
        c.x += support.dx || 0;
        c.y = support.y - c.h;
        c.dx = support.dx || 0;
        c.dy = c.y - oldY;
        c.support = support.id;
        c.vy = 0;
        continue;
      }
      c.support = null;
      const oldY = c.y;
      c.vy = Math.min(900, (c.vy || 0) + 1400 * dt);
      c.y += c.vy * dt;
      for (const p of floors)
        if (oldY + c.h <= p.y + 3 && c.y + c.h >= p.y) {
          c.y = p.y - c.h;
          c.vy = 0;
          c.support = p.id;
          break;
        }
      c.dy = c.y - oldY;
      if (c.y > H + 100) this.damageCover(c, c.hp);
    }
  }
  updateDebris(dt) {
    for (const d of this.debris) {
      d.life -= dt;
      d.vy += 1500 * dt;
      const oldY = d.y;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.angle += d.spin * dt;
      for (const s of this.platforms.filter((p) => p.hp !== 0))
        if (d.x > s.x && d.x < s.x + s.w && oldY <= s.y && d.y >= s.y) {
          d.y = s.y - 1;
          d.vy *= -0.3;
          d.vx *= 0.65;
          d.spin *= 0.5;
        }
    }
    this.debris = this.debris.filter((d) => d.life > 0 && d.y < H + 100);
  }
  explode(b) {
    const radius = b.radius || 145;
    this.event("explosion", { x: b.x, y: b.y, radius, nuclear: !!b.nuclear });
    // Cover present at detonation absorbs this blast, even if the blast breaks it.
    const cover = this.solids().filter(breakable);
    const solidWalls = this.platforms.filter((p) => !p.destructible);
    for (const p of this.players) {
      if (!p.alive) continue;
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      const walls = solidWalls.some((s) => segmentBox(b.x, b.y, p.x, p.y, s));
      if (dist >= radius || walls) continue;
      const shield = cover.some((s) => segmentBox(b.x, b.y, p.x, p.y, s));
      const scale = (1 - dist / (radius * 1.32)) * (shield ? 0.12 : 1);
      this.hit(
        p,
        { x: b.x, y: b.y, vx: 0, vy: 0, stun: 0 },
        b.damage * scale,
        b.force * scale,
        Math.sign(p.x - b.x) || 1,
        -0.7,
      );
    }
    for (const c of cover) {
      const x = clamp(b.x, c.x, c.x + c.w),
        y = clamp(b.y, c.y, c.y + c.h);
      if (
        Math.hypot(b.x - x, b.y - y) < radius &&
        !solidWalls.some((s) => segmentBox(b.x, b.y, x, y, s))
      )
        this.damageCover(
          c,
          b.damage * 1.7,
          Math.sign(c.x + c.w / 2 - b.x) * b.force,
          -b.force * 0.5,
        );
    }
  }
  updateProjectiles(dt) {
    for (const b of [...this.projectiles]) {
      if (b.life <= 0) continue;
      b.life -= dt;
      steerSpecial(this, b, dt);
      const x = b.x,
        y = b.y;
      b.px = x;
      b.py = y;
      if (b.kind === "grenade") b.vy += 1100 * dt;
      const endX = x + b.vx * dt,
        endY = y + b.vy * dt;
      const collisions = this.solids().map((s) => ({
        s,
        hit: segmentBox(x, y, endX, endY, s, b.r),
      }));
      if (b.kind !== "grenade")
        for (const p of this.players) {
          if (!p.alive || p.id === b.owner || b.hitIds?.includes(p.id))
            continue;
          collisions.push({
            p,
            hit: segmentBox(x, y, endX, endY, playerBox(p), b.r),
          });
        }
      collisions.sort((a, b) => (a.hit?.t ?? 2) - (b.hit?.t ?? 2));
      b.x = endX;
      b.y = endY;
      let impact = false,
        redirected = false;
      for (const collision of collisions) {
        if (!collision.hit) continue;
        const { s, p, hit } = collision;
        if (breakable(s) && s.hp <= 0) continue;
        b.x = x + (endX - x) * hit.t + hit.nx * 0.2;
        b.y = y + (endY - y) * hit.t + hit.ny * 0.2;
        if (s) {
          if (breakable(s)) {
            this.damageCover(
              s,
              b.kind === "rail" ? 180 : b.damage,
              b.vx * 0.3,
              b.vy * 0.3,
            );
            if (["rail", "saw"].includes(b.kind) && s.hp <= 0) continue;
          }
          if (
            b.kind === "grenade" ||
            (["plasma", "ricochet", "saw"].includes(b.kind) && b.bounces > 0)
          ) {
            const damp = b.kind === "grenade" ? 0.6 : 1;
            if (hit.nx) b.vx *= -damp;
            if (hit.ny) {
              b.vy *= -damp;
              if (b.kind === "grenade") b.vx *= 0.8;
            }
            b.bounces = (b.bounces || 0) - 1;
            redirected = true;
            break;
          }
          impact = true;
          break;
        }
        if (["rocket", "plasma", "singularity"].includes(b.kind)) {
          impact = true;
          break;
        }
        const source = {
          x: b.x - Math.sign(b.vx) * 35,
          y: b.y,
          vx: 0,
          vy: 0,
          stun: 0,
        };
        if (
          !p.weapon &&
          p.block &&
          p.blockTime < 0.18 &&
          (source.x - p.x) * p.facing > 0
        ) {
          b.owner = p.id;
          b.vx *= -1;
          b.vy *= -1;
          b.hitIds = [];
          b.x = p.x + p.facing * ((p.prone ? 34 : 18) + b.r + 2);
          this.event("parry", { x: p.x, y: p.y, color: p.color });
          redirected = true;
          break;
        }
        const hp = p.hp;
        this.hit(
          p,
          source,
          b.damage,
          b.force,
          Math.sign(b.vx) || 0.1,
          Math.sin(Math.atan2(b.vy, b.vx)) * 0.5 - 0.3,
          {
            projectile: true,
            stun: ["flame", "frost"].includes(b.kind)
              ? 0.015
              : b.damage <= 18
                ? 0.055
                : undefined,
            hitstop: b.damage <= 18 ? 0.008 : undefined,
          },
        );
        impactSpecial(this, b, p, p.hp < hp);
        if (["rail", "saw", "force"].includes(b.kind)) {
          (b.hitIds ||= []).push(p.id);
          continue;
        }
        impact = true;
        break;
      }
      // A piercing beam carries on to the end of its swept segment after passing cover or a player.
      if (!impact && !redirected && ["rail", "saw", "force"].includes(b.kind)) {
        b.x = endX;
        b.y = endY;
      }
      if (b.kind === "grenade" && (b.x < -80 || b.x > W + 80 || b.y > H + 80))
        b.life = 0;
      if (
        (impact || b.life <= 0) &&
        ["rocket", "grenade", "plasma"].includes(b.kind)
      )
        this.explode(b);
      if (impact || b.life <= 0) expireSpecial(this, b);
      if (impact) b.life = 0;
    }
    this.projectiles = this.projectiles
      .filter(
        (b) =>
          b.life > 0 &&
          b.x > -200 &&
          b.x < W + 200 &&
          b.y > (b.kind === "grenade" ? -3600 : -300) &&
          b.y < H + 200,
      )
      .slice(-160);
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
        for (const s of this.platforms.filter((p) => p.hp !== 0))
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
      cover: this.cover,
      debris: this.debris,
      hazards: this.hazards,
      projectiles: this.projectiles,
      fields: this.fields,
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
      events: this.events,
    };
  }
}
