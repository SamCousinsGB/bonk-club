import { LINE_Y, LINE_CYCLE, LINE_DWELL, LINE_PITCH, LINE_SPEED } from "./assembly-arena.js";
import { playerBox, segmentBox } from "./collision.js";
import { carryImpulse } from "./impact.js";
import { carParts, robotPose, pressPosition, PRESS_HOME, PRESS_HALF_HEIGHT, steamStrength, steamZones, welding } from "./assembly-geometry.js";
export { robotPose } from "./assembly-geometry.js";

const hitTimes = new WeakMap();
const live = p => p.hp !== 0 && !p.wreckId;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const carTiles = (world, id) => world.platforms.filter(p => p.assemblyCar === id && live(p));
const area = tiles => tiles.reduce((sum, p) => sum + p.w * p.h, 0);
function part(world, car, name, x, y, w, h, index) {
  world.platforms.push({ id: `car${car.id}:${name}:${index}`, assemblyCar: car.id, assemblyPart: name,
    x: car.x + x, y, w, h, baseX: car.x + x, baseY: y, dx: 0, dy: 0, material: "metal" });
}
function buildStage(world, car, stage) {
  carParts(stage).forEach((p, i) => part(world, car, p.name, p.x, p.y, p.w, p.h, i));
  car.stage = stage;
  car.area = area(carTiles(world, car.id));
  // Install the whole silhouette atomically, so a surviving rider is lifted
  // clear of every new strip, including the sloped cabin shoulders.
  const tiles = carTiles(world, car.id);
  for (const p of world.players) if (p.alive && tiles.some(tile => overlap(playerBox(p), tile))) {
    const box = playerBox(p);
    const tile = tiles.filter(t => box.x < t.x+t.w && box.x+box.w > t.x).sort((a,b)=>a.y-b.y)[0];
    const dy = tile.y - 30 - p.y;
    p.y += dy; p.vy = Math.min(0, p.vy); p.support = tile.id; p.ground = true;
    for (const q of p.rig || []) { q.y += dy; q.py += dy; }
  }
  world.terrainVersion++;
}
function addCar(world, x, stage = 0) {
  const car = { id: ++world.assembly.serial, x, stage: 0, damaged: false, blocked: false, area: 0 };
  world.assembly.cars.push(car);
  for (let n = 0; n <= stage; n++) buildStage(world, car, n);
  return car;
}
export function createAssembly(world) {
  world.assembly = world.arena.assembly ? { clock: 0, serial: 0, completed: 0, cars: [] } : null;
  if (!world.assembly) return;
  // Work already in progress makes the first finished car visible in this round.
  for (const [x, stage] of [[40, 0], [640, 0], [1240, 1], [1840, 2]]) addCar(world, x, stage);
  for (const h of world.hazards) {
    h.assemblyWork = 0; h.assemblyFault = "none";
    hitTimes.set(h, {});
  }
  world.hazards[0].bodyY = PRESS_HOME;
  world.platforms.push({ id: "assembly-head", assemblyHead: true, x: 500, y: PRESS_HOME - PRESS_HALF_HEIGHT, w: 280, h: PRESS_HALF_HEIGHT * 2,
    baseX: 500, baseY: PRESS_HOME - PRESS_HALF_HEIGHT, dx: 0, dy: 0, material: "metal" });
}

