import { W, H } from "./scale.js";
import { segmentBox, playerBox } from "./collision.js";
import { bodyBounds, bodyInBlast, impulseProp, prepareProp, fractureProp } from "./props.js";
import { conductive, conductorNodes, conductorBounds, conductorsTouch } from "./conductors.js";
import { carveRectangle } from "./nuclear.js";
import { hazardZone } from "./hazards.js";
import { BARRELS, SPILLS, SPILL_LIMIT, explosiveBarrel } from "./barrels.js";
import { igniteFighter } from "./weird-weapons.js";

// The host owns finite water and fuel. Guests receive only the bounded visible
// state; neither fluid motion nor damage is re-simulated by a guest.
export const WATER_LIMIT = 192, GAS_LIMIT = 24, WATER_WIDTH = 32;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const centre = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const overlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad &&
  a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
const flammable = b => ["wood", "fabric"].includes(b.material) || b.panel === "wood";
const ice = p => p.ice || p.material === "ice";
const walls = world => world.platforms.filter(p => p.hp !== 0 && !p.waterId);
const clear = (world, a, b) => !walls(world).some(s => segmentBox(a.x, a.y, b.x, b.y, s));
const bodies = world => [...world.cover, ...world.chunks].filter(b => b.hp > 0);
const near = (b, x, y, radius) => b.mass ? bodyInBlast(b, { x, y, radius }) :
  Math.hypot(x - clamp(x, b.x, b.x + b.w), y - clamp(y, b.y, b.y + b.h)) <= radius;

export function resetReactions(world) {
  world.water = []; world.gas = []; world.spills = []; world.reactionSerial = 0; world.reactionClock = 0;
  world.reactionHeatAt = 0;
  if (world.arena.survival) return;

  const variants = ["barrel", "oilBarrel", "glueBarrel", "tarBarrel"];
  let barrelIndex = 0;
  for (const b of world.cover) if (b.kind === "barrel") {
    b.kind = variants[(world.arenaIndex + barrelIndex++) % variants.length];
    delete b.mass; prepareProp(b);
  }
  // Place a few readable opportunities on existing landings, outside spawns and
  // trap machinery. Layouts, routes and the opening weapon rotation stay intact.
  const floors = world.platforms.filter(p => p.w >= 290 && p.h <= 65 && p.y > 320 &&
    !p.move && !p.travel && !p.waterId && !p.destructible);
  const used = new Set();
  const kinds = ["canister", "waterTank", "canister",
    variants[world.arenaIndex % 4], variants[(world.arenaIndex + 1) % 4]];
  for (const [index, kind] of kinds.entries()) {
    const size = kind === "canister" ? [44, 72] : kind === "waterTank" ? [64, 76] : [54, 68];
    let placed = false;
    for (let n = 0; n < floors.length && !placed; n++) {
      const f = floors[(n + world.arenaIndex + index * 3) % floors.length];
      if (used.has(f.id)) continue;
      for (const fraction of [.25, .75, .5]) {
        const b = { x: f.x + f.w * fraction - size[0] / 2, y: f.y - size[1], w: size[0], h: size[1] };
        if (b.x < f.x+65 || b.x+b.w > f.x+f.w-65 ||
          world.platforms.some(p => (p.travel || p.move) && overlap(b, {
            x:p.baseX-Math.abs(p.move||0)-18, y:Math.min(p.baseY,p.baseY+(p.travel||0))-95,
            w:p.w+Math.abs(p.move||0)*2+36, h:Math.abs(p.travel||0)+p.h+105 })) ||
          world.arena.spawns.some(([x, y]) => Math.abs(x - centre(b).x) < 115 && Math.abs(y - centre(b).y) < 110) ||
          world.cover.some(c => overlap(b, bodyBounds(c), 18)) ||
          world.platforms.some(p => p !== f && p.hp !== 0 && overlap({...b,y:b.y-140,h:b.h+140}, p, 2)) ||
          world.hazards.some(h => overlap(b, hazardZone(h), 28))) continue;
        world.cover.push(prepareProp({ ...b, id: `reaction-prop${index}`, kind, hp: 85, maxHp: 85,
          ...(kind === "waterTank" ? { waterLeft: 210 } : {}) }));
        used.add(f.id); placed = true; break;
      }
    }
  }
  // Electrical fixtures can reach small existing puddles when they cycle on.
  // The puddle is safe while the fixture is off, and can be frozen or drained.
  for (const h of world.hazards.filter(h => h.type === "tesla").slice(0, 2))
    addWater(world, h.x, h.y - 3, 64);
}

