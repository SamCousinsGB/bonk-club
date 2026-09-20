import { LINE_Y, LINE_CYCLE, LINE_SPEED, STATIONS } from "./assembly-arena.js";
import { playerBox, segmentBox } from "./collision.js";
import { carryImpulse } from "./impact.js";
import { carShape, carHeight, carMass, PART, paintStrength, robotPose, pressPosition, PRESS_HOME, PRESS_HALF_HEIGHT, steamStrength, steamZones, welding } from "./assembly-geometry.js";
import { prepareProp, propSolids, bodyBounds, impulseProp } from "./props.js";
import { crusherContact } from "./crusher-contact.js";
export { robotPose } from "./assembly-geometry.js";

const hitTimes = new WeakMap();
const live = p => p.hp !== 0 && !p.wreckId;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const carBody = (world, car) => world.cover.find(b => b.id === 'car'+car.id && b.hp > 0);
export const carTiles = (world, id) => { const b=carBody(world,{id}); return b ? propSolids(b) : []; };
function buildStage(world, car, stage) {
  const b=carBody(world,car),bottom=b.y+b.h;
  car.stage=stage;b.carStage=stage;b.h=carHeight(stage);b.y=bottom-b.h;b.shape=carShape(stage);
  b.mass=carMass(stage);
  const tiles=propSolids(b);
  for(const p of world.players)if(p.alive&&tiles.some(t=>overlap(playerBox(p),t))){
    const box=playerBox(p),tile=tiles.filter(t=>box.x<t.x+t.w&&box.x+box.w>t.x).sort((a,b)=>a.y-b.y)[0];
    const dy=tile.y-30-p.y;p.y+=dy;p.vy=Math.min(0,p.vy);p.support=tile.id;p.ground=true;
    for(const q of p.rig||[]){q.y+=dy;q.py+=dy;}
  }
  world.terrainVersion++;
}
function addCar(world,x,stage=0){
  const car={id:++world.assembly.serial,x,stage,damaged:false,blocked:false};
  world.assembly.cars.push(car);
  world.cover.push(prepareProp({id:'car'+car.id,kind:'car',carStage:stage,carPaint:car.id%4,carCoat:stage & PART.PAINT ? 1 : 0,
    x:x-125,y:LINE_Y-carHeight(stage),w:250,h:carHeight(stage),hp:200,maxHp:200,
    mass:carMass(stage),shape:carShape(stage),vx:0}));
  return car;
}
export function createAssembly(world) {
  world.assembly = world.arena.assembly ? { clock: 0, serial: 0, completed: 0, cars: [] } : null;
  if (!world.assembly) return;
  // Keep loose supplies on maintenance ledges, clear of controls and tooling.
  world.cover.forEach((b,i)=>{const x=[1120,600,1710][i];if(x!==undefined){b.x=x-b.w/2;b.y=565-b.h;}});
  // Work already in progress makes the first finished car visible in this round.
  for (const [x, stage] of [[140, 0], [410, 0], [930, 1], [1470, 3], [2030, 15]]) addCar(world, x, stage);
  for (const h of world.hazards) {
    h.assemblyWork = 0; h.assemblyFault = "none"; h.assemblyPhase = 0; h.assemblyOffset = 0; h.assemblyBottom = LINE_Y; h.assemblyAngle = 0;
    hitTimes.set(h, {});
  }
  world.hazards[0].bodyY = PRESS_HOME;
  world.platforms.push({ id: "assembly-head", assemblyHead: true, x: STATIONS[0]-140, y: PRESS_HOME - PRESS_HALF_HEIGHT, w: 280, h: PRESS_HALF_HEIGHT * 2,
    baseX: STATIONS[0]-140, baseY: PRESS_HOME - PRESS_HALF_HEIGHT, dx: 0, dy: 0, material: "metal" });
}

