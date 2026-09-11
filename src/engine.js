import { hitCause } from "./victory.js";
import { objectInput, releaseObject, cleanCarriedObjects, carrySpeed } from "./object-carry.js";
import { trackKillSource } from "./kill-credit.js";
import { explosiveBarrel } from "./barrels.js";
import { resetReactions, updateReactions, propReactionDamage, inheritReaction, surfaceReaction,
  reactionContacts, contactReaction, explosionReaction } from "./reactions.js";
import { cryoBurst } from "./expanded-weapons.js";
import { bloodBurst, updateBlood, impale, spikeBase, updateImpaled } from "./gore.js";
import { prepareProp, propSolids, propFor, damageProp, contactProp, updateProps, bodyBounds } from "./props.js";
import { THROW_MASS, knockDown, moveKnocked } from "./knockdown.js";
import { updateTransformedDeath } from "./transmutation.js";
import { advanceFlight, projectileInArena, canSpawnProjectiles } from "./projectile-flight.js";
import { moveCaptured, bodyStrands, orbitBody } from "./singularity-body.js";
import { projectileEffect, deathPose, updateDeath, deathJoints } from "./death-effects.js";
import { carveRectangle } from "./nuclear.js";
import { NUCLEAR, updateParry, canParry, consumeParry, carryImpulse } from "./impact.js";
import { activeSlots } from "./slots.js";
import { cleanDifficulty } from "./bot-difficulty.js";
import { defaultProfile, availableProfile, randomBotProfile } from "./identity.js";
import { meleeAttack, updateMelee } from "./melee.js";
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
  projectileImpact,
} from "./arsenal.js";
export { WEAPONS } from "./arsenal.js";
import { preparePlatforms, carveExplosion } from "./terrain.js";
import { firePhaser } from "./phaser.js";
import { BURN_DAMAGE } from "./weird-weapons.js";
import { projectileMuzzle } from "./weapon-mount.js";
import { equipArena } from "./arena-traps.js";
import { CLASSIC_ARENAS } from "./classic-arenas.js";
import { NEW_ARENAS } from "./new-arenas.js";
import { SURVIVAL_ARENAS } from "./survival-arenas.js";
import { nearFixture } from "./arena-dressing.js";
import { BotController } from "./bots.js";
import { THEMED_ARENAS, breakable } from "./maps.js";
import { createHazards, updateHazards } from "./hazards.js";
import { SKYSCRAPERS } from "./skyscrapers.js";
import { segmentBox, playerBox } from "./collision.js";
import {
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
  JUMP_SPEED,
  AIR_JUMP_SPEED,
} from "./scale.js";
export { W, H } from "./scale.js";
export const STEP = 1 / 120;
export const COLORS = ["#55baff", "#f7d747", "#ff7393", "#81edb0"];
export const NAMES = ["BLUE", "YELLOW", "PINK", "MINT"];
export const ARENAS = [...[...CLASSIC_ARENAS, ...SKYSCRAPERS, ...THEMED_ARENAS, ...NEW_ARENAS].map(equipArena), ...SURVIVAL_ARENAS];
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
    difficulty = "easy",
    fillSolo = true,
  } = {}) {
    if (
      players.length < 1 ||
      players.length > 4 ||
      new Set(players).size !== players.length ||
      players.some((i) => !Number.isInteger(i) || i < 0 || i > 3)
    )
      throw new Error("Choose 1–4 distinct player slots.");
    this.ids = players.length === 1 && fillSolo ? [0, 1, 2, 3] : [...players];
    this.botIds = new Set(
      players.length === 1 && fillSolo
        ? this.ids.filter((id) => !players.includes(id))
        : bots,
    );
    this.occupants = [0, 0, 0, 0];
    this.profiles = {};
    this.weaponRotation = new WeaponRotation(random);
    this.difficulty = cleanDifficulty(difficulty);
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
    this.terrainSerial = 0;
    this.spikeTerrain = null;
    this.craters = [];
    this.craterSerial = 0;
    this.wreckage=[];this.rifts=[];this.wreckSerial=0;this.riftSerial=0;this.wreckDirty=false;this.warpActive=false;
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
    const positions = [...(this.arena.weapons || [])];
    // Shuffle locations as well as weapons: no slot owns the opening exotic.
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(this.random() * (i + 1)));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    this.drops = positions.map(([x, y], index) => {
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
    // Equal first pickup, equal distance and full ammunition for all four starts.
    const starter = ["blaster","smg","shotgun","burst"][(this.round-1)%4];
    this.drops.push(...this.arena.starterWeapons.map(([x,y])=>({x,y,type:starter,
      ammo:WEAPONS[starter].ammo,vx:0,vy:0,life:SUDDEN_DEATH})));
    this.chunks = []; this.chunkSerial = 0; this.propNavigationAt = 0; this.cargoSerial = 0;
    this.cover = (this.arena.cover || []).map((c, i) => prepareProp({
      ...c,
      id: "cover" + i,
      dx: 0,
      dy: 0,
    }));
    this.hazards = createHazards(this);
    for (const d of this.drops) Object.assign(d, this.pickupPosition(d));
    this.debris = [];
    this.hazards = createHazards(this);
    resetReactions(this);
    this.ragdolls = [];
    this.blood = [];
    this.phase = "countdown";
    this.phaseTime = 2.4;
    this.elapsed = 0;
    this.weaponTimer = this.arena.survival?.firstWeapon ?? 2;
    this.hitstop = 0;
    this.winner = null;
    this.lastDeathCause = null;
    this.victoryCause = null;
    this.events = [];
  }
  playerProfile(id) {
    if (!this.profiles[id]) {
      const others = this.ids.filter(other => other !== id)
        .map(other => this.profiles[other] || (!this.botIds.has(other) ? defaultProfile(other) : null))
        .filter(Boolean);
      this.profiles[id] = this.botIds.has(id)
        ? randomBotProfile(others, this.random)
        : defaultProfile(id);
    }
    return this.profiles[id];
  }
  makePlayer(id) {
    const [x, y] = this.arena.spawns[id];
    return {
      id,
      ...this.playerProfile(id),
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
      jumpBuffer: 0,
      throwHeld: false,
      carryId: null,
      pickupCooldown: 0,
      support: null,
      block: false,
      blockTime: 0,
      blockHeld: false,
      parryCooldown: 0,
      impactTime: 0,
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
      bubble: 0,
      morph: null, morphTime: 0, morphAge: 0,
      chill: 0,
      freeze:0, freezeCooldown:0, xray:0, xrayType:null, knockdown:0,
      weapon: null,
      ammo: 0,
      walk: 0,
      gaitSpeed: 0,
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
        // Keep each occupant's identity. A human colour choice only displaces
        // the conflicting bot, without taking another bot's existing colour.
        const reserved = this.players.filter(other => other.bot && other.id !== p.id)
          .map(other => this.profiles[other.id]);
        const profile = availableProfile(this.playerProfile(p.id), [...used, ...reserved]);
        this.profiles[p.id] = profile;
        used.push(profile);
      }
      Object.assign(p, this.profiles[p.id] || defaultProfile(p.id));
    }
  }
  syncSlots(slots, roster) {
    const active = activeSlots(slots, roster);
    const countBefore = this.players.length;
    for (const id of [...this.ids]) {
      if (active.some(p => p.id === id)) continue;
      if (this.players.find(p => p.id === id)?.alive) this.lastDeathCause = null;
      this.ids = this.ids.filter(n => n !== id);
      this.players = this.players.filter(p => p.id !== id);
      this.botIds.delete(id);
      this.ai.forget(id);
      this.scores[id] = 0;
      this.occupants[id]++;
      delete this.profiles[id];
      if (this.winner === id) this.winner = null;
    }
    for (const {id, bot} of active) {
      if (!this.ids.includes(id)) {
        this.ids.push(id);
        this.ids.sort((a, b) => a - b);
        // Use the same safe respawn path as replacing an eliminated bot.
        if (bot) this.botIds.delete(id); else this.botIds.add(id);
        const p = this.makePlayer(id);
        p.alive = this.phase !== "fight";
        this.players.push(p);
      }
      this.replacePlayer(id, bot);
    }
    this.players.sort((a, b) => a.id - b.id);
    if (countBefore < 2 && this.players.length >= 2) this.elapsed = 0;
    this.setProfiles(roster);
  }
  replacePlayer(id, bot) {
    if (!this.ids.includes(id) || this.botIds.has(id) === bot) return;
    if (bot) this.botIds.add(id);
    else this.botIds.delete(id);
    delete this.profiles[id];
    this.scores[id] = 0;
    this.occupants[id]++;
    this.ai.forget(id);
    const previous = this.players.find((p) => p.id === id);
    if (previous.carryId) releaseObject(this, previous);
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
      ...this.playerProfile(id),
      occupant: this.occupants[id],
      jumpHeld: false,
      jumpBuffer: 0,
      throwHeld: false,
      block: false,
      blockHeld: false,
      parryCooldown: 0,
    });
    if (this.phase === "result" && this.winner === id) this.winner = null;
  }
  event(type, data = {}) {
    this.events.push({ id: ++this.nextEvent, type, at: this.time, ...data });
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
    cleanCarriedObjects(this);
    this.updateCover(dt);
    updateReactions(this, dt);
    this.updateDebris(dt);
    updateBlood(this,dt);
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
    if (this.botIds.size) this.ai.prepare(this);
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
        this.weaponTimer = (this.arena.survival?.weaponInterval ?? 3) + this.random() * 2;
      }
    }
    const actions = new Map();
    for (const p of this.players) {
      if (!p.alive) continue;
      const input = objectInput(this, p, active ? cleanInput(inputs[p.id]) : emptyInput());
      actions.set(p.id, input);
      this.move(p, input, dt);
    }
    // Resolve defence before attacks so neither slot has a blocking-order advantage.
    for (const p of this.players) {
      if (!p.alive) continue;
      const i = actions.get(p.id);
      if (i.throw && !p.throwHeld && p.stun <= 0 && !p.freeze && !p.knockdown) this.throwWeapon(p);
      p.throwHeld = i.throw;
      if (!i.throw && p.cooldown <= 0 && p.stun <= 0 && !p.block && !p.freeze && !p.knockdown) {
        if (i.block && p.weapon && WEAPONS[p.weapon].alt) this.attack(p, true);
        else if (i.attack) this.attack(p);
      }
    }
    for (let a = 0; a < this.players.length; a++)
      for (let b = a + 1; b < this.players.length; b++)
        this.collidePlayers(this.players[a], this.players[b]);
    cleanCarriedObjects(this);
    for (const p of this.players)
      if (p.alive) updateRig(p, dt, this.solids(p), this.time);
    for (let a = 0; a < this.players.length; a++)
      for (let b = a + 1; b < this.players.length; b++)
        collideRigs(this.players[a], this.players[b]);
    for (const p of this.players)
      if (active && p.alive) updateMelee(this, p);
    updateFields(this, dt);
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    if (active) for (const p of this.players) if (p.alive) this.pickup(p);
    this.updateRagdolls(dt);
    if (active) updateHazards(this, dt);
    if (active) {
      for (const p of this.players) {
        if (!p.alive) continue;
        if (p.y > H + 100 || p.x < -130 || p.x > W + 130) this.kill(p, { cause: "fall" });
        for (const s of this.spikes()) impale(this,p,s);
        if (this.elapsed > SUDDEN_DEATH) {
          p.hp -= dt * 8;
          if (p.hp <= 0) this.kill(p, { cause: "sudden" });
        }
      }
      const alive = this.players.filter((p) => p.alive);
      const pendingBlast = this.cover.some(b=>b.hp>0&&explosiveBarrel(b)&&b.leak&&!b.spent) || this.gas.some(g=>g.lit>0) ||
        this.projectiles.some(b => (b.nuclear || b.kind === "singularity") && b.life > 0 && projectileInArena(b)) ||
        this.fields.some(f => ["shockwave","blackhole"].includes(f.kind) && f.life > 0);
      if (alive.length <= 1 && !pendingBlast && (this.players.length >= 2 || alive.length === 0)) {
        this.winner = alive[0]?.id ?? null;
        this.victoryCause = this.winner === null ? null : this.lastDeathCause;
        if (this.winner !== null) this.scores[this.winner]++;
        this.phase = "result";
        this.phaseTime = 2.8;
        this.event("round", { winner: this.winner });
      }
    }
    cleanCarriedObjects(this);
  }
  solids(carrier = null) {
    const solids = [], carryId = carrier?.carryId;
    for (const p of this.platforms) if (p.hp !== 0) solids.push(p);
    for (const bodies of [this.cover, this.chunks])
      for (const b of bodies) if (b.id !== carryId)
        for (const tile of propSolids(b)) solids.push(tile);
    for (const s of this.spikes()) solids.push(spikeBase(s));
    return solids;
  }
  movePlatforms() {
    for (const p of this.platforms) {
      if(p.wreckId)continue;
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
    const solids = this.solids(p);
    const boxBefore=playerBox(p);p.spikeY=boxBefore.y+boxBefore.h;
    const support = p.ground && solids.find((s) => s.id === p.support);
    if (support) {
      p.x += support.dx || 0;
      p.y += support.dy || 0;
      // Carry the physical pose with its support without adding a walking step
      // or fighting the platform's motion through the pose motors.
      for (const q of p.rig || []) {
        q.x += support.dx || 0; q.px += support.dx || 0;
        q.y += support.dy || 0; q.py += support.dy || 0;
      }
    }
    p.pickupCooldown = Math.max(0, p.pickupCooldown - dt);
    p.comboTime = Math.max(0, p.comboTime - dt);
    p.rush = Math.max(0, p.rush - dt);
    p.chill = Math.max(0, p.chill - dt);
    p.bubble = Math.max(0, (p.bubble || 0) - dt);
    if (p.morphTime > 0) {
      p.morphTime = Math.max(0, p.morphTime - dt);
      p.morphAge += dt;
      if (!p.morphTime) { p.morph = null; p.morphAge = 0; delete p.morphPose; }
    }
    p.freeze=Math.max(0,(p.freeze||0)-dt);
    p.freezeCooldown=Math.max(0,(p.freezeCooldown||0)-dt);
    p.xray=Math.max(0,(p.xray||0)-dt);
    if(p.freeze>0){i=emptyInput();i.duck=p.prone;p.stun=Math.max(p.stun,p.freeze);p.block=false;}
    if (p.burn > 0 && !this.prediction) {
      p.hp = Math.max(0, p.hp - BURN_DAMAGE * Math.min(dt, p.burn));
      p.burn = Math.max(0, p.burn - dt);
      if (!p.hp) { this.kill(p,{effect:"burn",ash:true}); return; }
    }
    if(p.knockdown>0){
      p.cooldown=Math.max(0,p.cooldown-dt);p.flash=Math.max(0,p.flash-dt);p.swing=0;p.block=false;
      if (moveCaptured(p,this,solids,dt)) return;
      moveKnocked(p,solids,dt);return;
    }
    if (p.ground) p.airLunge = false;
    const prone = !!i.duck;
    if (prone !== p.prone) {
      // Keep the feet fixed even when a hit has just cleared ground/support.
      // Growing downward from a prone airborne centre can start inside a floor,
      // beyond the incoming-side checks used by movement collision below.
      const y = p.y + (prone ? 20 : -20),
        radius = prone ? 34 : 15, bottom = prone ? 10 : 30, top = prone ? 10 : 28;
      // Validate the entire new body, including headroom and prone width.
      if (!solids.some(s => p.x + radius > s.x && p.x - radius < s.x + s.w &&
          y + bottom > s.y && y - top < s.y + s.h)) {
        p.y = y;
        p.prone = prone;
      }
    }
    const radius = p.prone ? 34 : 15,
      bottom = p.prone ? 10 : 30,
      top = p.prone ? 10 : 28;

    p.cooldown = Math.max(0, p.cooldown - dt);
    p.recoilTime = Math.max(0, p.recoilTime - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.swing = Math.max(0, p.swing - dt);
    if (p.weapon && p.ammo === 0 && p.swing === 0) p.weapon = null;
    p.flash = Math.max(0, p.flash - dt);
    p.impactTime = Math.max(0, (p.impactTime || 0) - dt);
    updateParry(p, i.block, dt);
    p.stamina = clamp(p.stamina + 25 * dt, 0, 100);
    const momentum = p.recoilTime > 0 || p.impactTime > 0 || p.rush > 0;
    p.coyote = p.ground ? 0.09 : Math.max(0, p.coyote - dt);
    p.jumpBuffer = i.jump && !p.jumpHeld ? 0.12 : Math.max(0, (p.jumpBuffer || 0) - dt);
    // Walking off a ledge uses the ground jump once the grace period expires.
    if (!p.ground && p.coyote <= 0 && p.jumps === 0) p.jumps = 1;
    const dir = Number(i.right) - Number(i.left);
    const sticky = p.ground && (p.glued > 0 || p.tarred > 0);
    const slippery = p.ground && p.oiled > 0;
    if (sticky) p.vx *= Math.exp(-dt * (p.glued > 0 ? 11 : 5));
    if (dir && p.stun <= 0) {
      p.facing = dir;
      const max =
        (p.prone ? CRAWL_SPEED : p.block ? GUARD_SPEED : RUN_SPEED) *
        (p.chill > 0 ? 0.58 : 1) * (sticky ? p.glued > 0 ? .25 : .5 : 1) * carrySpeed(this, p);
      const acceleration =
        (p.prone ? 400 : p.ground ? 1500 : 950) * (momentum ? 0.22 : 1) * (slippery ? .24 : 1);
      // Input approaches the run speed. External hit/recoil velocity can exceed it,
      // but holding a direction must never add more speed above that limit.
      if (p.vx * dir < max)
        p.vx += dir * Math.min(acceleration * dt, max - p.vx * dir);
      else
        p.vx +=
          (dir * max - p.vx) * Math.min(1, dt * (momentum ? 0.4 : slippery ? .3 : 3));
    } else if (p.ground)
      p.vx *= Math.pow(
        momentum ? 0.994 : slippery ? 0.998 : p.ice ? 0.985 : p.prone ? 0.984 : 0.86,
        dt * 120,
      );
    else p.vx *= Math.pow(0.996, dt * 120);
    if (p.jumpBuffer > 0 && p.stun <= 0 && (p.coyote > 0 || p.jumps < 2)) {
      p.vy = p.jumps === 0 ? -JUMP_SPEED : -AIR_JUMP_SPEED;
      p.jumps++;
      p.ground = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.support = null;
      this.event("jump", { x: p.x, y: p.y + 28, color: p.color });
    }
    p.jumpHeld = i.jump;
    p.aimAngle = i.aim === null ? (p.facing === 1 ? 0 : Math.PI) : i.aim;
    if (i.aim !== null && Math.abs(Math.cos(i.aim)) > 0.1)
      p.facing = Math.sign(Math.cos(i.aim));
    p.vy = p.bubble > 0
      ? p.vy + (-175 - p.vy) * Math.min(1, dt * 5)
      : Math.min(p.vy + 1800 * dt, 1150);
    const oldX = p.x,
      oldY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ground = false;
    p.support = null;
    p.ice = false;
    for (const s of solids) {
      const surfaceDy = support === s ? 0 : s.dy || 0;
      // Test the crossed top face before rejecting final-position overlap.
      // Thin floors can be crossed in one step, and rising lifts can catch a
      // fighter whose upward hit velocity is slower than the lift itself.
      const landing = oldY + bottom <= s.y - surfaceDy + 3 &&
        p.y + bottom > s.y && p.vy * dt >= surfaceDy;
      if (
        p.x + radius <= s.x ||
        p.x - radius >= s.x + s.w ||
        (!landing && (p.y + bottom <= s.y || p.y - top >= s.y + s.h))
      )
        continue;
      if (landing) {
        contactProp(this, p, s, 0, -1, dt);
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
        // Tiny edge catches should not cancel an otherwise clear jump.
        const leftOverlap = p.x + radius - s.x, rightOverlap = s.x + s.w - p.x + radius;
        const shift = leftOverlap <= 7 ? -leftOverlap - 0.1 : rightOverlap <= 7 ? rightOverlap + 0.1 : 0;
        if (shift && !solids.some(q => q !== s && p.x + shift + radius > q.x && p.x + shift - radius < q.x + q.w && p.y + bottom > q.y && p.y - top < q.y + q.h)) {
          p.x += shift;
          continue;
        }
        contactProp(this, p, s, 0, 1, dt);
        p.y = s.y + s.h + top;
        p.vy = Math.abs(p.vy) * 0.2;
      } else if (oldX < s.x) {
        contactProp(this, p, s, -1, 0, dt);
        p.x = s.x - radius;
        if (!propFor(this, s)) p.vx = -Math.abs(p.vx) * 0.25;
      } else if (oldX > s.x + s.w) {
        contactProp(this, p, s, 1, 0, dt);
        p.x = s.x + s.w + radius;
        if (!propFor(this, s)) p.vx = Math.abs(p.vx) * 0.25;
      } else if(s.wreckId || propFor(this, s)) {
        // A rotating chunk can sweep over a stationary body between ticks.
        // Resolve that overlap rather than trapping the fighter inside it.
        const exits=[p.x+radius-s.x,s.x+s.w-p.x+radius,p.y+bottom-s.y,s.y+s.h-p.y+top];
        const exit=exits.indexOf(Math.min(...exits));
        contactProp(this,p,s,exit===0?-1:exit===1?1:0,exit===2?-1:exit===3?1:0,dt);
        if(exit===0)p.x=s.x-radius;
        else if(exit===1)p.x=s.x+s.w+radius;
        else if(exit===2){p.y=s.y-bottom;p.vy=Math.min(0,p.vy);p.ground=true;p.support=s.id;}
        else {p.y=s.y+s.h+top;p.vy=Math.max(0,p.vy);}
      }
    }
    // Use actual travel after collision, excluding lifts, blocked motion and
    // airborne drift. Hits still move the body without making its legs pedal.
    const running = p.ground && !p.prone && !p.freeze && p.stun <= 0 && dir !== 0;
    const travel = running ? clamp(p.x - oldX, -RUN_SPEED * dt, RUN_SPEED * dt) : 0;
    const gait = Math.abs(travel) / Math.max(dt, 0.000001) / RUN_SPEED;
    p.gaitSpeed += (gait - p.gaitSpeed) * (1 - Math.exp(-dt * 18));
    p.walk += travel * Math.PI * 2 / 100;
  }
  collidePlayers(a, b) {
    if (
      !a.alive ||
      !b.alive ||
      a.knockdown > 0 || b.knockdown > 0 ||
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
    if(p.freeze>0||p.knockdown>0||p.carryId)return;
    if (p.weapon && p.ammo <= 0) return;
    const base = p.weapon ? WEAPONS[p.weapon] : { kind: "melee" };
    if (alternate && (!base.alt || p.ammo < base.alt.ammoCost)) return;
    const w = alternate ? { ...base, ...base.alt } : base;
    if (w.kind !== "melee" && w.kind !== "phaser" &&
        !canSpawnProjectiles(this, w.count || (w.kind === "pellet" ? 5 : 1))) return;
    if (w.proneOnly && (!p.prone || !p.ground)) return;
    const angle = p.aimAngle ?? (p.facing === 1 ? 0 : Math.PI),
      ax = Math.cos(angle),
      ay = Math.sin(angle);
    if (w.kind === "melee") {
      meleeAttack(this, p, w);
    } else {
      p.cooldown = w.cooldown;
      p.swing = w.kind === "phaser" ? w.life : 0.16;
      p.swingDuration = p.swing;
      p.meleeMove = "weapon";
      p.comboTime = 0;
      const count = w.count || (w.kind === "pellet" ? 5 : 1);
      const muzzle = projectileMuzzle(this, p, p.weapon, ax, ay);
      if (w.kind === "phaser" && !this.prediction) firePhaser(this, p, ax, ay);
      for (let n = 0; n < (w.kind === "phaser" || this.prediction ? 0 : count); n++) {
        const spread =
          count > 1
            ? (n - (count - 1) / 2) *
              (w.spread || (w.kind === "rocket" ? 0.18 : 0.12))
            : (this.random() - 0.5) * (w.spread || 0);
        this.projectiles.push(trackKillSource(this, {
          x: muzzle.x,
          y: muzzle.y,
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
            (w.kind === "grenade" ? 1.5 : 1),
          age: 0,
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
        }));
      }
      const recoil = firingRecoil(w, p);
      if (recoil >= 60)
        p.recoilTime = Math.max(
          p.recoilTime,
          Math.min(0.32, 0.12 + recoil / 2000),
        );
      const propel = (v, kick) => v + kick * (v * kick > 0 ? clamp(1 - Math.abs(v) / 1100, 0, 1) : 1);
      p.vx = propel(p.vx, -ax * recoil);
      p.vy = propel(p.vy, -ay * recoil);
      if (recoil > 0) carryImpulse(p, Math.min(0.42, 0.16 + recoil / 2000));
      impulseRig(
        p,
        p.x + ax * 25,
        p.y - 10 + ay * 25,
        -ax * recoil * 2,
        -ay * recoil * 2,
      );
      this.event("shoot", {
        x: muzzle.x,
        y: muzzle.y,
        kind: w.kind,
        weapon: p.weapon,
        heavy: recoil >= 250,
      });
    }
    if (p.weapon) {
      p.ammo -= w.ammoCost || 1;
      if (p.ammo <= 0) {
        // Keep the final melee swing or phase discharge visible until it finishes.
        if (!["melee", "phaser"].includes(w.kind)) p.weapon = null;
        p.ammo = 0;
      }
    }
  }
  hit(q, p, damage, force, dir, vertical = -0.5, options = {}) {
    if (!q.alive) return;
    if (q.weapon) q.block = false;
    if (!options.blast && canParry(q, p)) {
      consumeParry(q);
      p.vx = -dir * 880;
      p.vy = -440;
      p.stun = 0.32;
      p.comboTime = 0;
      p.rush = 0;
      if (p.id !== undefined) {
        carryImpulse(p, 0.35);
        impulseRig(p, p.x, p.y - 15, -dir * 900, -440);
      }
      q.cooldown = 0;
      this.hitstop = 0.055;
      this.event("parry", { x: (p.x + q.x) / 2, y: q.y - 10, color: q.color });
      return;
    }
    if (q.freeze>0 && options.effect !== "ice" && damage>=20) {
      damage*=1.5;q.freeze=0;options={...options,effect:"ice"};
    }
    if(["plasma","tesla","phaser"].includes(options.effect)){q.xray=.32;q.xrayType=options.effect;}
    if(options.execute)damage=Math.max(damage,q.hp*2);
    if (q.rush > 0 && !q.weapon && options.projectile) damage *= 0.65;
    q.hp = Math.max(0, q.hp - damage);
    if (q.bubble > 0 && damage >= 20) q.bubble = 0;
    if(["gib","slice"].includes(options.effect))bloodBurst(this,q.x,q.y-12,dir*force,vertical*force,q.hp?6:22);
    const knockback = dir * force * (1 + (100 - q.hp) / 220);
    // A following low-force pellet must not cancel a launch in the same direction.
    q.vx = force<=0 ? q.vx :
      q.vx * knockback > 0 && Math.abs(q.vx) > Math.abs(knockback)
        ? q.vx
        : knockback;
    if(force>0)q.vy = Math.min(q.vy, force * vertical);
    carryImpulse(q, options.blast ? 0.55 : 0.26);
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
    this.event("hit", {
      x: q.x, y: q.y - 10, color: q.color, force, damage,
      melee: !!options.melee, move: options.move || null,
      projectile: !!options.projectile, blast: !!options.blast, effect:options.effect||null,
    });
    if (q.hp <= 0) this.kill(q,{cause:hitCause(options),effect:options.execute?"slice":options.effect,
      ash:["plasma","tesla","phaser","burn"].includes(options.effect),angle:options.angle||0,sourceX:p.x,sourceY:p.y,source:options.source || p});
  }
  kill(p, {ash = false, sourceX = p.x, sourceY = p.y, effect = null, angle = 0, cause = null, source = null} = {}) {
    if (!p.alive) return;
    if (p.carryId) releaseObject(this, p);
    if (this.phase === "fight") this.lastDeathCause = cause || hitCause({ effect });
    p.alive = false;
    p.hp = 0;
    if (this.phase === "fight") this.onKill?.({ victim: p, source, cause: this.lastDeathCause });
    if (p.weapon && !ash && effect!=="singularity")
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
    if (ash) for (const q of points) {q.px = q.x; q.py = q.y;}
    this.ragdolls.push({
      points,
      color: p.color,
      hair: p.hair,
      hairColor: p.hairColor,
      facialHair: p.facialHair,
      accessory: p.accessory,
      facing: p.facing,
      life: ash ? NUCLEAR.ashDuration : 5,
      ...(ash ? {ash:true, ashAge:0, ashDirection:Math.sign(p.x-sourceX)||1} : {}),
    });
    deathPose(this.ragdolls.at(-1),effect,angle,{x:sourceX,y:sourceY});
    this.ragdolls = this.ragdolls.slice(-4);
    if(["gib","blast"].includes(effect))bloodBurst(this,p.x,p.y,p.vx,p.vy,28);
    this.event("ko", { x: p.x, y: p.y, color: p.color, ash, effect, at: this.time });
    this.ragdolls.at(-1).deathId = this.nextEvent;
  }
  pickup(p) {
    if (p.weapon || p.carryId || p.pickupCooldown > 0 || !p.alive || p.knockdown > 0) return;
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
    if (!p.weapon || !p.alive || p.knockdown || p.freeze) return;
    if (p.ammo <= 0) return;
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
    if (this.arena.survival) {
      if (this.drops.length || this.players.some(p => p.alive && p.weapon)) return;
      const candidates = this.platforms.filter(p => p.hp !== 0 && p.w > 80)
        .flatMap(p => [.25, .5, .75].map(f => ({ x: p.x + p.w * f, y: p.y - 30 })))
        .filter(q => q.x > 350 && q.x < 2200 && !this.solids().some(s => s.kind && s.hp > 0 &&
          q.x > s.x - 30 && q.x < s.x + s.w + 30 && q.y > s.y - 25 && q.y < s.y + s.h) &&
          !this.hazards.some(h => !h.done && h.type === "crusher" && Math.abs(q.x - h.x) < h.w / 2 + 30) &&
          !this.players.some(p => p.alive && Math.hypot(p.x - q.x, p.y - q.y) < 130));
      if (!candidates.length) return;
      const point = candidates[Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length))];
      const type = ["bat", "blaster", "sword", "smg"][(this.round - 1 + Math.floor(this.random() * 4)) % 4];
      this.drops.push({ ...point, type, ammo: Math.max(1, Math.ceil(WEAPONS[type].ammo * .45)), vx: 0, vy: 0, life: 25 });
      return;
    }
    if (this.drops.length >= 12) return;
    const platforms = this.platforms.filter((p) => p.hp !== 0 && p.w >= 90);
    // Prefer accessible, unoccupied landings near the current fight. Avoid
    // repeatedly piling weapons on a single ledge or abandoned rooftop.
    const living = this.players.filter(p => p.alive);
    const ranked = platforms.flatMap(s => {
      const point=this.pickupPosition({x:s.x+s.w/2,y:s.y-30},true);
      if(!point)return [];
      const distances=living.map(p=>Math.hypot(p.x-point.x,p.y-point.y)).sort((a,b)=>a-b);
      // Reinforcements should be contestable, with no pickup placed in a hand.
      if(distances[0]<130)return [];
      return [{point,cost:(distances[0]||1500)+Math.abs((distances[1]||distances[0])-distances[0])*.45+
        this.drops.filter(d=>Math.hypot(d.x-point.x,d.y-point.y)<220).length*900+this.random()*450}];
    }).sort((a,b)=>a.cost-b.cost);
    const point=ranked[0]?.point;
    if (!point) return;
    const type = chooseWeapon(
      this.random,
      new Set(this.drops.map((d) => d.type)),
    );
    // Spawn within the chosen storey instead of falling onto the roof above it.
    this.drops.push({
      ...point,
      vx: 0,
      vy: 0,
      type,
      ammo: WEAPONS[type].ammo,
      life: 60,
    });
  }
  pickupPosition(point, requireSafe=false) {
    const surface = this.platforms.filter(s => s.hp !== 0 && point.x >= s.x && point.x <= s.x+s.w && s.y >= point.y)
      .sort((a,b) => a.y-b.y)[0];
    if (!surface) return requireSafe?null:{x:point.x,y:point.y};
    const options = [point.x, surface.x+25, surface.x+surface.w-25, surface.x+surface.w*.35, surface.x+surface.w*.65];
    for (const x of options) {
      const y=surface.y-30;
      if (![x-18,x+18].every(xx=>this.platforms.some(s=>s.hp!==0&&Math.abs(s.y-surface.y)<.5&&xx>=s.x&&xx<=s.x+s.w))) continue;
      if (nearFixture(x,y,this.hazards||this.arena.traps,45)) continue;
      if (this.solids().some(s => s !== surface && x+18 > s.x && x-18 < s.x+s.w && y+12 > s.y && y-18 < s.y+s.h)) continue;
      if (this.drops?.some(d => d !== point && Math.hypot(d.x-x,d.y-y)<70)) continue;
      return {x,y};
    }
    return requireSafe?null:{x:point.x,y:point.y};
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
        if (p) {
          const hp=p.hp,mass=THROW_MASS[d.type]||1;
          this.hit(p, { x, y, vx: 0, vy: 0 }, 22, 360+mass*180, Math.sign(d.vx) || 1,-.35, { cause: "thrown" });
          if(p.alive&&p.hp<hp)knockDown(p,d.type);
        }
        if (breakable(s) && d.armed) {
          const mass = THROW_MASS[d.type] || 1;
          this.damageCover(s, 26 + mass * 5, d.vx * mass / 3, d.vy * mass / 3, {x:d.x,y:d.y});
        }
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
  damageCover(c, damage, vx = 0, vy = 0, point) {
    if (!breakable(c) || c.hp <= 0) return;
    const body = propFor(this, c);
    if (body) { damageProp(this, body, damage, vx, vy, point); return; }
    if(c.wreckId){
      const w=this.wreckage.find(w=>w.id===c.wreckId);if(!w)return;
      w.hp=Math.max(0,w.hp-damage);this.wreckDirty=true;
      for(const p of this.platforms)if(p.wreckId===w.id)p.hp=w.hp;
      this.event(w.hp?"coverhit":"break",{x:w.x,y:w.y,color:"#9d94bc"});
      if(!w.hp)this.terrainVersion++;
      return;
    }
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
  reactPropDamage(b, damage) { return propReactionDamage(this, b, damage); }
  inheritPropReaction(parent, child) { inheritReaction(parent, child); }
  updateCover(dt) {
    updateProps(this, dt);
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
    explosionReaction(this, b);
    if (b.weapon === "cryo") {
      cryoBurst(this, b, impactSpecial);
      return;
    }
    if (b.nuclear) {
      this.event("explosion", {x:b.x, y:b.y, radius:NUCLEAR.coreRadius, nuclear:true});
      return; // The expanding flash handles destruction and skeletal deaths.
    }
    const radius = b.radius || 145;
    // Cover present at detonation absorbs this blast, even if the blast breaks it.
    const cover = [...this.cover, ...this.chunks].filter(c => c.hp > 0);
    const shielding = this.cover.flatMap(propSolids);
    const solidWalls = this.platforms.filter(p => p.hp !== 0);
    for (const p of this.players) {
      if (!p.alive) continue;
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      const walls = solidWalls.some((s) => segmentBox(b.x, b.y, p.x, p.y, s));
      if (dist >= radius || walls) continue;
      const shield = shielding.some((s) => segmentBox(b.x, b.y, p.x, p.y, s));
      const scale = (1 - dist / (radius * 1.32)) * (shield ? 0.12 : 1);
      this.hit(
        p,
        { x: b.x, y: b.y, vx: 0, vy: 0, stun: 0 },
        b.damage * scale,
        b.force * scale,
        Math.sign(p.x - b.x) || 1,
        -0.7,
        { blast: true, hitstop: 0.018, effect:projectileEffect(b), weapon: b.weapon, source: b,
          cause: ["canister", "gas"].includes(b.weapon) ? "gas" : undefined },
      );
    }
    for (const c of cover) {
      const box = propFor(this,c) ? bodyBounds(c) : c;
      const x = clamp(b.x, box.x, box.x + box.w),
        y = clamp(b.y, box.y, box.y + box.h);
      if (
        Math.hypot(b.x - x, b.y - y) < radius &&
        !solidWalls.some((s) => segmentBox(b.x, b.y, x, y, s))
      )
        this.damageCover(
          c,
          b.damage * 1.7 * (1 - Math.hypot(b.x-x,b.y-y) / (radius * 1.3)),
          ((c.x+c.w/2-b.x) / (Math.hypot(c.x+c.w/2-b.x,c.y+c.h/2-b.y)||1)) * b.force,
          ((c.y+c.h/2-b.y) / (Math.hypot(c.x+c.w/2-b.x,c.y+c.h/2-b.y)||1) - .3) * b.force,
          {x,y},
        );
    }
    carveExplosion(this, { x: b.x, y: b.y, radius });
    this.event("explosion", { x: b.x, y: b.y, radius, weapon: b.weapon, nuclear: !!b.nuclear, aftershock: !!b.aftershock });
  }
  updateProjectiles(dt) {
    for (const b of [...this.projectiles]) {
      if (b.life <= 0) continue;
      advanceFlight(b, dt);
      steerSpecial(this, b, dt);
      if (b.life <= 0 && b.kind === "boomerang") continue;
      const x = b.x,
        y = b.y;
      b.px = x;
      b.py = y;
      if (!projectileInArena(b) && !b.homing && !["grenade","duck","boomerang"].includes(b.kind)) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.travelled = (b.travelled || 0) + Math.hypot(b.vx,b.vy) * dt;
        continue;
      }
      if (b.kind === "grenade") b.vy += 1100 * dt;
      if (b.kind === "duck") b.vy += 380 * dt;
      const endX = x + b.vx * dt,
        endY = y + b.vy * dt;
      const collisions = this.solids().map((s) => ({
        s,
        hit: segmentBox(x, y, endX, endY, s, b.r),
      }));
      collisions.push(...reactionContacts(this, b, x, y, endX, endY));
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
        if (collision.reaction) {
          if (contactReaction(this, b, collision)) { impact = true; break; }
          continue;
        }
        if (s) {
          surfaceReaction(this, b, s);
          if (breakable(s) && !b.nuclear && b.kind !== "rocket") {
            const speed = Math.hypot(b.vx,b.vy) || 1;
            // A grenade bumps furniture on contact; its explosive damage belongs
            // to the fuse. Ordinary shots use their impact force, not tracer speed.
            const push = b.kind === "grenade" ? speed * .06 : (b.force || 200) * .35;
            this.damageCover(
              s,
              b.kind === "grenade" ? 0 : b.kind === "rail" ? 180 : b.damage,
              b.vx / speed * push,
              b.vy / speed * push,
              {x: b.x, y: b.y},
            );
            if (["rail", "saw", "bolt"].includes(b.kind) && s.hp <= 0) continue;
          }
          if (
            b.kind === "grenade" ||
            (["plasma", "ricochet", "saw", "boomerang", "duck"].includes(b.kind) && b.bounces > 0)
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
        if (["rocket", "plasma", "singularity", "duck"].includes(b.kind)) {
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
        if (canParry(p, source)) {
          consumeParry(p);
          b.owner = p.id;
          trackKillSource(this, b, null, true);
          b.vx *= -1;
          b.vy *= -1;
          b.hitIds = [];
          b.x = p.x + p.facing * ((p.prone ? 34 : 18) + b.r + 2);
          this.event("parry", { x: p.x, y: p.y, color: p.color });
          redirected = true;
          break;
        }
        const hp = p.hp;
        const impactPower = projectileImpact(b,(b.travelled || 0)+Math.hypot(b.x-x,b.y-y));
        this.hit(
          p,
          source,
          impactPower.damage,
          impactPower.force,
          Math.sign(b.vx) || 0.1,
          Math.sin(Math.atan2(b.vy, b.vx)) * 0.5 - 0.3,
          {
            projectile: true, weapon: b.weapon, effect:projectileEffect(b),execute:["rail","saw"].includes(b.kind),angle:Math.atan2(b.vy,b.vx),source:b,
            stun: ["flame", "frost"].includes(b.kind)
              ? 0.015
              : (WEAPONS[b.weapon]?.cooldown || 1) < 0.2
                ? 0.055
                : undefined,
            hitstop: (WEAPONS[b.weapon]?.cooldown || 1) < 0.2 ? 0.008 : undefined,
          },
        );
        impactSpecial(this, b, p, p.hp < hp);
        if (["rail", "saw", "force", "boomerang", "bolt"].includes(b.kind)) {
          (b.hitIds ||= []).push(p.id);
          continue;
        }
        impact = true;
        break;
      }
      // Non-blocking fuel contacts and piercing hits must not shorten flight.
      if (!impact && !redirected) {
        b.x = endX;
        b.y = endY;
      }
      b.travelled = (b.travelled || 0) + Math.hypot(b.x-x,b.y-y);
      if (
        (impact || b.life <= 0) &&
        ["rocket", "grenade", "plasma", "duck"].includes(b.kind)
      )
        this.explode(b);
      if (impact || b.life <= 0) expireSpecial(this, b);
      if (impact) b.life = 0;
    }
    this.projectiles = this.projectiles.filter(b => b.life > 0);
  }
  updateRagdolls(dt) {
    for (const rag of this.ragdolls) {
      rag.life -= dt;
      if (rag.capturedBy) {
        const f = this.fields.find(f => f.kind === "blackhole" && f.riftId === rag.capturedBy && f.life > 0);
        if (f) {
          rag.strands ||= bodyStrands(rag.points);
          rag.effect = "singularity"; rag.deathAge = Math.min(5.9, (rag.deathAge || 0) + dt);
          delete rag.ash; delete rag.anchor;
          // Sliced bodies may have two extra cut points, outside the intact skeleton.
          rag.points = rag.points.slice(0,11);
          orbitBody(rag.strands, f, this.solids(), dt, f.life < 1.1 ? 5 : .7);
          continue;
        }
        delete rag.capturedBy;
      }
      if(updateDeath(rag,dt))continue;
      if(updateTransformedDeath(rag,this.solids(),dt))continue;
      if(rag.effect==="impale"&&updateImpaled(this,rag,dt))continue;
      if (rag.ash) {
        rag.ashAge += dt;
        if (rag.ashAge < .6) continue;
      }
      for (const p of rag.points) {
        const vx = (p.x - p.px) * 0.993,
          vy = (p.y - p.py) * 0.993;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + (rag.ash ? 150 : rag.effect === "ice" ? 320 : 1800) * dt * dt;
      }
      for (let k = 0; k < 4; k++)
        for (const [a, b, len] of deathJoints(rag)) {
          const p = rag.points[a],
            q = rag.points[b],
            dx = q.x - p.x,
            dy = q.y - p.y,
            d = Math.hypot(dx, dy) || 1,
            f = ((d - len) / d) * (rag.ash ? Math.max(0, 1.1 - rag.ashAge) * .3 : .5);
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
  spikes() {
    let spikes = this.spikeTerrain || this.arena.spikes;
    for (const f of [...this.craters.filter(f=>this.time-f.born>=NUCLEAR.meltAt),...this.rifts]) {
      spikes = spikes.flatMap(s => carveRectangle({...s,h:.5},f));
    }
    return spikes;
  }
  snapshot() {
    cleanCarriedObjects(this);
    return {
      players: this.players,
      platforms: this.platforms,
      spikes: this.spikes(),
      cover: this.cover,
      debris: this.debris,
      chunks: this.chunks,
      hazards: this.hazards,
      water: this.water,
      gas: this.gas,
      spills: this.spills,
      projectiles: this.projectiles.filter(projectileInArena),
      fields: this.fields,
      craters: this.craters,
      wreckage:this.wreckage, rifts:this.rifts, blood:this.blood,
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
      victoryCause: this.victoryCause,
      events: this.events,
    };
  }
}