// Separate finite parcels share the water solver, but preserve material identity
// and viscosity. Unaccepted liquid remains in its container at the hard limit.
export function addSpill(world, kind, x, y, amount, fire = false) {
  const type = SPILLS[kind];
  if (!type || !(amount > 0) || !Number.isFinite(x+y+amount)) return 0;
  let left = amount;
  for (let n=0; n<SPILL_LIMIT && left>.001; n++) {
    const offset=n ? Math.ceil(n/2)*(n%2?1:-1) : 0;
    const column=Math.floor(x/WATER_WIDTH)*WATER_WIDTH+offset*WATER_WIDTH;
    if(column<0||column+WATER_WIDTH>W)continue;
    if(!clear(world,{x,y:y-1},{x:column+WATER_WIDTH/2,y:y-1}))continue;
    let q=world.spills.find(q=>q.kind===kind&&q.x===column&&Math.abs(q.y+q.h-y)<12);
    if(q&&q.h>=24)continue;
    if(!q) {
      if(world.spills.length>=SPILL_LIMIT)break;
      q={id:++world.reactionSerial,kind,x:column,y,w:WATER_WIDTH,h:0,vy:0,grounded:false,
        life:type.life,fire:0,cold:0};
      world.spills.push(q);
    }
    const take=Math.min(left,24-q.h);q.h+=take;q.y-=take;left-=take;
    if(fire&&type.burn&&!q.fire&&!q.cold)q.fire=type.burn;
  }
  return amount-left;
}

// Amount is cross-sectional area divided by a column width. Transfers conserve
// it exactly, including at the admission limit. No invisible full-fluid grid.
export function addWater(world, x, y, amount) {
  if (!(amount > 0) || !Number.isFinite(x + y + amount)) return 0;
  let left = amount;
  for (let n = 0; left > .001 && n < WATER_LIMIT; n++) {
    const offset = n ? Math.ceil(n / 2) * (n % 2 ? 1 : -1) : 0;
    const column = Math.floor(x / WATER_WIDTH) * WATER_WIDTH + offset * WATER_WIDTH;
    if (column < 0 || column + WATER_WIDTH > W) continue;
    let q = world.water.find(q => q.x === column && !q.frozen && Math.abs(q.y + q.h - y) < 12);
    if (q && q.h >= 24) continue;
    if (!q) {
      if (world.water.length >= WATER_LIMIT) break;
      q = { id: ++world.reactionSerial, x: column, y, w: WATER_WIDTH, h: 0,
        vy: 0, grounded: false, frozen: 0, spark: 0, charge: 0 };
      world.water.push(q);
    }
    const take = Math.min(left, 24 - q.h);
    q.y -= take; q.h += take; left -= take;
  }
  return amount - left;
}

function wet(b, duration = 2.5) {
  b.soaked = Math.max(b.soaked || 0, duration);
  b.fire = 0;
  if (b.burn !== undefined) b.burn = 0;
  for(const k of ["glued","tarred","oiled"])if(b[k]>0)b[k]=0;
}
function ignite(b) {
  if (b.hp <= 0 || b.soaked > 0 || b.cold > 0) return;
  if (explosiveBarrel(b)) {
    armCylinder(b); b.fuse = Math.min(b.fuse, 1.35); b.fire = 1.5; return;
  }
  const contents = BARRELS[b.kind]?.contents;
  if (!b.chunk && contents && SPILLS[contents].burn && !b.spent) {
    b.liquidLeft ??= 96;
    if (b.liquidLeft > 0) { b.leak=1; b.fire=SPILLS[contents].burn; }
  }
  if (flammable(b) && !b.fire && (b.fuel === undefined || b.fuel > 0)) {
    b.fuel ??= b.chunk ? 3.5 : 8;
    b.fire = b.fuel;
  }
}
function armCylinder(b) {
  if (b.spent || b.leak > 0) return;
  b.leak = 1; b.fuse = b.kind === "barrel" ? 3 : 4.2; b.gasFuel = 3.6; b.gasAt = 0;
  // The side valve breaks away. Offset thrust and real angular inertia produce
  // a tumbling rocket instead of steering it towards a chosen fighter.
  if (b.kind === "canister") impulseProp(b, -b.mass * 180, -b.mass * 160, b.x + b.w, b.y + b.h * .7);
}

