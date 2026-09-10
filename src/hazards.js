import { playerBox, segmentBox } from "./collision.js";
import { carryImpulse } from "./impact.js";
import { breakable } from "./maps.js";
import { hazardProps, propFor } from "./props.js";
export const HAZARD_TYPES=["geyser","conveyor","pendulum","crusher","tesla","saw"];
export const HAZARD_LABELS={geyser:"Flame vent",conveyor:"Conveyor",pendulum:"Spike ball",crusher:"Crusher",tesla:"Electrical trap",saw:"Saw rail"};
const overlap=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;

export function createHazards(world) {
  return (world.arena.traps||[]).map((h,i)=>({
    ...h,id:i+1,bodyX:h.x,bodyY:h.type==="saw"?h.y-28:h.type==="pendulum"?h.y-35:h.y-h.h+24,vy:0,age:0,
    warning:0,duration:1.25,cooldown:3.5+i*.75,active:false,
    done:false,hitIds:[],hitTimer:0,
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
  world.hit(p,{x:h.bodyX,y:h.bodyY,vx:0,vy:0},damage,force,Math.sign(p.x-h.bodyX)||h.dir,-.55,{blast:true,hitstop:.018,execute:h.type==="saw",effect:h.type==="saw"?"slice":h.type==="tesla"?"tesla":h.type==="geyser"?"burn":h.type==="crusher"?"blast":null});
}
export function updateHazards(world,dt) {
  if(world.phase!=="fight")return;
  for(const h of world.hazards) {
    if(h.done)continue;
    // Destroying the mounting floor disables a fixture, leaving its casing visible.
    if(!world.platforms.some(p=>p.hp!==0&&Math.abs(p.y-h.y)<2&&p.x<=h.x&&p.x+p.w>=h.x)) {
      h.done=true;h.active=false;h.warning=0;continue;
    }
    h.age+=dt;h.hitTimer-=dt;
    if(h.hitTimer<=0){h.hitIds=[];h.hitTimer=.8;}
    const mechanical=["conveyor","pendulum","saw"].includes(h.type);
    if(mechanical) {
      if(h.cooldown>0){h.cooldown=Math.max(0,h.cooldown-dt);continue;}
      h.active=true;
      if(h.type==="pendulum") {
        const angle=Math.sin(h.age*1.8)*.85,length=h.h-35;
        h.bodyX=h.x+Math.sin(angle)*length;
        h.bodyY=h.y-h.h+Math.cos(angle)*length;
      }else if(h.type==="saw") {
        h.bodyX=h.x+Math.sin(h.age*1.65)*(h.w/2-28);h.bodyY=h.y-28;
      }
    }else if(h.active) {
      h.duration-=dt;
      if(h.duration<=0){h.active=false;h.cooldown=2.5+world.random()*3;h.hitIds=[];continue;}
    }else if(h.warning>0) {
      h.warning=Math.max(0,h.warning-dt);
      if(h.warning===0){h.active=true;h.duration=h.type==="crusher"?1.1:1.35;h.hitIds=[];world.event("hazard",{x:h.x,y:h.y,kind:h.type});}
    }else {
      h.cooldown-=dt;
      if(h.type==="crusher")h.bodyY=Math.max(h.y-h.h+22,h.bodyY-160*dt);
      if(h.cooldown<=0)h.warning=1;
    }
    if(!h.active)continue;
    const oldY=h.bodyY;
    if(h.type==="crusher") {
      h.bodyY=Math.min(h.y-22,h.bodyY+1100*dt);
      for(const s of world.solids())if(breakable(s)&&!propFor(world,s)&&segmentBox(h.x,oldY,h.x,h.bodyY,s,h.w/2))world.damageCover(s,200);
    }
    const zone=hazardZone(h);
    hazardProps(world,h,zone,dt);
    for(const p of world.players) {
      if(!p.alive)continue;
      const box=playerBox(p);
      if(h.type==="conveyor") {
        if(p.ground&&Math.abs(box.y+box.h-h.y)<8&&box.x+box.w>zone.x&&box.x<zone.x+zone.w) {
          p.vx+=h.dir*Math.min(3000*dt,Math.max(0,800-p.vx*h.dir));
          carryImpulse(p,.2);
        }
        continue;
      }
      const crush=h.type==="crusher"&&segmentBox(h.x,oldY,h.x,h.bodyY,box,h.w/2);
      if(!overlap(box,zone)&&!crush)continue;
      if(["geyser","tesla"].includes(h.type)&&world.solids().some(s=>segmentBox(h.x,h.y-3,p.x,p.y,s)))continue;
      if(h.hitIds.includes(p.id))continue;
      h.hitIds.push(p.id);
      hit(world,p,h,["geyser","crusher"].includes(h.type)?1000:h.type==="pendulum"?100:70,h.type==="pendulum"?1300:800);
    }
    if(h.type==="conveyor")for(const d of world.drops)if(Math.abs(d.y+8-h.y)<16&&Math.abs(d.x-h.x)<h.w/2)d.vx=h.dir*500;
  }
}
