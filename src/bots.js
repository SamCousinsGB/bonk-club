import { BOT_DIFFICULTIES, cleanDifficulty, combatPerception } from "./bot-difficulty.js";
import { WEAPONS, COMBO, firingRecoil } from "./arsenal.js";
import { segmentBox } from "./collision.js";
import { W, H, RUN_SPEED } from "./scale.js";
import { breakable } from "./maps.js";
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
const weapons = {
  bat: { range: 100, value: 2, damage: 35 },
  sword: { range: 110, value: 4, damage: 28 },
  blaster: { range: 1100, speed: 1300, value: 6, damage: 17, recoil: 40 },
  shotgun: { range: 480, speed: 1050, value: 7, damage: 50, recoil: 150 },
  minigun: { range: 1000, speed: 1650, value: 9, damage: 10, recoil: 30 },
  railgun: { range: 2400, speed: 4600, value: 10, damage: 85, recoil: 380 },
  rocket: {
    range: 1250,
    speed: 680,
    value: 8,
    damage: 64,
    blast: 145,
    recoil: 240,
  },
  barrage: {
    range: 1250,
    speed: 780,
    value: 9,
    damage: 52,
    blast: 180,
    recoil: 410,
  },
  plasma: {
    range: 1050,
    speed: 850,
    value: 8,
    damage: 48,
    blast: 105,
    recoil: 170,
  },
  grenade: {
    range: WEAPONS.grenade.range,
    speed: WEAPONS.grenade.speed,
    value: 5,
    damage: 58,
    blast: 145,
    recoil: 40,
  },
};
for (const [type, w] of Object.entries(WEAPONS)) {
  weapons[type] ||= {
    range: w.range || 1000,
    speed: w.speed,
    value: { common: 5, uncommon: 7, rare: 9, exotic: 11 }[w.rarity],
    damage: w.damage,
    recoil: w.recoil || 0,
    blast: ["rocket", "grenade", "plasma", "singularity"].includes(w.kind)
      ? w.radius || 145
      : 0,
  };
}
for (const [type, w] of Object.entries(WEAPONS))
  weapons[type].recoil = firingRecoil(w, {
    prone: !!w.proneOnly,
    ground: true,
  });
const fists = { range: 92, value: 3, damage: 25 };
const center = (s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
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
        spikes: world.arena.spikes || [],
        cache: this.navigationCache,
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
      else this.graph.set(...next.value);
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
      (!weapon.blast || range > weapon.blast + 90);
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
    if (weapon.recoil && here && p.ground) {
      const recoilX = p.x - Math.cos(i.aim) * weapon.recoil * 0.38;
      if (recoilX < here.x + 18 || recoilX > here.x + here.w - 18)
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

    let goal = enemy,
      destination = choice.floor,
      path = choice.path;
    // Commit to a useful, reachable pickup; avoid repeatedly swapping similar weapons.
    if (range > (weapon.speed ? 220 : 500) && !b.flight) {
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
            d.path.cost < 7 &&
            d.value > weapon.value + (p.weapon ? 2 : 0) &&
            distance(p, d.d) <
              (weapon.speed ? 1100 : Math.min(500, range * 0.6)),
        )
        .sort((a, b) => a.score - b.score);
      if (upgrades[0] && (!p.weapon || upgrades[0].score < 1.5)) {
        ({ d: goal, floor: destination, path } = upgrades[0]);
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
            world.arena.spikes || [],
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
        range < weapon.range * 0.85
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
              here.w / 2 - 3,
              Math.max(
                30,
                (weapon.recoil || 0) * Math.abs(Math.cos(i.aim)) * 0.38 + 24,
              ),
            )
          : 20;
        moveTo = clamp(moveTo, here.x + margin, here.x + here.w - margin);
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
    if (panel && !b.flight && !grenade) {
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
    const hazard = world.hazards.find(
      (h) =>
        Math.abs(p.x - h.x) < h.w / 2 + 40 &&
        p.y + 30 > h.y - h.h &&
        p.y - 28 < h.y,
    );
    if (hazard) {
      b.flight = null;
      let away = p.x < hazard.x ? -1 : 1;
      if (here && p.x + away * 80 < here.x + 15) away = 1;
      if (here && p.x + away * 80 > here.x + here.w - 15) away = -1;
      i.left = away < 0;
      i.right = away > 0;
      i.block = false;
      i.duck = false;
      i.jump =
        p.ground &&
        hazard.warning === 0 &&
        ["electric", "lava"].includes(hazard.type);
    }
    if (!p.ground && !b.flight && p.jumps === 1 && p.vy > 0 && p.y > H - 180)
      i.jump = true;
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
