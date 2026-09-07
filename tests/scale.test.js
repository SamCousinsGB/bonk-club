import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS, CITY_ARENAS, cleanInput } from "../src/engine.js";
import {
  W,
  H,
  RUN_SPEED,
  CRAWL_SPEED,
  GUARD_SPEED,
  SUDDEN_DEATH,
} from "../src/scale.js";
import { gameViewport, screenToWorld } from "../src/viewport.js";
import { validSnapshot } from "../src/network.js";
import { combatFloor } from "./helpers.js";

for (const [stance, input, speed] of [
  ["running", {}, RUN_SPEED],
  ["crawling", { duck: true }, CRAWL_SPEED],
])
  test(`${stance} cannot accelerate above its movement limit`, () => {
    const w = new World(),
      p = w.players[0];
    combatFloor(w);
    Object.assign(p, { x: 200, y: 535, ground: true, vx: 0, vy: 0 });
    for (let i = 0; i < 720; i++) {
      w.move(p, cleanInput({ ...input, right: true, aim: null }), STEP);
      assert.ok(p.vx <= speed + 0.001, `${stance} reached ${p.vx}`);
    }
    assert.ok(p.vx > speed - 0.1);
  });

test("parrying limits movement only during its window; holding does not guard", () => {
  const w = new World(), p = w.players[0];
  combatFloor(w);
  Object.assign(p, { x: 200, y: 535, ground: true, vx: 0, vy: 0 });
  let parryTicks = 0;
  for (let i = 0; i < 240; i++) {
    w.move(p, cleanInput({ block: true, right: true, aim: null }), STEP);
    if (p.block) {
      parryTicks++;
      assert.ok(p.vx <= GUARD_SPEED + 0.001);
    } else assert.ok(p.vx <= RUN_SPEED + 0.001);
  }
  assert.ok(parryTicks > 0 && parryTicks < 22);
  assert.equal(p.block, false);
  assert.ok(p.vx > RUN_SPEED - 0.1);
});

test("a held movement key preserves an initial hit impulse without adding speed", () => {
  const w = new World(),
    p = w.players[0];
  combatFloor(w);
  Object.assign(p, { x: 500, y: 535, ground: true, vx: 900, vy: 0 });
  w.move(p, cleanInput({ right: true, aim: null }), STEP);
  assert.ok(p.vx < 900 && p.vx > 850);
  for (let n = 0; n < 240; n++)
    w.move(p, cleanInput({ right: true, aim: null }), STEP);
  assert.ok(p.vx >= RUN_SPEED && p.vx < RUN_SPEED + 2);
});

test("crossing an unobstructed arena takes over ten seconds, without sticky stops", () => {
  const w = new World(),
    p = w.players[0];
  combatFloor(w);
  Object.assign(p, { x: 100, y: 535, ground: true, vx: 0, vy: 0 });
  let elapsed = 0;
  while (p.x < W - 110 && elapsed < 15) {
    w.move(p, cleanInput({ right: true, aim: null }), STEP);
    elapsed += STEP;
  }
  assert.ok(elapsed > 9.8 && elapsed < 10.5, String(elapsed));
  const stopX = p.x;
  for (let n = 0; n < 40; n++) w.move(p, cleanInput({ aim: null }), STEP);
  assert.ok(p.x - stopX < 15);
  assert.ok(Math.abs(p.vx) < 1);
});

test("all arenas occupy the enlarged world and support expanded online snapshots", () => {
  assert.equal(W * H, 4 * 1280 * 720);
  for (let i = 0; i < ARENAS.length; i++) {
    const w = new World({ arena: i, players: [0, 1, 2, 3] });
    assert.ok(Math.max(...w.platforms.map((p) => p.x + p.w)) > 2400);
    assert.ok(Math.min(...w.platforms.map((p) => p.y)) <= 580);
    assert.ok(Math.max(...w.platforms.map((p) => p.y)) >= 1200);
    assert.ok(w.platforms.length >= 20);
    assert.ok(w.cover.length >= 5);
    assert.ok(Math.abs(w.players[0].x - w.players[1].x) >= 2000);
    assert.equal(validSnapshot(w.snapshot()), true, w.arena.name);
    const bad = structuredClone(w.snapshot());
    bad.platforms = Array(73).fill(bad.platforms[0]);
    assert.equal(validSnapshot(bad), false);
  }
});

