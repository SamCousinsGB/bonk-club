import { W, H } from './scale.js';
import { segmentBox } from './collision.js';
import { botDanger } from './bot-danger.js';
import { reactionDanger } from './reactions.js';
import { shipSunk } from './ship.js';

export const GAME_MODES = { elimination: 'Elimination', crown: 'Crown' };
export const CROWN_TARGET = 30;
export const CROWN_RESPAWN = 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Use surviving collision, including wires and moving decks. Spawn candidates
// need standing headroom and cannot be inside a hazard, liquid or another prop.
export function crownSpawns(world) {
  const solids = world.solids();
  return solids.filter(s => s.hp !== 0 && !s.lethal && !s.chunk && s.w >= 48 &&
    s.y > 80 && s.y < H - 45 && s.x + s.w > 35 && s.x < W - 35)
    .flatMap(s => [...new Set([clamp(W / 2, s.x + 24, s.x + s.w - 24), s.x + 24, s.x + s.w - 24])]
      .map(x => ({ x: clamp(x, 35, W - 35), y: s.y - 31, support: s.id })))
    .filter(q => !solids.some(s => s.id !== q.support && s.hp !== 0 &&
      q.x + 17 > s.x && q.x - 17 < s.x + s.w && q.y + 29 > s.y && q.y - 34 < s.y + s.h) &&
      !world.spikes().some(s => q.x > s.x - 24 && q.x < s.x + s.w + 24 && Math.abs(q.y + 31 - s.y) < 45));
}

const unsafe = (w, p) => botDanger(w.hazards, p.x, p.y) || reactionDanger(w, p.x, p.y) ||
  w.fields.some(f => f.kind === 'blackhole' && Math.hypot(p.x-f.x,p.y-f.y) < f.radius + 40);

export function centreCrown(world) {
  const c = world.crown;
  if (!c) return;
  const solids=world.solids();
  const central=solids.filter(s=>s.hp!==0&&!s.lethal&&s.x<=W/2&&s.x+s.w>=W/2&&s.y>80&&s.y<H-45)
    .map(s=>({x:W/2,y:s.y-31,support:s.id}))
    .filter(q=>!solids.some(s=>s.id!==q.support&&s.hp!==0&&q.x+17>s.x&&q.x-17<s.x+s.w&&
      q.y+29>s.y&&q.y-34<s.y+s.h));
  const points = crownSpawns(world);
  points.sort((a,b) => Math.abs(a.x-W/2)*4 + Math.abs(a.y-H/2) -
    Math.abs(b.x-W/2)*4 - Math.abs(b.y-H/2));
  // Prefer a platform actually under the middle, rather than projecting a
  // nearby ledge's height out over a void where bots cannot collect the crown.
  central.sort((a,b)=>Math.abs(a.y-H/2)-Math.abs(b.y-H/2));
  const q = central[0] || points[0];
  Object.assign(c, { holder: null, x: q?.x ?? W/2, y: q ? q.y - 6 : H/2, vx: 0, vy: 0,
    loose: false, age: 0, lock: .25 });
}

export function resetCrown(world) {
  world.crown = world.mode === 'crown' ? { holder: null, x: W/2, y: H/2, vx:0, vy:0,
    loose:false, age:0, lock:0, times:[0,0,0,0], respawn:[0,0,0,0] } : null;
  centreCrown(world);
}

export function dropCrown(world, p) {
  const c = world.crown;
  if (!c || c.holder !== p.id) return;
  Object.assign(c, { holder:null, x:p.x, y:p.y-28, vx:clamp(p.vx*.45,-600,600),
    vy:Math.min(-160,p.vy*.35), loose:true, age:0, lock:.35 });
  world.event('crown-drop', {x:c.x,y:c.y});
}

export function crownDeath(world, p) {
  if (!world.crown) return;
  dropCrown(world,p);
  if(world.phase === 'fight')world.crown.respawn[p.id] = CROWN_RESPAWN;
}

export function clearCrownPlayer(world, p) {
  if (!world.crown || !p) return;
  dropCrown(world,p);
  world.crown.times[p.id] = 0;
  world.crown.respawn[p.id] = 0;
}