export function propReactionDamage(world, b, damage) {
  if (b.chunk) return damage;
  if (b.kind === "generator" && damage > 0) b.spark = 1.1;
  if (explosiveBarrel(b) && !b.spent && damage > 0) {
    armCylinder(b);
    if (damage >= 60) b.fuse = Math.min(b.fuse, 1.8);
    return Math.min(damage, Math.max(0, b.hp - 1));
  }
  const contents = BARRELS[b.kind]?.contents;
  if (contents && damage > 0 && !b.spent) {
    b.liquidLeft ??= 96; b.leak=1;
    if (damage >= b.hp) {
      b.liquidLeft -= addSpill(world, contents, b.x+b.w/2, b.y+b.h/2, b.liquidLeft, b.fire>0);
      if(b.liquidLeft>.01)return Math.max(0,b.hp-1);
      b.spent=true;
    }
  }
  if (b.kind === "waterTank" && damage > 0 && b.waterLeft > 0) {
    b.leak = 1;
    if (damage >= b.hp) {
      const emitted = addWater(world, b.x + b.w / 2, b.y + b.h / 2, b.waterLeft);
      b.waterLeft -= emitted;
      if (b.waterLeft > .01) return Math.max(0, b.hp - 1);
    }
  }
  return damage;
}

export function inheritReaction(parent, child) {
  if (parent.soaked) child.soaked = parent.soaked;
  if (parent.cold) child.cold = parent.cold;
  if (parent.fire && flammable(child)) {
    child.fuel = Math.min(3.5, parent.fuel || 3.5); child.fire = child.fuel;
  }
}

function freezeWater(world, q) {
  if (!q.grounded || q.h < 2 || q.frozen) return;
  q.frozen = 7; q.charge = q.spark = 0;
  world.platforms.push({ id: `water-ice${q.id}`, waterId: q.id, x: q.x, y: q.y, w: q.w, h: q.h,
    baseX: q.x, baseY: q.y, dx: 0, dy: 0, ice: true, material: "ice" });
  world.terrainVersion++;
}
function thawWater(world, q) {
  world.platforms = world.platforms.filter(p => p.waterId !== q.id);
  q.frozen = 0; q.grounded = false; world.terrainVersion++;
}

export function meltIce(world, x, y, radius = 24) {
  // Cut only actual ice, at the same circular boundary used for collision.
  // A bounded number of slices per hit prevents a flame stream creating an
  // unbounded mesh. Further hits continue cutting the surviving surface.
  let cuts = 0, water = 0;
  world.platforms = world.platforms.flatMap(p => {
    if (!ice(p) || p.hp === 0 || p.waterId || cuts >= 4 || world.platforms.length > 1400 || !near(p, x, y, radius)) return [p];
    const remains = carveRectangle(p, { x, y, radius }, () => `melt${++world.terrainSerial}`);
    if (remains[0] === p) return [p];
    cuts++;
    water += (p.w * p.h - remains.reduce((sum, r) => sum + r.w * r.h, 0)) / WATER_WIDTH;
    return remains;
  });
  if (cuts) { world.terrainVersion++; addWater(world, x, y + radius + 1, Math.min(96, water)); }
}

export function surfaceReaction(world, shot, surface) {
  const b = world.cover.find(b => b.id === (surface.propId || surface.id)) ||
    world.chunks.find(b => b.id === (surface.propId || surface.id)) || surface;
  if (shot.kind === "flame" || shot.kind === "spark") {
    ignite(b);
    if (ice(surface)) {
      const q = world.water.find(q => q.id === surface.waterId);
      if (q) thawWater(world, q); else meltIce(world, shot.x, shot.y, shot.kind === "flame" ? 23 : 14);
    }
  }
  if (shot.kind === "frost" && (b.mass || b.destructible)) { b.cold = 2.4; b.fire = 0; }
  if (shot.kind === "tesla" && conductive(b)) b.spark = .65;
}