function machine(world, h, dt) {
  if (!world.platforms.some(p => live(p) && p.assemblyMount === h.assemblyStation && p.x <= h.x && p.x + p.w >= h.x) ||
      h.assemblyStation === 1 && !world.platforms.some(p => live(p) && p.assemblyHead)) h.done = true;
  let car=world.assembly.cars.find(c=>c.id===h.assemblyWork);
  if(car && (car.x>h.x+240 || car.x<h.x-160 || !carBody(world,car))){h.assemblyWork=0;car=null;}
  if(!car){
    car=world.assembly.cars.find(c=>c.x>=h.x-91&&c.x<h.x-15&&carBody(world,c));
    if(car){h.assemblyWork=car.id;h.assemblyPhase=0;}
  }
  const b=car&&carBody(world,car);
  const reachable=b && b.y+b.h>950 && b.y+b.h<1370;
  h.assemblyOffset=b?Math.max(-240,Math.min(240,b.x+b.w/2-h.x)):0;
  h.assemblyBottom=b?Math.max(950,Math.min(1370,b.y+b.h)):LINE_Y;
  h.assemblyAngle=b?b.angle:0;
  const previousPhase=h.assemblyPhase;
  h.assemblyPhase=Math.min(3.5,h.assemblyPhase+dt);
  const phase=h.assemblyPhase;
  // Damage and missing upstream parts never reject a car or stop the line.
  // A broken machine stops; an empty/out-of-reach workspace simply parks.
  h.assemblyFault=h.done?'broken':!reachable?'empty':'none';
  const working = !!car && reachable && !h.done;
  h.age = world.assembly.clock;
  const wasActive = h.active;
  h.warning = working && phase < 1 ? 1 - phase : 0;
  h.active = !!working && phase >= 1 && phase < (h.assemblyStation>=3?3:2.55);
  if (h.active && !wasActive) hitTimes.set(h, {});
  const cues=h.assemblyStation===1?[[1,'assembly-servo'],[1.55,'assembly-impact']]:
    h.assemblyStation===2?[[1.3,'tesla'],[1.95,'tesla']]:
    h.assemblyStation===3?[[1.12,'assembly-servo'],[1.78,'assembly-fit'],[2.14,'assembly-servo'],[2.85,'assembly-fit']]:
    [[1,'assembly-spray'],[1.6,'assembly-spray'],[2.2,'assembly-spray']];
  if(working)for(const [at,kind] of cues)if(previousPhase<at&&phase>=at)
    world.event('hazard',{x:h.x,y:h.y,kind});
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
    const crushed = press && crusherContact(h,oldY,h.bodyY,box,PRESS_HALF_HEIGHT);
    const steam = press && steamStrength(h, phase) > .15 && steamZones(h).some(zone => overlap(box, zone));
    const arm = !press && h.assemblyStation!==4 && segmentBox(pose[1].x, pose[1].y, pose[2].x, pose[2].y, box, 18);
    const tool = !press && h.assemblyStation!==4 && phase >= 1.3 && phase < 2.9 && overlap(box,
      { x: pose[2].x - 48, y: pose[2].y - 62, w: 96, h: 90 });
    const spray = paintStrength(h,phase)>.2 && overlap(box,{x:h.x-165,y:1000,w:330,h:190});
    if (!crushed && !steam && !arm && !tool && !spray) continue;
    hitTimes.get(h)[p.id] = world.assembly.clock;
    const electric = welding(h, phase);
    world.hit(p, { x: h.bodyX, y: h.bodyY, vx: 0, vy: 0 }, crushed ? 1000 : tool ? 110 : spray ? 24 : 65,
      crushed ? 700 : 430, Math.sign(p.x - h.x) || 1, -.4,
      { blast: true, effect: electric ? "tesla" : "blast", cause: electric ? "electrified" : steam || spray ? "burn" : "crusher" });
  }
}

