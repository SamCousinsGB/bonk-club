import { BOT_DIFFICULTIES, cleanDifficulty, combatPerception } from "./bot-difficulty.js";
import { WEAPONS, COMBO, firingRecoil } from "./arsenal.js";
import { segmentBox } from "./collision.js";
import { W, H, RUN_SPEED } from "./scale.js";
import { breakable } from "./maps.js";
import { dangerous, hazardZone } from "./hazards.js";
import { grenadePlan } from "./ballistics.js";
import {
  navigationSteps,
  traceFlight,
  predictedSurface,
  routesFrom,
  surfaceAt,
  steer,
  clamp,
  distance,
} from "./navigation.js";
export { navigation } from "./navigation.js";

const idle = () => ({
  left: false,
  right: false,
  jump: false,
  attack: false,
  block: false,
  throw: false,
  duck: false,
  aim: null,
});
// Use the projectile's useful travel distance, rather than the old close-range
// preference, to decide whether a bot can engage across a broken arena.
function engagementRange(w) {
  if (["melee", "grenade", "flame", "force"].includes(w.kind)) return w.range;
  if (w.kind === "singularity") return w.speed * w.life + w.radius * 0.75;
  const life = w.life || (w.kind === "rail" ? 0.8 : 4.5);
  return Math.min(W, w.speed * life, Math.max(w.range || 1100, w.speed * 2));
}
const weapons = Object.fromEntries(Object.entries(WEAPONS).map(([type,w])=>[type,{
  range:engagementRange(w), speed:w.kind === "melee" ? undefined : w.speed,
  value:{common:5,uncommon:7,rare:9,exotic:11}[w.rarity], damage:w.damage,
  recoil:firingRecoil(w,{prone:!!w.proneOnly,ground:true}),
  blast:["rocket","grenade","plasma"].includes(w.kind)?w.radius||145:0,
  singularity:w.kind === "singularity",
}]));
const fists = { range: 92, value: 3, damage: 25 };
const center = (s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
function walkingSpan(here,solids) {
  if(!here)return null;
  let left=here.x,right=here.x+here.w,changed=true;
  while(changed){changed=false;for(const s of solids){
    if(Math.abs(s.y-here.y)>3||s.x>right+4||s.x+s.w<left-4)continue;
    const a=Math.min(left,s.x),b=Math.max(right,s.x+s.w);
    if(a!==left||b!==right){left=a;right=b;changed=true;}
  }}
  return {x:left,w:right-left};
}
function firstObstacle(solids, p, point) {
  return solids
    .map((s) => ({ s, hit: segmentBox(p.x, p.y - 10, point.x, point.y, s) }))
    .filter((o) => o.hit)
    .sort((a, b) => a.hit.t - b.hit.t)[0]?.s;
}
function intercept(p, q, speed) {
  const dx = q.x - p.x,
    dy = q.y - p.y,
    vx = q.vx,
    vy = q.ground ? 0 : q.vy * 0.55;
  const a = vx * vx + vy * vy - speed * speed,
    b = 2 * (dx * vx + dy * vy),
    c = dx * dx + dy * dy;
  const disc = b * b - 4 * a * c;
  let t = distance(p, q) / speed;
  if (disc >= 0 && Math.abs(a) > 1) {
    const roots = [
      (-b - Math.sqrt(disc)) / (2 * a),
      (-b + Math.sqrt(disc)) / (2 * a),
    ].filter((n) => n > 0);
    if (roots.length) t = Math.min(...roots);
  }
  t = clamp(t, 0, 0.75);
  return { x: clamp(q.x + vx * t, 20, W - 20), y: q.y - 10 + vy * t };
}
export class BotController {
  constructor() {
    this.reset();
  }
  reset() {
    this.bots = new Map();
    this.navigationCache = new Map();
    this.graph = null;
    this.pendingNavigation = null;
    this.navigationAt = -1;
    this.rebuildAt = 0;
    this.revision = -1;
  }
  forget(id) {
    this.bots.delete(id);
  }
  prepare(world) {
    if (this.navigationAt === world.time) return;
    this.navigationAt = world.time;
    if (!world.players.some(p=>p.bot && p.alive)) {
      this.pendingNavigation = null;
      return;
    }
    if (
      !this.graph ||
      (!this.pendingNavigation && world.time >= this.rebuildAt) ||
      (this.revision !== world.terrainVersion &&
        world.time > this.builtAt + 0.15)
    ) {
      const solids=world.solids().map(s=>({...s}));
      this.pendingNavigation = navigationSteps(solids, {
        time: world.time,
        spikes: world.spikes(),
        cache: this.navigationCache,
        // A torn floor has hundreds of collision strips. Yield between flight
        // traces so rebuilding its routes cannot monopolize a simulation tick.
        batchSize: world.wreckage.some(w => w.hp > 0) ? 24 : Infinity,
      });
      this.builtAt = world.time;
      this.rebuildAt = world.time + 1.5;
      this.revision = world.terrainVersion;
      this.graph ||= new Map();
      const ids=new Set(solids.map(s=>s.id));
      for(const id of this.graph.keys()) if(!ids.has(id)) this.graph.delete(id);
    }
    // One landing per tick, including the countdown. Keep the previous routes
    // usable while rebuilding; execution still checks each actual takeoff.
    if(this.pendingNavigation) {
      const next=this.pendingNavigation.next();
      if(next.done) this.pendingNavigation=null;
      else if(next.value) this.graph.set(...next.value);
    }
  }
  inputs(world, dt) {
    this.prepare(world);
    if (!world.players.some(p=>p.bot && p.alive)) return {};
    const solids = world.solids();
    const inputs = {};
    for (const p of world.players)
      if (p.bot && p.alive) {
        let b = this.bots.get(p.id);
        if (!b || b.occupant !== p.occupant) {
          b = {
            occupant: p.occupant,
            think: 0,
            input: idle(),
            flight: null,
            failures: new Map(),
            target: null,
            targetUntil: 0,
            last: { x: p.x, y: p.y },
            stuck: 0,
            maneuverAt: 0,
            crouchUntil: 0,
            duckAgainAt: 0,
            parryAt: 0,
            visits: new Map(),
            support: null,
          };
          this.bots.set(p.id, b);
        }
        const here = surfaceAt(solids, p);
        if (p.ground && here?.id !== b.support) {
          b.support = here?.id;
          b.visits.set(b.support, (b.visits.get(b.support) || 0) + 1);
        }
        if (b.flight) {
          const age = world.time - b.flight.started;
          b.flight.airborne ||= !p.ground;
          if (
            (b.flight.airborne && age > 0.15 && p.ground) ||
            age > b.flight.duration + 0.3 ||
            p.stun > 0.15
          ) {
            if (p.stun <= 0.15 && here?.id !== b.flight.to)
              b.failures.set(b.flight.key, world.time + 9);
            b.flight = null;
            b.think = 0;
          }
        }
        b.think -= dt;
        if (b.think <= 0) {
          b.think = 0.08 + p.id * 0.006;
          b.stuck = distance(p, b.last) < 3 ? b.stuck + b.think : 0;
          b.last = { x: p.x, y: p.y };
          for (const [key, expiry] of b.failures)
            if (expiry < world.time) b.failures.delete(key);
          b.input = this.decide(world, p, b, solids, here);
        }
        const i = { ...b.input, jump: false };
        if (b.flight) {
          const f = b.flight,
            age = world.time - f.started;
          i.left = f.dir < 0;
          i.right = f.dir > 0;
          if (f.landingX != null && age >= f.clearAt)
            Object.assign(i, steer(p, f.landingX));
          else if (age > f.duration - 0.1) Object.assign(i, steer(p, f.endX));
          i.jump =
            f.jumps > 0 &&
            (age < 0.04 ||
              (f.jumps === 2 && age >= f.secondAt && age < f.secondAt + 0.045));
          // Recoil and crouching change the planned trajectory; shoot after landing.
          i.attack = false;
          i.block = false;
          i.duck = false;
        } else if (b.input.jump) {
          i.jump = !p.jumpHeld;
          b.input.jump = false;
        }
        inputs[p.id] = i;
      }
    return inputs;
  }
  decide(world, p, b, solids, here) {
    const i = idle(),
      weapon = weapons[p.weapon] || {
        ...fists,
        range: COMBO[p.comboTime > 0 ? p.comboStep : 0].range,
      };
    const melee = !p.weapon || WEAPONS[p.weapon]?.kind === "melee";
    const footing = walkingSpan(here,solids);
    const paths = routesFrom(
      this.graph,
      solids,
      here,
      p.x,
      b.failures,
      world.time,
      world.hazards,
    );
    const choices = world.players
      .filter((q) => q.alive && q.id !== p.id)
      .map((q) => {
        const floor = surfaceAt(solids, q),
          path = floor && paths.get(floor.id);
        const visible = !firstObstacle(solids, p, { x: q.x, y: q.y - 10 });
        return {
          q,
          floor,
          path,
          score:
            (path ? path.cost : visible ? distance(p, q) / RUN_SPEED : 30) +
            distance(p, q) / 1400 +
            q.hp / 120 -
            Math.min(1.5, (world.scores[q.id] || 0) * 0.04),
        };
      })
      .sort((a, b) => a.score - b.score);
    if (!choices.length) return i;
    const previous = choices.find((c) => c.q.id === b.target);
    const choice =
      previous &&
      world.time < b.targetUntil &&
      previous.score < choices[0].score + 2
        ? previous
        : choices[0];
    if (choice.q.id !== b.target) {
      b.target = choice.q.id;
      b.targetUntil = world.time + 0.7;
    }
    const enemy = choice.q,
      range = distance(p, enemy);
    if (b.watchedTarget !== enemy.id || enemy.hp < b.watchedHp) b.progressAt = world.time;
    b.watchedTarget = enemy.id;
    b.watchedHp = enemy.hp;
    b.progressAt ??= world.time;
    const staleAttack = world.time - b.progressAt > 2.5;
    if (b.approachTarget !== enemy.id || !staleAttack || range < b.bestRange - 80) {
      b.approachTarget = enemy.id;
      b.bestRange = range;
      b.approachAt = world.time;
      b.recoveryAttempts = 0;
    }
    const grenade = WEAPONS[p.weapon]?.kind === "grenade";
    const skill = BOT_DIFFICULTIES[cleanDifficulty(world.difficulty)];
    const perception = combatPerception(b, enemy, p.weapon, world.time, world.random, world.difficulty);
    const aim = weapon.speed
      ? intercept(p, perception.enemy, weapon.speed)
      : { x: enemy.x, y: enemy.y - 10 };
    i.aim = Math.atan2(aim.y - (p.y - 10), aim.x - p.x);
    const obstacle = firstObstacle(solids, p, { x: enemy.x, y: enemy.y - 10 });
    i.attack =
      range < weapon.range &&
      (!obstacle || breakable(obstacle)) &&
      (!weapon.blast || range > weapon.blast + 90) &&
      (!weapon.singularity || range > 300);
    let clearing = !!obstacle && breakable(obstacle);
    if (obstacle && breakable(obstacle))
      i.aim = Math.atan2(
        center(obstacle).y - (p.y - 10),
        clamp(enemy.x, obstacle.x + 8, obstacle.x + obstacle.w - 8) - p.x,
      );
    if (
      weapon.blast &&
      obstacle &&
      distance(p, center(obstacle)) < weapon.blast + 100
    )
      i.attack = false;
    // Reposition for recoil initially, but never veto the shot indefinitely on
    // an island too narrow for the preferred firing stance.
    if (weapon.recoil && footing && p.ground && range > 175 && !staleAttack) {
      const recoilX = p.x - Math.cos(i.aim) * weapon.recoil * 0.38;
      if (recoilX < footing.x + 18 || recoilX > footing.x + footing.w - 18)
        i.attack = false;
    }
    if (weapon.blast && range < 150 && !obstacle) i.throw = true;
    if (grenade) {
      const saved = b.grenade;
      if (
        !saved ||
        saved.type !== p.weapon ||
        saved.target !== enemy.id ||
        world.time > saved.until ||
        distance(p, saved) > 35 ||
        saved.revision !== world.terrainVersion
      ) {
        b.grenade = {
          x: p.x,
          y: p.y,
          type: p.weapon,
          target: enemy.id,
          until: world.time + 0.4,
          revision: world.terrainVersion,
          plan: grenadePlan(p, enemy, WEAPONS[p.weapon], solids),
        };
      }
      i.attack = !!b.grenade.plan;
      if (i.attack) i.aim = b.grenade.plan.angle;
    }
    if (weapon.singularity) {
      // The orb arms a pulling field at impact or expiry. Its field radius is
      // useful reach, not an instant explosion requiring 710 units of clearance.
      const definition = WEAPONS[p.weapon];
      const hit = obstacle && segmentBox(p.x, p.y - 10, enemy.x, enemy.y - 10, obstacle, 10);
      const travel = Math.min(range * (hit?.t ?? 1), definition.speed * definition.life);
      i.attack = travel > 300 && range - travel < definition.radius * 0.75;
      i.aim = Math.atan2(aim.y - (p.y - 10), aim.x - p.x);
      // Retain the normal reaction delay even when deploying against a wall.
      clearing = false;
    }

    let goal = enemy,
      destination = choice.floor,
      path = choice.path;
    // Commit to a useful, reachable pickup; avoid repeatedly swapping similar weapons.
    if ((range > (melee ? 240 : 220) || Math.abs(enemy.y-p.y)>100) && !b.flight) {
      const upgrades = world.drops
        .filter(
          (d) =>
            !d.armed &&
            !(d.lock > 0) &&
            !(d.owner === p.id && d.ownerLock > 0) &&
            d.ammo > 0,
        )
        .map((d) => {
          const floor = surfaceAt(solids, d),
            path = floor && paths.get(floor.id),
            value = weapons[d.type]?.value || 1;
          return {
            d,
            floor,
            path,
            value,
            score:
              (path?.cost ?? 100) + distance(p, d) / RUN_SPEED - value * 0.4,
          };
        })
        .filter(
          (d) =>
            d.path &&
            d.path.cost < (melee ? 10 : 7) &&
            (melee ? WEAPONS[d.d.type].kind !== "melee" : d.value > weapon.value + 2) &&
            distance(p, d.d) <
              (melee ? Math.min(900, Math.max(400,range * 0.8)) : 1100),
        )
        .sort((a, b) => a.score - b.score);
      const upgrade = upgrades.find(u=>u.d===b.pickup && world.time<b.pickupUntil) || upgrades[0];
      if (upgrade && (melee || upgrade.score < 1.5)) {
        ({ d: goal, floor: destination, path } = upgrade);
        if(b.pickup!==goal) { b.pickup=goal; b.pickupUntil=world.time+3; }
        if (
          p.weapon &&
          distance(p, goal) < 70 &&
          !firstObstacle(solids, p, goal)
        ) {
          i.throw = true;
          i.aim = -Math.PI / 2;
        }
      }
    }
    let moveTo = goal.x,
      edge = path?.edge;
    b.edge = null;
    const ride =
      here?.travel &&
      destination &&
      Math.abs(destination.y - here.y) > 180 &&
      (destination.y - here.y) *
        (predictedSurface(here, world.time + 0.75).y - here.y) >
        0;
    if (ride) {
      moveTo = here.x + here.w / 2;
      b.edge = null;
    } else if (here && destination && here.id !== destination.id) {
      if (!edge) {
        // Search reachable firing/approach positions instead of jumping into a ceiling.
        const options = [...paths]
          .map(([id, path]) => ({ s: solids.find((s) => s.id === id), path }))
          .filter((o) => o.s && o.path.edge);
        options.sort((a, c) => {
          const cost = (o) =>
            distance({ x: o.path.x, y: o.s.y - 30 }, goal) / 250 +
            o.path.cost * 0.6 +
            (b.visits.get(o.s.id) || 0) * 0.8;
          return cost(a) - cost(c);
        });
        edge = options[0]?.path.edge;
      }
      if (edge) {
        b.edge = edge;
        moveTo = edge.kind === "walk" ? edge.endX : edge.startX;
        if (
          edge.kind !== "walk" &&
          p.ground &&
          Math.abs(p.x - moveTo) < 10 &&
          Math.abs(p.vx) < 45 &&
          !b.flight
        ) {
          const actual = traceFlight(
            solids,
            here,
            p.x,
            edge.dir,
            edge.jumps,
            edge.secondAt,
            world.time,
            world.spikes(),
            p.vx,
            edge.landingX,
          );
          if (actual?.to === edge.to)
            b.flight = { ...actual, key: edge.key, started: world.time };
          else {
            b.failures.set(edge.key, world.time + 5);
            b.think = 0;
          }
        }
      } else moveTo = clamp(goal.x, here.x + 22, here.x + here.w - 22);
    } else {
      b.edge = null;
      if (
        goal === enemy &&
        weapon.speed &&
        !obstacle &&
        range < weapon.range * 0.85 &&
        !staleAttack
      ) {
        const desired = weapon.blast
          ? Math.max(420, weapon.blast + 140)
          : ["flame", "repulsor"].includes(p.weapon)
            ? 185
            : p.weapon === "shotgun"
              ? 260
              : 480;
        moveTo =
          p.x +
          (range < desired - 70
            ? -Math.sign(enemy.x - p.x) * 100
            : range > desired + 100
              ? Math.sign(enemy.x - p.x) * 100
              : 0);
      } else if (goal === enemy && !weapon.speed && range < 38) moveTo = p.x;
      if (here) {
        const margin = weapon.speed
          ? Math.min(
              footing.w / 2 - 3,
              Math.max(
                30,
                (weapon.recoil || 0) * Math.abs(Math.cos(i.aim)) * 0.38 + 24,
              ),
            )
          : 20;
        moveTo = clamp(moveTo, footing.x + margin, footing.x + footing.w - margin);
      }
    }
    Object.assign(i, steer(p, moveTo));
    if (
      !weapon.speed &&
      goal === enemy &&
      !obstacle &&
      !b.flight &&
      Math.abs(enemy.y - p.y) < 50 &&
      (range < 155 ||
        (range < 360 &&
          here &&
          p.ground &&
          enemy.x > here.x + 25 &&
          enemy.x < here.x + here.w - 25))
    ) {
      // Close the final gap with the same directional lunge available to humans.
      i.attack = true;
      i.left = enemy.x < p.x - 34;
      i.right = enemy.x > p.x + 34;
    }

    // Remove a marked floor under a target or a breakable ceiling blocking a short route.
    const support = choice.floor;
    const breach =
      support?.destructible &&
      support.hp > 0 &&
      support.id !== here?.id &&
      enemy.y < p.y - 55
        ? support
        : null;
    const ceiling = solids.find(
      (s) =>
        s.destructible &&
        s.hp > 0 &&
        s.y + s.h < p.y - 25 &&
        s.y + s.h > p.y - 200 &&
        p.x > s.x - 90 &&
        p.x < s.x + s.w + 90 &&
        goal.y < p.y - 50,
    );
    const panel = breach || (!path || path.cost > 3 ? ceiling : null);
    if (panel && !b.flight && !grenade && !staleAttack && (!melee || distance(p,center(panel)) < weapon.range)) {
      const point = {
        x: clamp(enemy.x, panel.x + 10, panel.x + panel.w - 10),
        y: panel.y + panel.h / 2,
      };
      const blocking = firstObstacle(solids, p, point);
      if (
        blocking === panel &&
        distance(p, point) < weapon.range &&
        (!weapon.blast || distance(p, point) > weapon.blast + 100)
      ) {
        clearing = true;
        i.aim = Math.atan2(point.y - (p.y - 10), point.x - p.x);
        i.attack = true;
        i.block = false;
        if (p.ground) Object.assign(i, steer(p, p.x));
      }
    }
    const dir = Number(i.right) - Number(i.left);
    const cover = solids.find(
      (s) =>
        s.kind &&
        s.hp > 0 &&
        (s.x + s.w / 2 - p.x) * dir > 0 &&
        Math.abs(s.x + s.w / 2 - p.x) < s.w / 2 + 72 &&
        p.y + 30 > s.y &&
        p.y - 28 < s.y + s.h,
    );
    if (cover && !b.flight) {
      clearing = true;
      const point = {
        x: clamp(p.x, cover.x + 2, cover.x + cover.w - 2),
        y: clamp(p.y - 10, cover.y + 2, cover.y + cover.h - 2),
      };
      i.aim = Math.atan2(point.y - (p.y - 10), point.x - p.x);
      i.attack = distance(p, point) < weapon.range && !weapon.blast;
      // Use the planned jump onto/over furniture; never jump blindly under a ceiling.
      if (weapon.blast) i.throw = true;
    }
    if (b.stuck > 1.2 && b.edge && !b.flight) {
      b.failures.set(b.edge.key, world.time + 9);
      b.think = 0;
      b.stuck = 0;
    }
    // A destroyed map may have no safe path at all. Once attacking and ordinary
    // routes stop making progress, commit to an exploratory jump/drop. A failed
    // landing is preferable to two survivors waiting forever on separate islands.
    if (!b.flight && !ride && p.ground && staleAttack && !b.recovery &&
        (world.time - b.approachAt > 5 || (!edge && b.stuck > 1.2))) {
      const attempt = b.recoveryAttempts || 0;
      let direction = Math.sign(enemy.x - p.x) || (p.id % 2 ? 1 : -1);
      const roof = solids.find(s => s.id !== here?.id && s.y + s.h < p.y - 25 &&
        s.y + s.h > p.y - 180 && p.x + 20 > s.x && p.x - 20 < s.x + s.w);
      if (roof) {
        const left = roof.x - 45, right = roof.x + roof.w + 45;
        direction = Math.abs(p.x - left) + Math.abs(enemy.x - left) * 0.25 <
          Math.abs(p.x - right) + Math.abs(enemy.x - right) * 0.25 ? -1 : 1;
      }
      if (attempt % 2) direction *= -1;
      b.recovery = { dir: direction, until: world.time + 2.4, jumpAt: null };
      b.recoveryAttempts = attempt + 1;
      if (edge) b.failures.set(edge.key, world.time + 9);
    }
    if (
      !b.flight &&
      p.ground &&
      enemy.block &&
      range < 90 &&
      world.time > b.maneuverAt
    ) {
      const overhead = solids.some(
        (s) =>
          s.y + s.h < p.y - 25 &&
          s.y + s.h > p.y - 190 &&
          p.x + 20 > s.x &&
          p.x - 20 < s.x + s.w,
      );
      if (!overhead) {
        i.jump = true;
        b.maneuverAt = world.time + 1.6;
        i.attack = false;
      }
    }

    // Predict impacts rather than reacting to every projectile anywhere nearby.
    let threat = null,
      soon = 0.4;
    for (const shot of world.projectiles) {
      if (
        shot.owner === p.id &&
        !["rocket", "grenade", "plasma"].includes(shot.kind)
      )
        continue;
      const vx = shot.vx - p.vx,
        vy = shot.vy - p.vy,
        speed2 = vx * vx + vy * vy;
      if (speed2 < 100) continue;
      const t = ((p.x - shot.x) * vx + (p.y - shot.y) * vy) / speed2;
      const radius = ["rocket", "grenade", "plasma"].includes(shot.kind)
        ? 90
        : 38;
      if (
        t >= 0 &&
        t < soon &&
        Math.hypot(shot.x + vx * t - p.x, shot.y + vy * t - p.y) < radius &&
        !firstObstacle(solids, p, { x: shot.x, y: shot.y })
      ) {
        threat = shot;
        soon = t;
      }
    }
    if (threat && threat !== b.defenceThreat) {
      b.defenceThreat = threat;
      b.reactToThreat = world.random() < skill.defence;
    }
    if (threat && b.reactToThreat) {
      if (["rocket", "grenade", "plasma"].includes(threat.kind)) {
        b.flight = null;
        const away = Math.sign(p.x - threat.x) || 1;
        if (here)
          Object.assign(
            i,
            steer(
              p,
              clamp(p.x + away * 170, here.x + 20, here.x + here.w - 20),
            ),
          );
        const roof = solids.some(
          (s) =>
            s.y + s.h < p.y - 25 &&
            s.y + s.h > p.y - 170 &&
            p.x > s.x - 15 &&
            p.x < s.x + s.w + 15,
        );
        i.jump = p.ground && !roof;
        i.attack = false;
      } else if (!p.weapon && !b.flight && p.stamina > 15 && soon < 0.2) {
        i.aim = Math.atan2(threat.y - p.y, threat.x - p.x);
        i.block = true;
        i.attack = false;
      } else if (
        !b.flight &&
        p.ground &&
        Math.abs(threat.y - (p.y - 10)) < 18
      ) {
        if (world.time > b.duckAgainAt && range > 140) {
          b.crouchUntil = world.time + 0.18;
          b.duckAgainAt = world.time + 1;
        }
      }
    }
    if (
      !p.weapon &&
      !b.flight &&
      range < 95 &&
      enemy.swing > 0 &&
      p.stamina > 20 &&
      p.cooldown > 0.1 &&
      world.time > b.parryAt
    ) {
      b.parryAt = world.time + 1.2;
      if (world.random() < skill.defence) {
        i.block = true;
        i.attack = false;
        i.aim = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      }
    }
    i.duck = world.time < b.crouchUntil && !b.flight;
    if (WEAPONS[p.weapon]?.proneOnly && !b.flight) {
      const deploy =
        !!here &&
        range > 190 &&
        !obstacle &&
        range < weapon.range &&
        Math.abs(enemy.y - p.y) < 230;
      i.duck = deploy;
      if (deploy) {
        i.left = false;
        i.right = false;
        i.jump = false;
      } else if (range < 165 && !obstacle) i.throw = true;
    }
    const hole = world.fields.find(
      (f) =>
        f.kind === "blackhole" &&
        Math.hypot(p.x - f.x, p.y - f.y) < f.radius + 45,
    );
    if (hole && here) {
      b.flight = null;
      Object.assign(
        i,
        steer(
          p,
          clamp(
            p.x + (Math.sign(p.x - hole.x) || 1) * 200,
            here.x + 20,
            here.x + here.w - 20,
          ),
        ),
      );
      i.duck = false;
      i.block = false;
    }
    const hazard = world.hazards.find(h=>{
      if(!dangerous(h))return false;
      const z=hazardZone(h);
      return p.x>z.x-45&&p.x<z.x+z.w+45&&p.y+30>z.y-20&&p.y-28<z.y+z.h;
    });
    if (hazard && !b.flight) {
      const z=hazardZone(hazard);
      let away=p.x<z.x+z.w/2?-1:1;
      if(hazard.type==="conveyor")away=-hazard.dir;
      if(here&&p.x+away*80<here.x+15)away=1;
      if(here&&p.x+away*80>here.x+here.w-15)away=-1;
      i.left=away<0;i.right=away>0;i.block=false;i.duck=false;
      const roof=solids.some(s=>s.y+s.h<p.y-25&&s.y+s.h>p.y-165&&p.x+20>s.x&&p.x-20<s.x+s.w);
      i.jump=p.ground&&!roof;
    }
    if (!p.ground && !b.flight && p.jumps === 1 && p.vy > 0 && p.y > H - 180)
      i.jump = true;
    if (b.recovery) {
      const recovery = b.recovery;
      if (world.time >= recovery.until) {
        b.recovery = null;
        b.think = 0;
      } else {
        b.flight = null;
        i.left = recovery.dir < 0;
        i.right = recovery.dir > 0;
        i.duck = false;
        i.block = false;
        const roof = solids.some(s => s.id !== here?.id && s.y + s.h < p.y - 25 &&
          s.y + s.h > p.y - 150 && p.x + 20 > s.x && p.x - 20 < s.x + s.w);
        const ledge = footing && (recovery.dir < 0 ? p.x - footing.x : footing.x + footing.w - p.x) < 55;
        const wall = solids.some(s => s.id !== here?.id &&
          p.y + 28 > s.y && p.y - 25 < s.y + s.h &&
          (recovery.dir > 0 ? s.x >= p.x && s.x < p.x + 65 : s.x + s.w <= p.x && s.x + s.w > p.x - 65));
        if (p.ground && !roof && recovery.jumpAt === null && (ledge || wall || b.stuck > 0.6)) {
          i.jump = true;
          recovery.jumpAt = world.time;
        } else if (!p.ground && p.jumps === 1 && p.vy > -80 && !roof &&
          (recovery.jumpAt === null || world.time - recovery.jumpAt > 0.3)) i.jump = true;
      }
    }
    if (weapon.speed && !clearing && !i.throw && !i.block) {
      i.attack &&= perception.fire;
      // Close-range weapons still connect reliably enough to pressure players.
      const error = perception.error * Math.min(1, range / 450) * (grenade ? 0.3 : 1);
      i.aim = Math.atan2(Math.sin(i.aim + error), Math.cos(i.aim + error));
    }
    if (i.block && !p.weapon) i.block = !p.blockHeld && p.parryCooldown <= 0;
    return i;
  }
}