export function reactionContacts(world, shot, x, y, ex, ey) {
  const out = [];
  if (["flame", "frost", "tesla"].includes(shot.kind))
    for (const q of world.water) if (!q.frozen && q.h >= .5) {
      const hit = segmentBox(x, y, ex, ey, q, shot.r);
      if (hit) out.push({ reaction: q, hit });
    }
  if (["flame", "spark", "plasma", "rocket", "tesla"].includes(shot.kind))
    for (const g of world.gas) if (!g.lit) {
      const hit = segmentBox(x, y, ex, ey, { x: g.x-g.r*.7, y: g.y-g.r*.7, w:g.r*1.4, h:g.r*1.4 }, shot.r);
      if (hit) out.push({ reaction: g, gas: true, hit });
    }
  if (["flame","spark","plasma","rocket","tesla","frost"].includes(shot.kind))
    for (const q of world.spills) if(q.h>=.5) {
      const hit=segmentBox(x,y,ex,ey,q,shot.r);
      if(hit)out.push({reaction:q,spill:true,hit});
    }
  return out;
}
export function contactReaction(world, shot, collision) {
  const q = collision.reaction;
  if (collision.spill) {
    if(shot.kind==="frost"){q.cold=3;q.fire=0;}
    else if(SPILLS[q.kind].burn&&!q.fire&&!q.cold)q.fire=SPILLS[q.kind].burn;
    return shot.kind==="flame"||shot.kind==="spark"||shot.kind==="frost";
  }
  if (collision.gas) { q.lit = .22; q.owner = shot.owner; return shot.kind === "flame" || shot.kind === "spark"; }
  if (shot.kind === "tesla") q.spark = .7;
  if (shot.kind === "frost") freezeWater(world, q);
  // A flame is quenched on first water contact, before it can hit a fighter
  // standing behind the stream. Cryo and Tesla spend their shot on the pool.
  return true;
}

export function explosionReaction(world, b) {
  const radius = b.radius || 145;
  if (b.nuclear) return;
  const cold = b.weapon === "cryo";
  for(const q of world.spills) if(near(q,b.x,b.y,radius)&&clear(world,b,centre(q))) {
    if(cold){q.cold=3.2;q.fire=0;}
    else if(SPILLS[q.kind].burn&&!q.fire&&!q.cold)q.fire=SPILLS[q.kind].burn;
  }
  for (const q of [...world.water]) if (near(q, b.x, b.y, radius) && clear(world, b, centre(q))) {
    if (cold) freezeWater(world, q);
    else if (q.frozen) { q.h = 0; thawWater(world, q); }
  }
  for (const c of bodies(world)) if (near(c,b.x,b.y,radius) && clear(world,b,centre(c))) {
    if (cold) { c.cold = 3.2; c.fire = 0; }
    else ignite(c);
  }
  if (cold) {
    for (const p of world.players) if (p.alive && Math.hypot(p.x-b.x,p.y-b.y)<radius && clear(world,b,p)) wet(p, 1);
  } else for (const g of world.gas)
    if (!g.lit && Math.hypot(g.x-b.x,g.y-b.y)<radius+g.r*.5 && clear(world,b,g)) { g.lit=.22; g.owner=b.owner ?? 0; }
}