// These are real movement/collision checks, using each building's full geometry.
// A player can ascend either outside route even while the lifts are elsewhere.
for (const arena of CITY_ARENAS)
  for (const right of [false, true])
    test(`outside route climbs all tall storeys in ${ARENAS[arena].name} (${right ? "right" : "left"})`, () => {
      const w = new World({ arena }),
        p = w.players[0];
      const inside = right ? 2410 : 150,
        outside = right ? 2490 : 70;
      Object.assign(p, { x: inside, y: 1270, ground: true, vx: 0, vy: 0 });
      for (let floorY = 1300; floorY > 340; floorY -= 320) {
        for (const [x, y] of [
          [outside, floorY - 80],
          [inside, floorY - 160],
          [outside, floorY - 240],
          [inside, floorY - 320],
        ]) {
          let arrived = false;
          for (let tick = 0; tick < 240; tick++) {
            w.time += STEP;
            w.movePlatforms();
            w.move(
              p,
              cleanInput({
                left: p.x > x + 4,
                right: p.x < x - 4,
                jump: tick === 0 || (tick === 40 && p.y + 30 > y),
                aim: null,
              }),
              STEP,
            );
            if (
              p.ground &&
              Math.abs(p.y + 30 - y) < 1 &&
              Math.abs(p.x - x) < 5 &&
              Math.abs(p.vx) < 30
            ) {
              arrived = true;
              break;
            }
          }
          assert.ok(arrived, `missed landing ${x}, ${y}; at ${p.x}, ${p.y}`);
          // Let the movement key release before starting the next jump.
          w.move(p, cleanInput({ aim: null }), STEP);
        }
      }
      assert.equal(p.y + 30, 340);
    });

test("long-range shots can reach the far side of the enlarged arena", () => {
  for (const type of ["blaster", "railgun", "rocket"]) {
    const w = new World(),
      [a, b] = w.players;
    combatFloor(w);
    Object.assign(a, { x: 200, y: 535, weapon: type, ammo: 3, aimAngle: 0 });
    Object.assign(b, { x: 2300, y: 535 });
    w.attack(a);
    for (let n = 0; n < 480 && b.hp === 100; n++) w.updateProjectiles(STEP);
    assert.ok(b.hp < 100, type);
  }
});

test("players and initial weapon pickups have time for a long pursuit before sudden death", () => {
  const w = new World({ arena: CITY_ARENAS[0] });
  assert.equal(SUDDEN_DEATH, 120);
  assert.ok(w.drops.every((d) => d.life >= SUDDEN_DEATH));
  w.phase = "fight";
  w.elapsed = 60;
  for (let i = 0; i < 120; i++) w.step(STEP);
  assert.ok(w.players.every((p) => p.alive && p.hp === 100));
  w.elapsed = SUDDEN_DEATH;
  w.step(STEP);
  assert.ok(w.players.every((p) => p.hp < 100));
});

test("desktop and phone frame twice as much world without changing aim coordinates", () => {
  const desktop = gameViewport(1280, 720);
  assert.equal(desktop.scale, 0.5);
  assert.equal(desktop.width, 2560);
  const phone = gameViewport(390, 608, 2200, true);
  assert.ok(phone.width > 900);
  assert.equal(phone.height, 1440);
  const point = screenToWorld(195, 304, { left: 0, top: 0 }, phone);
  assert.ok(Math.abs(point.x - (phone.left + phone.width / 2)) < 0.001);
  assert.equal(point.y, H / 2);
});