export function respawnCrownPlayers(world, dt) {
  const c = world.crown;
  if (!c || world.phase !== 'fight') return;
  let points;
  for (let index=0;index<world.players.length;index++) {
    const old = world.players[index];
    if (old.alive) continue;
    c.respawn[old.id] = Math.max(0,c.respawn[old.id]-dt);
    if (c.respawn[old.id] > 0) continue;
    points ||= shipSunk(world) ? [] : crownSpawns(world);
    const options = points.filter(q => !unsafe(world,q));
    const enemies = world.players.filter(p=>p.alive);
    options.sort((a,b) => {
      const score = q => Math.min(900,...enemies.map(p=>Math.hypot(q.x-p.x,q.y-p.y))) -
        Math.hypot(q.x-world.arena.spawns[old.id][0],q.y-world.arena.spawns[old.id][1])*.08;
      return score(b)-score(a);
    });
    if (!options[0]) continue; // Wait for a hazard's safe phase instead of spawning into it.
    const p = world.makePlayer(old.id);
    Object.assign(p, options[0], {lifeId:old.lifeId+1});
    world.players[index] = p;
    world.ai.forget(p.id);
    world.event('respawn', {x:p.x,y:p.y});
  }
  // A fully destroyed or sunk arena cannot sustain infinite respawns. Rebuild
  // that arena only after everyone is waiting, preserving possession and wins.
  if (world.players.every(p=>!p.alive && c.respawn[p.id]===0) &&
      (!points?.length || shipSunk(world))) {
    const times=[...c.times], lives=new Map(world.players.map(p=>[p.id,p.lifeId]));
    world.startRound();
    world.crown.times=times;
    for(const p of world.players)p.lifeId=lives.get(p.id)+1;
  }
}

export function updateCrown(world, dt) {
  const c=world.crown;
  if (!c || world.phase !== 'fight') return;
  c.lock=Math.max(0,c.lock-dt);
  const holder=world.players.find(p=>p.id===c.holder && p.alive);
  if (holder) {
    c.x=holder.x; c.y=holder.y-38;
    c.times[holder.id]=Math.min(CROWN_TARGET,c.times[holder.id]+dt);
    if (c.times[holder.id]>=CROWN_TARGET-1e-8) {
      c.times[holder.id]=CROWN_TARGET;
      world.winner=holder.id; world.victoryCause=null; world.scores[holder.id]++;
      world.phase='result'; world.phaseTime=3.5;
      world.event('round',{winner:holder.id});
    }
    return;
  }
  if(c.holder!==null)centreCrown(world);
  c.age+=dt;
  if(c.loose) {
    const oldX=c.x,oldY=c.y; c.vy+=1100*dt;
    const endX=c.x+c.vx*dt,endY=c.y+c.vy*dt;
    let contact=null;
    for(const s of world.solids()) {
      if(s.lethal || s.hp===0 || s.oneWay&&(c.vy<=0||oldY+12>s.y+2))continue;
      const hit=segmentBox(oldX,oldY,endX,endY,s,12);
      if(hit&&(!contact||hit.t<contact.t))contact={...hit,s};
    }
    c.x=endX;c.y=endY;
    if(contact) {
      c.x=oldX+(endX-oldX)*contact.t+contact.nx*.1;
      c.y=oldY+(endY-oldY)*contact.t+contact.ny*.1;
      if(contact.nx)c.vx*=-.25;
      if(contact.ny) {
        c.vy=0;c.vx*=Math.exp(-dt*10);
        if(contact.ny<0){c.x+=contact.s.dx||0;c.y+=contact.s.dy||0;}
      }
    }
  }
  if(c.x<0 || c.x>W || c.y>H || c.y<0 || c.loose && c.age>8 ||
      !c.loose && c.age>8 && !world.solids().some(s=>!s.lethal&&s.hp!==0&&
        c.x>s.x-90&&c.x<s.x+s.w+90&&s.y>c.y&&s.y<c.y+180))centreCrown(world);
  if(c.lock>0)return;
  const candidates=world.players.filter(p=>p.alive && !p.capturedBy &&
    Math.hypot(p.x-c.x,p.y-12-c.y)<48 &&
    !world.solids().some(s=>segmentBox(p.x,p.y-12,c.x,c.y,s)))
    .sort((a,b)=>Math.hypot(a.x-c.x,a.y-12-c.y)-Math.hypot(b.x-c.x,b.y-12-c.y) || a.id-b.id);
  if(candidates[0]) {
    c.holder=candidates[0].id; c.vx=0; c.vy=0; c.loose=false;
    world.event('pickup',{x:c.x,y:c.y,color:'#ffe58b'});
  }
}

export function validCrown(state) {
  if (!Object.hasOwn(GAME_MODES,state.mode)) return false;
  const c=state.crown;
  if(state.mode!=='crown')return c===null;
  const bounded=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
  return !!c && [c.x,c.y,c.vx,c.vy].every(n=>bounded(n,-100000,100000)) &&
    typeof c.loose==='boolean' && bounded(c.age,0,1e9) && bounded(c.lock,0,.36) &&
    Array.isArray(c.times) && c.times.length===4 && c.times.every(n=>bounded(n,0,CROWN_TARGET)) &&
    Array.isArray(c.respawn) && c.respawn.length===4 && c.respawn.every(n=>bounded(n,0,CROWN_RESPAWN)) &&
    (c.holder===null || Number.isInteger(c.holder) && Array.isArray(state.players) && state.players.some(p=>p?.id===c.holder&&p.alive));
}