function moveWater(world, dt, key = "water") {
  const parcels = world[key], spill = key === "spills", limit = spill ? SPILL_LIMIT : WATER_LIMIT;
  const cell = (q,x=q.x,y=q.y+q.h) => `${q.kind||"water"}:${x}:${Math.round(y)}`;
  const platforms = world.platforms.filter(p => p.hp !== 0);
  const existing = new Map(parcels.filter(q=>q.grounded&&!q.frozen).map(q=>[cell(q),q]));
  for (const q of [...parcels]) {
    if (q.h <= 0) continue;
    if (q.frozen) {
      const ps = platforms.filter(p=>p.waterId===q.id);
      const area = ps.reduce((sum,p)=>sum+p.w*p.h,0);
      if (Math.abs(area-q.w*q.h)>.1) { q.h=0; thawWater(world,q); continue; }
      q.frozen=Math.max(0,q.frozen-dt);
      if (!q.frozen) thawWater(world,q);
      continue;
    }
    const x=q.x+q.w/2, bottom=q.y+q.h;
    const f=platforms.filter(p=>p.waterId!==q.id&&x>p.x&&x<p.x+p.w&&p.y>=bottom-.8)
      .sort((a,b)=>a.y-b.y)[0];
    q.vy=Math.min(1000,q.vy+1000*dt);
    if (f && bottom+q.vy*dt>=f.y) { q.y=f.y-q.h; q.vy=0; q.grounded=true; }
    else { q.y+=q.vy*dt; q.grounded=false; }
    if (!q.grounded || q.h<4.1) continue;
    const floorY=q.y+q.h;
    for (const dir of [-1,1]) {
      const nx=q.x+dir*q.w;
      if(nx<0||nx+q.w>W)continue;
      let other=existing.get(cell(q,nx,floorY));
      if(other?.frozen)continue;
      const transfer=Math.min(5,Math.max(0,(q.h-(other?.h||0)-2)*.22)) * (spill ? SPILLS[q.kind].flow : 1);
      if(transfer<.2)continue;
      const a={x:q.x+q.w/2,y:floorY-Math.min(q.h,other?.h||q.h)/2};
      const b={x:nx+q.w/2,y:a.y};
      if(platforms.some(p=>segmentBox(a.x,a.y,b.x,b.y,p)))continue;
      if(!other) {
        if(parcels.length>=limit)continue;
        other={id:++world.reactionSerial,x:nx,y:floorY,w:q.w,h:0,vy:0,grounded:false,
          ...(spill ? {kind:q.kind,life:q.life,fire:q.fire,cold:q.cold} : {frozen:0,spark:0,charge:0})};
        parcels.push(other);existing.set(cell(q,nx,floorY),other);
      }
      q.h-=transfer;q.y+=transfer;other.h+=transfer;other.y-=transfer;
    }
  }
  // Falling parcels merge on landing. This also prevents a broken tank from
  // accumulating hundreds of overlapping packets on the same floor.
  const merged=new Map();
  for(const q of parcels) if(q.grounded&&!q.frozen&&q.h>0) {
    const key=cell(q), old=merged.get(key);
    if(old&&old.h+q.h<=48){
      old.h+=q.h;old.y-=q.h;
      if(spill){old.fire=Math.max(old.fire,q.fire);old.life=Math.min(old.life,q.life);old.cold=Math.max(old.cold,q.cold);}
      else old.spark=Math.max(old.spark,q.spark);
      q.h=0;
    }
    else merged.set(key,q);
  }
  world[key]=parcels.filter(q=>q.h>.05&&q.y<H+80);
}

function conduction(world, dt) {
  const nodes=conductorNodes(world);
  const boxes=nodes.map(conductorBounds), live=new Set(), queue=[];
  for(let i=0;i<nodes.length;i++) {
    const b=nodes[i]; b.spark=Math.max(0,(b.spark||0)-dt);b.charge=0;
    const powered=b.spark>0||world.hazards.some(h=>h.type==="tesla"&&h.active&&!h.done&&overlap(boxes[i],hazardZone(h),2));
    if(powered){live.add(i);queue.push(i);}
  }
  // No propagated stored charge: breaking a metal contact or draining a gap
  // removes the circuit immediately, even if the source is still powered.
  for(let n=0;n<queue.length;n++) {
    const i=queue[n];nodes[i].charge=1;
    for(let j=0;j<nodes.length;j++)if(!live.has(j)&&conductorsTouch(nodes[i],nodes[j],world.platforms,boxes[i],boxes[j])){
      live.add(j);queue.push(j);
    }
  }
  for(const g of world.gas)if(!g.lit&&queue.some(i=>near(nodes[i],g.x,g.y,g.r*.65)&&clear(world,g,centre(nodes[i]))))g.lit=.22;
  for(const p of world.players) {
    p.shockWait=Math.max(0,(p.shockWait||0)-dt);
    if(!p.alive||p.shockWait>0)continue;
    const box=playerBox(p), i=queue.find(i=>overlap(box,boxes[i],3));
    if(i===undefined)continue;
    p.shockWait=.48;p.xray=.3;
    const from=centre(nodes[i]);
    world.hit(p,{...from,vx:0,vy:0},p.soaked>0?24:16,230,Math.sign(p.x-from.x)||1,-.45,
      {blast:true,effect:"tesla",cause:"electrified",stun:.15,hitstop:.006});
  }
}

