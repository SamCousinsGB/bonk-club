import { LINE_Y, LINE_CYCLE, LINE_DWELL, LINE_PITCH, LINE_SPEED, STATIONS } from "./assembly-arena.js";
import { playerBox, segmentBox } from "./collision.js";
import { carryImpulse } from "./impact.js";

const live = p => p.hp !== 0 && !p.wreckId;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const carTiles = (world, id) => world.platforms.filter(p => p.assemblyCar === id && live(p));
const area = tiles => tiles.reduce((sum, p) => sum + p.w * p.h, 0);
function part(world, car, name, x, y, w, h) {
  world.platforms.push({ id: `car${car.id}:${name}`, assemblyCar: car.id, assemblyPart: name,
    x: car.x + x, y, w, h, baseX: car.x + x, baseY: y, dx: 0, dy: 0, material: "metal" });
}
function buildStage(world, car, stage) {
  if (stage === 0) part(world, car, "chassis", -125, 1158, 250, 18);
  if (stage === 1) part(world, car, "body", -125, 1120, 250, 38);
  if (stage === 2) part(world, car, "cabin", -65, 1050, 140, 70);
  if (stage === 3) {
    part(world, car, "rearWheel", -102, 1148, 42, 42);
    part(world, car, "frontWheel", 60, 1148, 42, 42);
  }
  car.stage = stage;
  car.area = area(carTiles(world, car.id));
  // Installing a cabin lifts a rider onto the new roof instead of enclosing them.
  for (const p of world.players) if (p.alive) for (const tile of carTiles(world, car.id)) {
    if (!overlap(playerBox(p), tile)) continue;
    const dy = tile.y - 30 - p.y;
    p.y += dy; p.vy = Math.min(0, p.vy); p.support = tile.id; p.ground = true;
    for (const q of p.rig || []) { q.y += dy; q.py += dy; }
  }
  world.terrainVersion++;
}
function addCar(world, x, stage = 0) {
  const car = { id: ++world.assembly.serial, x, stage: 0, damaged: false, area: 0 };
  world.assembly.cars.push(car);
  for (let n = 0; n <= stage; n++) buildStage(world, car, n);
  return car;
}
export function createAssembly(world) {
  world.assembly = world.arena.assembly ? { clock: 0, serial: 0, completed: 0, cars: [] } : null;
  if (!world.assembly) return;
  // Work already in progress makes the first finished car visible in this round.
  for (const [x, stage] of [[40, 0], [640, 0], [1240, 1], [1840, 2]]) addCar(world, x, stage);
  world.hazards[0].bodyY = 894;
  world.platforms.push({ id: "assembly-head", assemblyHead: true, x: 500, y: 880, w: 280, h: 28,
    baseX: 500, baseY: 880, dx: 0, dy: 0, material: "metal" });
}

export function robotPose(h, phase) {
  const side = h.assemblyStation === 2 ? -1 : 1;
  const reach = h.active ? Math.sin(Math.max(0, phase - 1) * Math.PI) : 0;
  const base = { x: h.x + side * 152, y: 873 };
  const elbow = { x: h.x + side * (130 + reach * 38), y: 955 };
  const tip = { x: h.x + side * (20 + Math.cos(phase * 5) * 42), y: h.active ? 1064 + reach * 52 : 940 };
  return [base, elbow, tip];
}

function machine(world, h, phase, dt) {
  if (h.done) return;
  if (!world.platforms.some(p => live(p) && p.assemblyMount === h.assemblyStation && p.x <= h.x && p.x + p.w >= h.x) ||
      h.assemblyStation === 1 && !world.platforms.some(p => live(p) && p.assemblyHead)) {
    h.done = true; h.active = false; h.warning = 0; return;
  }
  h.age = world.assembly.clock;
  const wasActive = h.active;
  h.warning = phase < 1 ? 1 - phase : 0;
  h.active = phase >= 1 && phase < 2.5;
  if (h.active && !wasActive) { h.hitIds = []; world.event("hazard", { x: h.x, y: h.y, kind: h.type }); }
  const oldY = h.bodyY;
  h.bodyX = h.x;
  h.bodyY = h.assemblyStation === 1
    ? phase < 1 ? 894 : phase < 1.55 ? 894 + (phase - 1) / .55 * 214 : phase < 2 ? 1108 : phase < 3 ? 1108 - (phase - 2) * 214 : 894
    : robotPose(h, phase)[2].y;
  if (h.assemblyStation > 1) h.bodyX = robotPose(h, phase)[2].x;
  if (h.assemblyStation === 1) {
    for (const p of world.platforms.filter(p => p.assemblyHead && live(p))) {
      const dy = h.bodyY - oldY; p.y += dy; p.baseY += dy; p.dy = dy;
    }
  }
  if (!h.active || world.prediction) return;
  const pose = robotPose(h, phase);
  for (const p of world.players) {
    if (!p.alive || h.hitIds.includes(p.id)) continue;
    const box = playerBox(p);
    const touching = h.assemblyStation === 1
      ? overlap(box, { x: h.x - 140, y: Math.min(oldY, h.bodyY) - 14, w: 280, h: Math.abs(oldY - h.bodyY) + 28 })
      : segmentBox(pose[1].x, pose[1].y, pose[2].x, pose[2].y, box, 12);
    if (!touching) continue;
    h.hitIds.push(p.id);
    const press = h.assemblyStation === 1;
    world.hit(p, { x: h.x, y: h.bodyY, vx: 0, vy: 0 }, press ? 1000 : 38, press ? 700 : 380,
      Math.sign(p.x - h.x) || 1, -.4, { blast: true, effect: press ? "blast" : "tesla", cause: press ? "crusher" : "electrified" });
  }
}