export function updateAssembly(world, dt) {
  const line = world.assembly;
  if (!line || world.phase !== "fight" || world.prediction) return;
  line.clock+=dt;
  const belts=world.platforms.filter(p=>p.assemblyBelt&&live(p));
  for(const b of belts)b.dx=LINE_SPEED*dt;
  line.cars=line.cars.filter(c=>carBody(world,c));
  world.cover=world.cover.filter(b=>b.kind!=='car'||b.hp>0);
  for(const car of line.cars){
    const b=carBody(world,car);car.x=b.x+b.w/2;car.damaged ||= b.hp<b.maxHp;
    car.blocked=car.x<2560 && (Math.abs(b.angle)>.12||Math.abs(b.y+b.h-LINE_Y)>12);
  }
  for(const h of world.hazards.filter(h=>h.assemblyStation))machine(world,h,dt);
  if(world.hazards.find(h=>h.assemblyStation===1)?.done)world.platforms=world.platforms.filter(p=>!p.assemblyHead);
  for(const h of world.hazards.filter(h=>h.assemblyWork&&h.active)){
    const car=line.cars.find(c=>c.id===h.assemblyWork),b=car&&carBody(world,car);
    if(!b)continue;
    const phase=h.assemblyPhase;
    let parts=car.stage;
    if(h.assemblyStation===1&&phase>=1.55)parts|=PART.BODY;
    if(h.assemblyStation===2&&phase>=2.3)parts|=PART.CABIN;
    if(h.assemblyStation===3){
      if(phase>=1.78)parts|=PART.FRONT;
      if(phase>=2.85)parts|=PART.REAR;
    }
    if(h.assemblyStation===4&&phase>=1){
      // Real persistent coverage: interrupting a spray leaves the part-painted shell.
      b.carCoat=Math.min(1,(b.carCoat||0)+dt/1.8);
      if(b.carCoat>=1 && !(parts&PART.PAINT)){
        parts|=PART.PAINT;
        if(parts===31)line.completed++;
      }
    }
    if(parts!==car.stage)buildStage(world,car,parts);
  }
  // A continuously moving belt applies traction only at surviving contact.
  // Once unsupported, gravity and retained momentum carry a car into the hole.
  for(const b of [...world.cover,...world.chunks])if(b.hp>0){
    const box=bodyBounds(b);
    if(belts.some(p=>box.x<p.x+p.w&&box.x+box.w>p.x&&Math.abs(box.y+box.h-p.y)<12))
      impulseProp(b,b.mass*Math.min(900*dt,Math.max(0,LINE_SPEED-b.vx)),0);
  }
  for(const d of world.drops)if(belts.some(b=>d.x>=b.x&&d.x<=b.x+b.w&&Math.abs(d.y+8-b.y)<15))d.vx=LINE_SPEED;
  for(const p of world.players)if(p.ground&&belts.some(b=>b.id===p.support))carryImpulse(p,.08);
  if(Math.floor(line.clock/LINE_CYCLE)>Math.floor((line.clock-dt)/LINE_CYCLE)&&line.cars.length<6&&
    world.cover.every(b=>b.hp<=0||b.kind!=='car'||!overlap(bodyBounds(b),{x:0,y:1040,w:280,h:200})))addCar(world,140);
}

export function assemblySnapshot(line, cover) {
  return line && { clock: line.clock, serial: line.serial, completed: line.completed,
    cars: line.cars.filter(c=>!cover||cover.some(b=>b.id==='car'+c.id&&b.hp>0)).map(({ id, x, stage, damaged, blocked }) => {
      const b=cover?.find(b=>b.id==='car'+id);
      return {id,x:b?b.x+b.w/2:x,stage,damaged:damaged||!!b&&b.hp<b.maxHp,blocked};
    }) };
}
export function validAssembly(line) {
  const int = n => Number.isSafeInteger(n) && n >= 0 && n <= 10000000;
  return line === null || !!line && Number.isFinite(line.clock) && line.clock >= 0 && line.clock <= 1e8 &&
    int(line.serial) && int(line.completed) && line.completed <= line.serial && Array.isArray(line.cars) && line.cars.length <= 6 &&
    new Set(line.cars.map(c => c?.id)).size === line.cars.length && line.cars.every(c => c && int(c.id) && c.id > 0 && c.id <= line.serial &&
      Number.isFinite(c.x) && c.x >= -500 && c.x <= 3100 && int(c.stage) && c.stage <= 31 && typeof c.damaged === "boolean" && typeof c.blocked === "boolean");
}