function containers(world, dt, bs) {
  for(const b of bs) {
    if(b.chunk||!b.leak)continue;
    if(b.kind==="waterTank"&&b.waterLeft>0) {
      if(b.cold>0)continue;
      const x=b.x+b.w/2,y=b.y+b.h*.65;
      b.waterLeft-=addWater(world,x,y,Math.min(b.waterLeft,55*dt));
      continue;
    }
    const contents=BARRELS[b.kind]?.contents;
    if(contents) {
      if(b.cold>0||b.spent)continue;
      b.liquidLeft-=addSpill(world,contents,b.x+b.w/2,b.y+b.h*.65,
        Math.min(b.liquidLeft,32*dt),b.fire>0);
      if(b.liquidLeft<.01){b.leak=0;b.fire=0;b.spent=true;}
      continue;
    }
    if(!explosiveBarrel(b)||b.spent||b.cold>0)continue;
    if(world.time>=(b.hissAt||0)){
      b.hissAt=world.time+.9;world.event("hazard",{...centre(b),kind:"leak",urgent:b.fuse<1.5});
    }
    b.fuse=Math.max(0,b.fuse-dt);b.gasFuel=Math.max(0,b.gasFuel-dt);
    const a=(b.angle||0)+.45, dx=Math.cos(a),dy=Math.sin(a);
    if(b.kind==="canister"&&b.gasFuel>0) {
      impulseProp(b,-dx*b.mass*650*dt,-dy*b.mass*650*dt,b.x+b.w*.9,b.y+b.h*.72);
      b.gasAt=(b.gasAt||0)-dt;
      if(b.gasAt<=0&&world.gas.length<GAS_LIMIT) {
        b.gasAt=.3;
        world.gas.push({id:++world.reactionSerial,x:b.x+b.w/2+dx*30,y:b.y+b.h/2+dy*30,
          vx:b.vx*.15+dx*45,vy:b.vy*.15+dy*45-12,r:22,life:3.2,lit:0,owner:0});
      }
    }
    if(b.fuse<=0) {
      b.spent=true;b.fire=0;b.leak=0;b.hp=0;world.terrainVersion++;
      const p=centre(b);
      world.explode({...p,kind:"grenade",weapon:b.kind,owner:0,
        radius:b.kind==="barrel"?210:185,damage:125,force:1350});
      // Fracture after the pressure blast so the canister's own blast does not
      // immediately delete its casing. Its metal pieces retain incoming spin
      // and receive an outward impulse through the normal physical-body solver.
      const serial=world.chunkSerial;
      fractureProp(world,b);
      for(const c of world.chunks)if(Number(c.id.slice(5))>serial) {
        const q=centre(c),dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1;
        impulseProp(c,dx/d*c.mass*430,(dy/d*430-90)*c.mass);
      }
      world.event("break",{...p,color:"#ef916b"});
    }
  }
}

function updateSpills(world, dt, bs, ps) {
  for(const q of world.spills) {
    q.life=Math.max(0,q.life-dt);q.cold=Math.max(0,q.cold-dt);
    const touchingWater=world.water.some(w=>!w.frozen&&overlap(q,w,2));
    if(touchingWater){
      q.fire=0;q.cold=.25;
      if(q.kind==="glue") {const wash=Math.min(q.h,dt*12);q.h-=wash;q.y+=wash;}
    }
    if(!q.life||q.h<=.05){q.h=0;continue;}
    const origin=centre(q), heated=SPILLS[q.kind].burn&&!q.cold;
    if(heated&&!q.fire && (
      bs.some(b=>b.fire>0&&overlap(bodyBounds(b),q,10)&&clear(world,centre(b),origin)) ||
      ps.some(p=>p.burn>0&&overlap(playerBox(p),q,5)&&clear(world,p,origin)) ||
      world.hazards.some(h=>h.type==="geyser"&&h.active&&!h.done&&overlap(q,hazardZone(h)))
    ))q.fire=SPILLS[q.kind].burn;
    for(const p of ps)if(!(p.soaked>0)&&overlap(playerBox(p),q,2)) {
      const key=q.kind==="oil"?"oiled":q.kind==="glue"?"glued":"tarred";
      p[key]=Math.max(p[key]||0,q.kind==="glue"?.55:q.kind==="tar"?.8:.3);
    }
    if(!q.fire)continue;
    // Consume the actual finite spill volume, so extinguished/re-lit puddles
    // cannot create new fuel. Flames only reach through open space.
    const used=q.h*Math.min(1,dt/q.fire);q.h-=used;q.y+=used;q.fire=Math.max(0,q.fire-dt);
    for(const other of world.spills)if(other!==q&&!other.fire&&!other.cold&&SPILLS[other.kind].burn&&
      overlap(q,other,5)&&clear(world,origin,centre(other)))other.fire=SPILLS[other.kind].burn;
    for(const b of bs)if(overlap(bodyBounds(b),q,10)&&clear(world,origin,centre(b)))ignite(b);
    for(const p of ps)if(overlap(playerBox(p),q,16)&&clear(world,origin,p))igniteFighter(p);
    for(const g of world.gas)if(!g.lit&&near(q,g.x,g.y,g.r)&&clear(world,origin,g))g.lit=.22;
  }
  world.spills=world.spills.filter(q=>q.h>.05&&q.life>0);
}

