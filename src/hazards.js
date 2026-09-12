import { playerBox, segmentBox } from "./collision.js";
import { carryImpulse } from "./impact.js";
import { breakable } from "./maps.js";
import { hazardProps, propFor, impulseProp } from "./props.js";
import { isScanner, scanFighters } from "./scanner.js";
import { releaseCargo } from "./cargo.js";
import { updatePowerline } from "./powerlines.js";
export const HAZARD_TYPES=["geyser","conveyor","pendulum","crusher","tesla","saw","xray","magnet","steam","frost","spores","loader","powerline"];
export const HAZARD_LABELS={geyser:"Flame vent",conveyor:"Conveyor",pendulum:"Spike ball",crusher:"Crusher",tesla:"Electrical trap",saw:"Saw rail",xray:"X-ray scanner",magnet:"Magnetic scanner",steam:"Hot geyser",frost:"Coolant vent",spores:"Spore plant",loader:"Cargo outlet",powerline:"Power lines"};
const overlap=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;

export function createHazards(world) {
  return (world.arena.traps||[]).map((h,i)=>({
    ...h,id:i+1,bodyX:h.type==="saw"?h.x+Math.sin(h.motionPhase||0)*(h.w/2-28):h.x,bodyY:h.type==="saw"?h.y-28:h.type==="pendulum"?h.y-35:h.y-h.h+24,vy:0,age:0,
    warning:0,duration:1.25,cooldown:3.5+i*.75,active:false,
    done:false,hitIds:[],hitTimer:0,...(h.type==="powerline"?{circuit:h.circuit??0}:{}),
    ...(h.type === "loader" ? {cooldown: 3.5} : {}),
    ...(world.arena.survival && h.type === "conveyor" ? {cooldown: 0} : {}),
  }));
}
export function hazardZone(h) {
  if(h.type==="pendulum"||h.type==="saw") {
    const r=h.type==="pendulum"?32:25;
    return {x:h.bodyX-r,y:h.bodyY-r,w:r*2,h:r*2};
  }
  if(h.type==="crusher")return {x:h.x-h.w/2,y:h.bodyY-22,w:h.w,h:44};
  return {x:h.x-h.w/2,y:h.y-h.h,w:h.w,h:h.h};
}
export function dangerous(h) { return !h.done&&(h.active||h.warning>0); }
function hit(world,p,h,damage,force=600) {
  const effect={saw:"slice",tesla:"tesla",geyser:"burn",crusher:"blast",frost:"ice"}[h.type]||null;
  world.hit(p,{x:h.bodyX,y:h.bodyY,vx:0,vy:0},damage,force,Math.sign(p.x-h.bodyX)||h.dir,-.55,{blast:true,hitstop:.018,cause:h.type==="geyser"?"burn":h.type,execute:h.type==="saw",effect});
}
function magneticPull(world,h,zone,dt) {
  const visible=p=>!world.platforms.some(s=>s.hp!==0&&segmentBox(h.x,h.y-65,p.x,p.y,s));
  const pull=p=>Math.max(-650,Math.min(650,(h.x-p.x)*6))*dt;
  for(const p of world.players)if(p.alive&&p.weapon&&overlap(playerBox(p),zone)&&visible(p)) {
    p.vx+=pull(p);carryImpulse(p,.15);
  }
  for(const d of world.drops)if(overlap({x:d.x-7,y:d.y-7,w:14,h:14},zone)&&visible(d))d.vx+=pull(d)*2;
  for(const b of [...world.cover,...world.chunks]) {
    const p={x:b.x+b.w/2,y:b.y+b.h/2};
    if(b.hp>0&&b.material==="metal"&&overlap(b,zone)&&visible(p))impulseProp(b,pull(p)*b.mass*1.5,0);
  }
}
export function updateHazards(world,dt) {
  if(world.phase!=="fight")return;
  for(const h of world.hazards) {
    if(h.done)continue;
    if(h.type==="powerline"){updatePowerline(world,h,dt);continue;}
    // The renderer breaks the casing apart when this fixture loses its mounting.
    if(!world.platforms.some(p=>p.hp!==0&&Math.abs(p.y-h.y)<2&&p.x<=h.x&&p.x+p.w>=h.x)) {
      h.done=true;h.active=false;h.warning=0;continue;
    }
    h.age+=dt;h.hitTimer-=dt;
    if(h.hitTimer<=0){h.hitIds=[];h.hitTimer=.8;}
    const mechanical=["conveyor","pendulum","saw"].includes(h.type);
    if(world.arena.survival?.kind === "press" && h.type === "crusher") {
      // Neighbouring lanes alternate, with a full 1.4 seconds of visible warning.
      const t = ((h.age - 3 + (h.id % 2 ? 0 : 3.2)) % 6.4 + 6.4) % 6.4;
      const wasActive = h.active;
      h.warning = h.age >= 3 && t < 1.4 ? 1.4 - t : 0;
      h.active = h.age >= 3 && t >= 1.4 && t < 2.25;
      if (h.active && !wasActive) { h.hitIds = []; world.event("hazard", {x:h.x,y:h.y,kind:h.type}); }
      if (!h.active) h.bodyY = Math.max(h.y - h.h + 22, h.bodyY - 300 * dt);
    }else if(mechanical) {
      if(h.type==="saw"&&h.motionSpeed) {
        h.bodyX=h.x+Math.sin(h.age*h.motionSpeed+(h.motionPhase||0))*(h.w/2-28);
      }
      if(h.cooldown>0){h.cooldown=Math.max(0,h.cooldown-dt);h.warning=h.cooldown<1?h.cooldown:0;continue;}
      h.warning=0;
      h.active=true;
      if(h.type==="pendulum") {
        const angle=Math.sin(h.age*1.8)*.85,length=h.h-35;
        h.bodyX=h.x+Math.sin(angle)*length;
        h.bodyY=h.y-h.h+Math.cos(angle)*length;
      }else if(h.type==="saw") {
        h.bodyX=h.x+Math.sin(h.age*(h.motionSpeed ?? 1.65)+(h.motionPhase || 0))*(h.w/2-28);h.bodyY=h.y-28;
      }
    }else if(h.active) {
      h.duration-=dt;
      if(h.duration<=0){h.active=false;h.cooldown=(h.type === "loader" ? 1.7 : 2.5)+world.random()*(h.type === "loader" ? .8 : 3);h.hitIds=[];continue;}
    }else if(h.warning>0) {
      h.warning=Math.max(0,h.warning-dt);
      if(h.warning===0){h.active=true;h.duration=h.type==="loader"?.25:h.type==="crusher"?1.1:1.35;h.hitIds=[];world.event("hazard",{x:h.x,y:h.y,kind:h.type});if(h.type==="loader")releaseCargo(world,h);}
    }else {
      h.cooldown-=dt;
      if(h.type==="crusher")h.bodyY=Math.max(h.y-h.h+22,h.bodyY-160*dt);
      if(h.cooldown<=0)h.warning=1;
    }
    if(!h.active)continue;
    if(h.type === "loader") continue;
    const oldY=h.bodyY;
    if(h.type==="crusher") {
      h.bodyY=Math.min(h.y-22,h.bodyY+1100*dt);
      for(const s of world.solids())if(breakable(s)&&!propFor(world,s)&&segmentBox(h.x,oldY,h.x,h.bodyY,s,h.w/2))world.damageCover(s,200);
    }
    const zone=hazardZone(h);
    if(isScanner(h)) {
      scanFighters(world,h,zone,world.solids());
      if(h.type==="magnet")magneticPull(world,h,zone,dt);
      continue;
    }
    hazardProps(world,h,zone,dt);
    const solids=world.solids();
    for(const p of world.players) {
      if(!p.alive)continue;
      const box=playerBox(p);
      if(h.type==="conveyor") {
        if(p.ground&&Math.abs(box.y+box.h-h.y)<8&&box.x+box.w>zone.x&&box.x<zone.x+zone.w) {
          p.vx+=h.dir*Math.min((h.beltForce ?? 3000)*dt,Math.max(0,(h.beltSpeed ?? 800)-p.vx*h.dir));
          carryImpulse(p,.2);
        }
        continue;
      }
      const crush=h.type==="crusher"&&segmentBox(h.x,oldY,h.x,h.bodyY,
        {x:box.x-h.w/2,y:box.y-22,w:box.w+h.w,h:box.h+44});
      if(!overlap(box,zone)&&!crush)continue;
      if(["geyser","tesla","xray","steam","frost","spores"].includes(h.type)&&solids.some(s=>segmentBox(h.x,h.y-3,p.x,p.y,s)))continue;
      if(h.hitIds.includes(p.id))continue;
      h.hitIds.push(p.id);
      const damage={geyser:1000,crusher:1000,pendulum:100,saw:1000,tesla:70,steam:32,frost:10,spores:18}[h.type];
      hit(world,p,h,damage,["xray","frost","spores"].includes(h.type)?30:h.type==="pendulum"?1300:800);
      if(h.type==="steam"&&p.alive){p.vy=Math.min(p.vy,-720);p.ground=false;p.support=null;carryImpulse(p,.35);}
      if(h.type==="frost"&&p.alive)p.chill=Math.max(p.chill,1.5);
    }
    if(h.type==="conveyor")for(const d of world.drops)if(Math.abs(d.y+8-h.y)<16&&Math.abs(d.x-h.x)<h.w/2)d.vx=h.dir*500;
  }
}
