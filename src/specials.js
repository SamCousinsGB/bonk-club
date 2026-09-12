import { blackholeField, updateBlackhole, updateWreckage } from "./blackhole.js";
import { nuclearField, updateNuclear } from "./nuclear.js";
import { segmentBox } from "./collision.js";
import { breakable } from "./maps.js";
import { liftBubble, popBubble, steerBoomerang, igniteFighter } from "./weird-weapons.js";
import { harpoonImpact, fireworkBurst } from "./expanded-weapons.js";
import { TRANSMUTATIONS, rigidPose } from "./transmutation.js";
import { knockDown } from "./knockdown.js";
import { canSpawnProjectiles } from "./projectile-flight.js";

const clear = (world, a, b) =>
  !world.solids().some((s) => segmentBox(a.x, a.y, b.x, b.y, s));
export function steerSpecial(world, b, dt) {
  steerBoomerang(world, b, dt);
  if (b.homing) {
    const target = world.players
      .filter((p) => p.alive && p.id !== b.owner && clear(world, b, p))
      .sort(
        (a, c) =>
          Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y),
      )[0];
    if (target) {
      const current = Math.atan2(b.vy, b.vx),
        goal = Math.atan2(target.y - b.y, target.x - b.x);
      const delta = Math.atan2(
        Math.sin(goal - current),
        Math.cos(goal - current),
      );
      const angle = current + Math.max(-1.8 * dt, Math.min(1.8 * dt, delta));
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
    }
  }
  if (b.kind === "force") {
    for (const other of world.projectiles) {
      if (other === b || other.owner === b.owner || other.kind === "force")
        continue;
      if (
        Math.hypot(other.x - b.x, other.y - b.y) < 65 &&
        clear(world, b, other)
      ) {
        other.owner = b.owner;
        const angle = Math.atan2(b.vy, b.vx),
          speed = Math.max(600, Math.hypot(other.vx, other.vy));
        other.vx = Math.cos(angle) * speed;
        other.vy = Math.sin(angle) * speed;
      }
    }
  }
}

export function impactSpecial(world, b, target, hurt) {
  if (!hurt) return;
  if (TRANSMUTATIONS.includes(b.kind) && target.alive && !target.morphTime) {
    popBubble(world, target);
    if (!target.alive) return;
    knockDown(target, b.weapon);
    target.morph = b.kind; target.morphTime = 1.6; target.morphAge = 0;
    target.knockdown = 1.6;
    if (b.kind === "gold") target.morphPose = rigidPose(target.rig);
  }
  if (b.kind === "harpoon") harpoonImpact(world, b, target);
  if (b.burn) igniteFighter(target);
  if (b.kind === "bubble") liftBubble(world, target, b);
  if (b.chill) {
    target.burn = 0;
    target.chill = Math.max(target.chill || 0, b.chill);
    if(target.alive && !(target.freezeCooldown>0)) {
      if (target.morphTime > 0) {
        target.morph = null; target.morphTime = 0; target.morphAge = 0;
        target.knockdown = 0; delete target.morphPose;
      }
      target.freeze=1.15;target.freezeCooldown=2.1;target.stun=Math.max(target.stun,1.15);target.block=false;
      target.freezePose=target.rig?.map(q=>({x:q.x-target.x,y:q.y-target.y}));
    }
  }

}

export function expireSpecial(world, b) {
  if (b.weapon === "firework" && b.kind === "rocket") fireworkBurst(world, b);
  if (b.nuclear) {
    world.fields.push(nuclearField(world, b));
    world.fields = world.fields.slice(-12);
  }
  if (b.kind === "singularity") {
    world.fields.push(blackholeField(world,b));
    world.fields=world.fields.slice(-12);
  }
  if (b.cluster) {
    for (let n = 0; n < 6; n++) {
      if (!canSpawnProjectiles(world)) break;
      const a = -Math.PI + (n * Math.PI) / 5;
      world.projectiles.push({
        x: b.x,
        y: b.y - 8,
        vx: Math.cos(a) * 330,
        vy: Math.sin(a) * 400 - 220,
        owner: b.owner,
        kind: "grenade",
        weapon: "cluster",
        damage: 45,
        force: 1000,
        life: 0.4 + n * 0.055,
        radius: 150,
        r: 5,
        bounces: 0,
        hitIds: [],
      });
    }
  }
}

export function updateFields(world, dt) {
  for (const f of world.fields) {
    f.life -= dt;
    if (f.kind === "phaser") f.age += dt;
    if (f.kind === "shockwave") {
      updateNuclear(world, f, dt);
      continue;
    }
    if (f.kind === "blackhole") updateBlackhole(world,f,dt);
  }
  if(world.wreckage.length)updateWreckage(world,dt);
  world.fields = world.fields.filter((f) => f.life > 0).slice(-12);
}