export function updateReactions(world, dt) {
  if(world.phase!=="fight"||dt<=0)return;
  world.reactionClock+=dt;
  if(world.reactionClock<.05-1e-8)return;
  dt=Math.min(.075,world.reactionClock);world.reactionClock=0;
  moveWater(world,dt);
  moveWater(world,dt,"spills");
  const bs=bodies(world), ps=world.players.filter(p=>p.alive);
  for(const b of [...bs,...ps]) {
    b.soaked=Math.max(0,(b.soaked||0)-dt);b.cold=Math.max(0,(b.cold||0)-dt);
    for(const k of ["glued","tarred","oiled"])if(b[k]>0)b[k]=Math.max(0,b[k]-dt);
    const box=b.mass?bodyBounds(b):playerBox(b);
    if(world.water.some(q=>!q.frozen&&q.h>=.5&&overlap(box,q,2)))wet(b);
  }
  containers(world,dt,bs);
  updateSpills(world,dt,bs,ps);
  // Flames are attached to actual bodies and their fragments. Contact spreads
  // ignition; finite fuel and water stop it. No map-wide fire damage field.
  const burning=[...bs,...world.platforms.filter(p=>p.destructible&&!p.wreckId)].filter(b=>b.fire>0&&b.hp>0);
  for(const b of burning) {
    if(explosiveBarrel(b)||(!b.chunk&&BARRELS[b.kind]?.contents))continue;
    b.fuel=Math.max(0,(b.fuel||0)-dt);b.fire=b.fuel;
    const box=bodyBounds(b), origin=centre(b);
    for(const c of bs)if(c!==b&&overlap(box,bodyBounds(c),9))ignite(c);
    for(const p of ps)if(overlap(playerBox(p),box,13)&&clear(world,origin,p))igniteFighter(p);
    for(const g of world.gas)if(!g.lit&&Math.hypot(g.x-origin.x,g.y-origin.y)<g.r+Math.max(b.w,b.h)/2)g.lit=.22;
    b.burnTick=(b.burnTick||0)+dt;
    if(b.burnTick>=.4-1e-8){world.damageCover(b,b.burnTick*(b.chunk?8:12));b.burnTick=0;}
  }
  if(world.time>=world.reactionHeatAt) {
    world.reactionHeatAt=world.time+.25;
    for(const b of burning.slice(0,12)) {const p=centre(b);meltIce(world,p.x,b.y+b.h,Math.min(36,b.w/2));}
    for(const h of world.hazards)if(h.type==="geyser"&&h.active&&!h.done) {
      const z=hazardZone(h);
      for(const b of bs)if(overlap(bodyBounds(b),z))ignite(b);
      meltIce(world,h.x,h.y-5,30);
    }
    for(const h of world.hazards)if(h.type==="frost"&&h.active&&!h.done) {
      const z=hazardZone(h),origin={x:h.x,y:h.y-3};
      for(const q of world.water)if(overlap(q,z)&&clear(world,origin,centre(q)))freezeWater(world,q);
      for(const b of bs)if(overlap(bodyBounds(b),z)&&clear(world,origin,centre(b))){b.cold=1.5;b.fire=0;}
    }
  }
  for(const g of world.gas) {
    g.life-=dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.vx*=.96;g.r=Math.min(62,g.r+dt*14);
    if(g.lit>0) {g.lit=Math.max(0,g.lit-dt);if(!g.lit&&g.life>0){g.life=0;
      world.explode({x:g.x,y:g.y,kind:"grenade",weapon:"gas",owner:g.owner,radius:g.r+28,damage:38,force:480});}}
  }
  world.gas=world.gas.filter(g=>g.life>0&&g.y>-100&&g.y<H+100&&g.x>-100&&g.x<W+100);
  conduction(world,dt);
}