export function updateAssembly(world, dt) {
  const line = world.assembly;
  if (!line || world.phase !== "fight" || world.prediction) return;
  const before = line.clock;
  line.clock += dt;
  const phase = (line.clock + 1e-9) % LINE_CYCLE;
  const travel = t => Math.floor((t + 1e-9) / LINE_CYCLE) * LINE_PITCH + Math.max(0, (t + 1e-9) % LINE_CYCLE - LINE_DWELL) * LINE_SPEED;
  const dx = travel(line.clock) - travel(before);
  for (const h of world.hazards.filter(h => h.assemblyStation)) machine(world, h, phase, dt);
  if (world.hazards[0].done) world.platforms = world.platforms.filter(p => !p.assemblyHead);
  const belts = world.platforms.filter(p => p.assemblyBelt && live(p));
  for (const b of belts) b.dx = dx;
  const supported = x => x < 0 || x > 2560 || belts.some(b => x >= b.x && x <= b.x + b.w && Math.abs(b.y - LINE_Y) < 2);
  for (const car of line.cars) {
    const tiles = carTiles(world, car.id);
    if (area(tiles) < car.area - .5) car.damaged = true;
    // Pallets are clamped to the line. A severed rail stops them at the break.
    const moving = supported(car.x - 80) && supported(car.x + 80) && supported(car.x + 80 + dx);
    const jammed = line.cars.some(other => other !== car && other.x > car.x && other.x - car.x < 280);
    const shift = moving && !jammed ? dx : 0;
    car.x += shift;
    for (const p of tiles) { p.x += shift; p.baseX += shift; p.dx = shift; }
    if (phase >= 1.55 && phase < 2.5 && !car.damaged) {
      const station = world.hazards.find(h => h.assemblyStation === car.stage + 1 && !h.done && Math.abs(h.x - car.x) < 3);
      if (station) {
        buildStage(world, car, car.stage + 1);
        if (car.stage === 3) line.completed++;
      }
    }
  }
  // Feed only into a clear entry. IDs never wrap, and queues remain bounded.
  if (phase < dt + 1e-8 && line.cars.length < 6 && line.cars.every(c => c.x > 320) && supported(40)) addCar(world, 40);
  const gone = new Set(line.cars.filter(c => c.x > 2690 || !carTiles(world, c.id).length).map(c => c.id));
  line.cars = line.cars.filter(c => !gone.has(c.id));
  world.platforms = world.platforms.filter(p => !gone.has(p.assemblyCar));
  if (dx > 0) {
    for (const d of world.drops) if (Math.abs(d.y + 8 - LINE_Y) < 15 && supported(d.x)) d.vx = LINE_SPEED;
    for (const b of [...world.cover, ...world.chunks]) if (b.hp > 0 && Math.abs(b.y + b.h - LINE_Y) < 12 && supported(b.x + b.w / 2)) b.vx += Math.min(LINE_SPEED - b.vx, 900 * dt);
    // Ground motion also remains after the fighter steps off a running belt.
    for (const p of world.players) if (p.ground && belts.some(b => b.id === p.support)) carryImpulse(p, .08);
  }
}

export function assemblySnapshot(line) {
  return line && { clock: line.clock, serial: line.serial, completed: line.completed,
    cars: line.cars.map(({ id, x, stage, damaged }) => ({ id, x, stage, damaged })) };
}
export function validAssembly(line) {
  const int = n => Number.isSafeInteger(n) && n >= 0 && n <= 10000000;
  return line === null || !!line && Number.isFinite(line.clock) && line.clock >= 0 && line.clock <= 1e8 &&
    int(line.serial) && int(line.completed) && line.completed <= line.serial && Array.isArray(line.cars) && line.cars.length <= 6 &&
    new Set(line.cars.map(c => c?.id)).size === line.cars.length && line.cars.every(c => c && int(c.id) && c.id > 0 && c.id <= line.serial &&
      Number.isFinite(c.x) && c.x >= -150 && c.x <= 2700 && int(c.stage) && c.stage <= 3 && typeof c.damaged === "boolean");
}
