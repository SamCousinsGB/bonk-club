import { furnaceFault, furnaceFeed } from './furnace-parts.js';
import { powerlineCircuit } from './powerline-circuit.js';
import { playerBox, segmentBox } from "./collision.js";
import { FURNACE_CYCLE, FURNACE_ON, FURNACE_WARNING, FURNACE_COOLING } from "./furnace-arena.js";

export function furnaceHeat(h) {
  if (!h || h.done) return 0;
  if (h.active) return 1;
  if(h.type==="furnace"&&h.furnaceFault>0)return h.furnaceCooling / FURNACE_COOLING;
  const phase = (h.age + 1e-9) % FURNACE_CYCLE;
  return h.age + 1e-9 >= FURNACE_CYCLE && phase < FURNACE_COOLING
    ? 1 - phase / FURNACE_COOLING : 0;
}

export function updateFurnace(world, h, dt) {
  if(world.prediction)return;
  // Slag can drain through a destroyed trough; the furnace is now a collection
  // of independently damaged parts, never a single removable fixture.
  if(h.type==='slag'&&!world.platforms.some(p=>p.hp!==0&&!p.wreckId&&Math.abs(p.y-h.y)<2&&p.x<=h.x&&p.x+p.w>=h.x)) {
    h.done=true;h.active=false;h.warning=0;return;
  }
  h.age += dt;
  const oldActive=h.active,phase=(h.age+1e-9)%FURNACE_CYCLE;
  if(h.type==='furnace') {
    const fault=furnaceFault(world,h);
    if(fault>0&&h.furnaceFault===0) {
      // First damage accelerates the next warning, but never skips it.
      h.furnaceLeft=Math.min(h.furnaceLeft,h.furnaceStage===0?1.5:h.furnaceLeft);
      h.furnaceSpan=h.furnaceLeft;
    }
    h.furnaceFault=Math.max(h.furnaceFault,fault);
    h.furnaceLanes=[0,1,2].map(i=>furnaceFeed(world,i));
    if(h.furnaceFault>0) {
      h.furnaceCooling=Math.max(0,h.furnaceCooling-dt);
      h.furnaceLeft-=dt;
      while(h.furnaceLeft<=1e-9) {
        h.furnaceStage=(h.furnaceStage+1)%3;
        if(h.furnaceStage===0){h.furnaceCycle++;h.furnaceCooling=FURNACE_COOLING;}
        const n=Math.sin((h.furnaceCycle+1)*91.7+h.id*31+h.furnaceStage*17.3)*43758.5453;
        const jitter=n-Math.floor(n),severity=h.furnaceFault;
        // Irregular but telegraphed restarts and short violent discharges.
        h.furnaceSpan=h.furnaceStage===0?Math.max(.8,6-severity*4+jitter*2):
          h.furnaceStage===1?1.2:1.3+jitter*3.7;
        h.furnaceLeft+=h.furnaceSpan;
      }
      h.active=h.furnaceStage===2;
      h.warning=h.furnaceStage===1?h.furnaceLeft:0;
      h.duration=h.active?h.furnaceLeft:0;
      h.cooldown=h.active?0:h.furnaceLeft;
    } else {
      h.active=phase>=FURNACE_ON;
      h.warning=!h.active&&phase>=FURNACE_WARNING?FURNACE_ON-phase:0;
      h.duration=h.active?FURNACE_CYCLE-phase:0;h.cooldown=h.active?0:FURNACE_ON-phase;
      h.furnaceStage=h.active?2:h.warning>0?1:0;
      h.furnaceLeft=h.active?h.duration:h.warning>0?h.warning:FURNACE_WARNING-phase;
      h.furnaceSpan=h.active?5:h.warning>0?2:9;
      h.furnaceCycle=Math.floor((h.age+1e-9)/FURNACE_CYCLE);
      h.furnaceCooling=h.age>=16?Math.max(0,FURNACE_COOLING-phase):0;
    }
    const runs=powerlineCircuit(world).runs.filter(r=>r.cable.startsWith('furnace')&&r.powered);
    h.wireHitTimer=(h.wireHitTimer||0)-dt;
    if(h.wireHitTimer<=0){h.wireHitIds=[];h.wireHitTimer=.8;}
    for(const p of world.players) {
      if(!p.alive||h.wireHitIds?.includes(p.id))continue;
      const box=playerBox(p);
      const contact=runs.some(r=>r.points.some((q,i)=>i&&segmentBox(r.points[i-1].x,r.points[i-1].y,q.x,q.y,box,7)));
      if(contact){(h.wireHitIds||=[]).push(p.id);world.hit(p,{x:p.x,y:p.y+15,vx:0,vy:0},70,650,h.dir,-.8,
        {blast:true,effect:'tesla',cause:'electrified',stun:.18,hitstop:.012});}
    }
  } else {h.active=true;h.warning=0;h.duration=0;h.cooldown=0;}
  if (h.active !== oldActive) {
    h.hitIds = []; h.hitTimer = 0;
    if (h.active && h.type === "furnace") world.event("hazard", { x: h.x, y: h.y, kind: "tesla" });
  }
  if (world.prediction) return;
  const heat = furnaceHeat(h);
  if (!h.active && heat <= 0) return;
  h.hitTimer -= dt;
  if (h.hitTimer <= 0) { h.hitIds = []; h.hitTimer = .5; }
  for (const p of world.players) {
    if (!p.alive || h.hitIds.includes(p.id)) continue;
    const b = playerBox(p), top = h.active ? h.y - h.h : h.y - 15;
    if (b.x + b.w <= h.x - h.w / 2 || b.x >= h.x + h.w / 2 ||
        b.y + b.h <= top || b.y >= h.y + (h.type === "furnace" && h.active ? 420 : 0)) continue;
    if(h.type==="furnace"&&h.active&&!h.furnaceLanes.some((on,i)=>on&&b.x+b.w>h.x-230+i*(460/3)&&b.x<h.x-230+(i+1)*(460/3)))continue;
    h.hitIds.push(p.id);
    const arc = h.type === "furnace" && h.active;
    world.hit(p, { x: h.x, y: h.y, vx: 0, vy: 0 }, h.active ? 1000 : 6,
      h.active ? 900 : 0, Math.sign(p.x - h.x) || h.dir, -.65,
      { blast: true, effect: arc ? "tesla" : "burn", cause: arc ? "electrified" : "burn",
        hitstop: arc ? .012 : 0 });
  }
}