export function consumeReactionArea(world, blast) {
  for(const q of world.water)if(near(q,blast.x,blast.y,blast.radius)){
    if(q.frozen)thawWater(world,q);q.h=0;
  }
  world.water=world.water.filter(q=>q.h>0);
  world.spills=world.spills.filter(q=>!near(q,blast.x,blast.y,blast.radius));
  world.gas=world.gas.filter(g=>Math.hypot(g.x-blast.x,g.y-blast.y)>blast.radius+g.r);
}

export function reactionDanger(world, x, y) {
  return world.water.some(q=>q.charge&&!q.frozen&&overlap({x:x-18,y:y-28,w:36,h:60},q,6)) ||
    world.spills.some(q=>q.fire>0&&near(q,x,y,65)) ||
    world.cover.some(b=>b.hp>0&&((explosiveBarrel(b)&&b.leak&&!b.cold&&b.fuse<1.5&&Math.hypot(x-centre(b).x,y-centre(b).y)<230)||
      (b.fire&&near(b,x,y,65))));
}

const number=(n,min,max)=>typeof n==="number"&&Number.isFinite(n)&&n>=min&&n<=max;
export function validReactionObject(b) {
  return ["soaked","cold","fire","fuel","spark","charge","leak","fuse","gasFuel","waterLeft","liquidLeft","glued","tarred","oiled"].every(k=>
    b[k]===undefined||number(b[k],0,k==="waterLeft"?210:k==="liquidLeft"?96:k==="charge"||k==="leak"||["glued","tarred","oiled"].includes(k)?1:12)) &&
    (b.spent===undefined||typeof b.spent==="boolean");
}
export function validReactions(s) {
  return Array.isArray(s.spills)&&s.spills.length<=SPILL_LIMIT&&s.spills.every(q=>
    q&&Object.hasOwn(SPILLS,q.kind)&&Number.isInteger(q.id)&&q.id>0&&q.id<=10000000&&
    number(q.x,0,W-WATER_WIDTH)&&number(q.y,-200,H+150)&&q.w===WATER_WIDTH&&number(q.h,.01,48)&&
    number(q.vy,0,1000)&&typeof q.grounded==="boolean"&&number(q.life,0,SPILLS[q.kind].life)&&
    number(q.fire,0,SPILLS[q.kind].burn)&&number(q.cold,0,3.2))&&
    Array.isArray(s.water)&&s.water.length<=WATER_LIMIT&&s.water.every(q=>
    Number.isInteger(q.id)&&q.id>0&&q.id<=10000000&&number(q.x,0,W-WATER_WIDTH)&&number(q.y,-200,H+150)&&
    q.w===WATER_WIDTH&&number(q.h,.01,48)&&number(q.vy,0,1000)&&typeof q.grounded==="boolean"&&
    number(q.frozen,0,7)&&validReactionObject(q))&&new Set(s.water.map(q=>q.id)).size===s.water.length&&
    Array.isArray(s.gas)&&s.gas.length<=GAS_LIMIT&&s.gas.every(g=>Number.isInteger(g.id)&&g.id>0&&
    number(g.x,-200,W+200)&&number(g.y,-200,H+400)&&number(g.vx,-500,500)&&number(g.vy,-500,500)&&
    number(g.r,1,62)&&number(g.life,0,3.2)&&number(g.lit,0,.22)&&Number.isInteger(g.owner)&&g.owner>=0&&g.owner<=3)&&
    new Set([...s.water,...s.gas,...s.spills].map(q=>q.id)).size===s.water.length+s.gas.length+s.spills.length;
}
