import { segmentBox, playerBox } from "./collision.js";
import { trackKillSource } from "./kill-credit.js";

export const BUBBLE_TIME = 2.4;
export const BUBBLE_POP_DAMAGE = 32;
// Retain the projectile's original occupant credit without sending references
// to guests or retaining departed fighters after their bubble has gone.
const bubbleSources = new WeakMap();
export function liftBubble(world, p, shot) {
  if (!p.alive || p.bubble > 0) return;
  bubbleSources.set(p, trackKillSource(world, shot));
  p.bubble = BUBBLE_TIME; p.ground = false; p.support = null;
  p.vy = Math.min(p.vy, -110);
}
export function popBubble(world, p) {
  if (!(p.bubble > 0)) return false;
  p.bubble = 0;
  const source = bubbleSources.get(p);
  bubbleSources.delete(p);
  if (world.prediction || !p.alive) return false;
  // The fighter is already inside the bubble: parry, armour-like rush damage
  // reduction and frozen-hit multipliers do not change this single pressure hit.
  p.hp = Math.max(0, p.hp - BUBBLE_POP_DAMAGE);
  p.flash = .15;
  world.hitstop = Math.max(world.hitstop, .035);
  world.event("hit", { x: p.x, y: p.y - 8, color: p.color,
    force: 0, damage: BUBBLE_POP_DAMAGE, effect: "bubble", at: world.time });
  if (!p.hp) world.kill(p, { effect: "bubble", source });
  return true;
}
export const BURN_DAMAGE = 18;
export const BURN_DURATION = 3;
export function igniteFighter(p) {
  if (p.alive && !(p.soaked > 0) && !(p.cold > 0) && !(p.freeze > 0)) p.burn = BURN_DURATION;
}

const RAZORANG_HUNT_TIME = .6;
const RAZORANG_SPEED = 820;

function clearRazorangPath(world, b, target) {
  return !world.solids().some(s => segmentBox(b.x, b.y, target.x, target.y - 10, s, b.r));
}

function razorangTarget(world, b) {
  return world.players
    .filter(p => p.alive && p.id !== b.owner && !b.hitIds?.includes(p.id) && clearRazorangPath(world, b, p))
    .sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y) || a.id - c.id)[0];
}

function turnRazorang(b, target, dt, turnRate) {
  const current = Math.atan2(b.vy, b.vx);
  const goal = Math.atan2(target.y - 10 - b.y, target.x - b.x);
  const delta = Math.atan2(Math.sin(goal - current), Math.cos(goal - current));
  const angle = current + Math.max(-turnRate * dt, Math.min(turnRate * dt, delta));
  b.vx = Math.cos(angle) * RAZORANG_SPEED;
  b.vy = Math.sin(angle) * RAZORANG_SPEED;
}

export function steerBoomerang(world, b, dt) {
  if (b.kind !== "boomerang") return;
  const owner = world.players.find(p => p.id === b.owner && p.alive);
  if (!owner) return;
  if ((b.age || 0) < RAZORANG_HUNT_TIME) {
    const target = razorangTarget(world, b);
    if (target) turnRazorang(b, target, dt, 5.6);
    return;
  }
  if (!b.returning) { b.returning = true; b.hitIds = []; }
  turnRazorang(b, owner, dt, 10);
  if (b.age > .75 && segmentBox(b.x, b.y, b.x + b.vx * dt, b.y + b.vy * dt, playerBox(owner), b.r)) {
    b.life = 0;
    world.event("pickup", { x: owner.x, y: owner.y - 10, color: owner.color });
  }
}