function machine(world, h, phase) {
  if (!world.platforms.some(p => live(p) && p.assemblyMount === h.assemblyStation && p.x <= h.x && p.x + p.w >= h.x) ||
      h.assemblyStation === 1 && !world.platforms.some(p => live(p) && p.assemblyHead)) h.done = true;
  const car = world.assembly.cars.find(c => Math.abs(c.x - h.x) < 3);
  if (phase < 1) h.assemblyWork = car?.stage === h.assemblyStation - 1 ? car.id : 0;
  const latched = car && car.id === h.assemblyWork;
  h.assemblyFault = h.done ? "broken" : car?.blocked ? "jam" : car?.damaged ? "damaged" : !car ? "empty" :
    !latched && car.stage !== h.assemblyStation - 1 ? "stage" : "none";
  const working = latched && h.assemblyFault === "none";
  h.age = world.assembly.clock;
  const wasActive = h.active;
  h.warning = working && phase < 1 ? 1 - phase : 0;
  h.active = !!working && phase >= 1 && phase < 2.55;
  if (h.active && !wasActive) { hitTimes.set(h, {}); world.event("hazard", { x: h.x, y: h.y, kind: h.type }); }
  if (h.done) { h.assemblyWork = 0; return; }
  const oldY = h.bodyY;
  const pose = robotPose(h, phase);
  h.bodyX = h.assemblyStation === 1 ? h.x : pose[2].x;
  h.bodyY = h.assemblyStation === 1 ? pressPosition(phase, working) : pose[2].y;
  if (h.assemblyStation === 1) {
    for (const p of world.platforms.filter(p => p.assemblyHead && live(p))) {
      const dy = h.bodyY - oldY; p.y += dy; p.baseY += dy; p.dy = dy;
    }
  }
  if (!h.active || world.prediction) return;
  for (const p of world.players) {
    if (!p.alive || (hitTimes.get(h)[p.id] ?? -1) > world.assembly.clock - .22) continue;
    const box = playerBox(p), press = h.assemblyStation === 1;
    const crushed = press && overlap(box, { x: h.x - 140, y: Math.min(oldY, h.bodyY) - PRESS_HALF_HEIGHT,
      w: 280, h: Math.abs(oldY - h.bodyY) + PRESS_HALF_HEIGHT * 2 });
    const steam = press && steamStrength(h, phase) > .15 && steamZones(h).some(zone => overlap(box, zone));
    const arm = !press && segmentBox(pose[1].x, pose[1].y, pose[2].x, pose[2].y, box, 18);
    const tool = !press && phase >= 1.3 && phase < 2.3 && overlap(box,
      { x: pose[2].x - 48, y: pose[2].y - 62, w: 96, h: 90 });
    if (!crushed && !steam && !arm && !tool) continue;
    hitTimes.get(h)[p.id] = world.assembly.clock;
    const electric = welding(h, phase);
    world.hit(p, { x: h.bodyX, y: h.bodyY, vx: 0, vy: 0 }, crushed ? 1000 : tool ? 110 : 65,
      crushed ? 700 : 430, Math.sign(p.x - h.x) || 1, -.4,
      { blast: true, effect: electric ? "tesla" : "blast", cause: electric ? "electrified" : steam ? "burn" : "crusher" });
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
  const belts = world.platforms.filter(p => p.assemblyBelt && live(p));
  for (const b of belts) b.dx = dx;
  const supported = x => x < 0 || x > 2560 || belts.some(b => x >= b.x && x <= b.x + b.w && Math.abs(b.y - LINE_Y) < 2);
  for (const car of line.cars) {
    const tiles = carTiles(world, car.id);
    if (area(tiles) < car.area - .5) car.damaged = true;
    // Pallets are clamped to the line. A severed rail stops them at the break.
    const moving = supported(car.x - 80) && supported(car.x + 80) && supported(car.x + 80 + dx);
    const jammed = line.cars.some(other => other !== car && other.x > car.x && other.x - car.x < 280);
    car.blocked = !moving || jammed;
    const shift = !car.blocked ? dx : 0;
    car.x += shift;
    for (const p of tiles) { p.x += shift; p.baseX += shift; p.dx = shift; }
  }
  for (const h of world.hazards.filter(h => h.assemblyStation)) machine(world, h, phase);
  if (world.hazards[0].done) world.platforms = world.platforms.filter(p => !p.assemblyHead);
  for (const car of line.cars) {
    const station = world.hazards.find(h => h.assemblyStation === car.stage + 1 && h.assemblyWork === car.id &&
      h.assemblyFault === "none" && h.active && Math.abs(h.x - car.x) < 3);
    if (station && phase >= (station.assemblyStation === 1 ? 1.55 : 2.3) && phase < 2.55) {
      buildStage(world, car, car.stage + 1);
      if (car.stage === 3) line.completed++;
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
    cars: line.cars.map(({ id, x, stage, damaged, blocked }) => ({ id, x, stage, damaged, blocked })) };
}
export function validAssembly(line) {
  const int = n => Number.isSafeInteger(n) && n >= 0 && n <= 10000000;
  return line === null || !!line && Number.isFinite(line.clock) && line.clock >= 0 && line.clock <= 1e8 &&
    int(line.serial) && int(line.completed) && line.completed <= line.serial && Array.isArray(line.cars) && line.cars.length <= 6 &&
    new Set(line.cars.map(c => c?.id)).size === line.cars.length && line.cars.every(c => c && int(c.id) && c.id > 0 && c.id <= line.serial &&
      Number.isFinite(c.x) && c.x >= -150 && c.x <= 2700 && int(c.stage) && c.stage <= 3 && typeof c.damaged === "boolean" && typeof c.blocked === "boolean");
}
