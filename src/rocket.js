import {playerBox,segmentBox} from './collision.js';
import {bodyBounds,damageProp,impulseProp} from './props.js';
import {igniteFighter} from './weird-weapons.js';
import {carryImpulse} from './impact.js';

export const ROCKET = Object.freeze({idle:6,warning:3,fire:5,purge:3,cycle:17,pivotY:420,nozzle:230,length:1050,spread:110,rays:17});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function rocketPhase(age){
  const cycle=Math.floor((age+1e-8)/ROCKET.cycle),t=(age+1e-8)%ROCKET.cycle;
  const fire=clamp((t-ROCKET.idle-ROCKET.warning)/ROCKET.fire,0,1);
  const active=t>=9&&t<14,warning=t>=6&&t<9?9-t:0,purge=t>=14?(17-t)/3:0;
  const direction=cycle%2?-1:1;
  // Each firing reverses direction. The gimbal holds its previous endpoint
  // through the warning and never snaps across fighters at a cycle boundary.
  const sweep=t<9?-.27:t<14?-.27*Math.cos(fire*Math.PI):.27;
  return {cycle,t,active,warning,purge,fire,angle:direction*sweep};
}
export function rocketNozzle(h){
  const phase=rocketPhase(h.age),s=Math.sin(phase.angle),c=Math.cos(phase.angle);
  return {...phase,x:h.x+s*ROCKET.nozzle,y:ROCKET.pivotY+c*ROCKET.nozzle,s,c};
}
export function initialRocket(){const n=rocketNozzle({x:1280,age:0});return {bodyX:n.x,bodyY:n.y};}
// One shared, bounded fan clips the luminous plume against surviving solids.
// Open grating passes exhaust. Removing the floor lets the jet escape naturally.
export function rocketPlume(h,platforms=[]){
  const n=rocketNozzle(h),rays=[];
  for(let i=0;i<ROCKET.rays;i++){
    const u=i/(ROCKET.rays-1)*2-1;
    const x=n.x+n.c*u*78,y=n.y-n.s*u*78;
    const dx=n.s*ROCKET.length+n.c*u*ROCKET.spread,dy=n.c*ROCKET.length-n.s*u*ROCKET.spread;
    let t=1;
    for(const p of platforms)if(p.hp!==0&&!p.oneWay){
      const hit=segmentBox(x,y,x+dx,y+dy,p);if(hit&&hit.t<t)t=hit.t;
    }
    rays.push({x,y,ex:x+dx*t,ey:y+dy*t,t});
  }
  return {nozzle:n,rays};
}
export function rocketTouches(plume,box,padding=0){
  return plume.rays.some(r=>segmentBox(r.x,r.y,r.ex,r.ey,box,padding));
}
export function rocketZone(h,y=1120){
  if(y<610)return {x:0,y:610,w:0,h:0};
  const reach=Math.max(0,y+50-ROCKET.pivotY),half=78+reach*.38;
  return {x:h.x-half-28,y:610,w:half*2+56,h:1100};
}
export function rocketDanger(h,x,y,padding=18){
  if(h.done||(!h.active&&h.warning<=0)||y+28<610)return false;
  const z=rocketZone(h,y);return x+padding>z.x&&x-padding<z.x+z.w;
}
export function updateRocket(world,h,dt){
  if(world.prediction||world.phase!=='fight')return;
  const previous=rocketPhase(h.age);h.age+=dt;
  const phase=rocketPhase(h.age),n=rocketNozzle(h);
  h.warning=phase.warning;h.active=phase.active;h.duration=phase.active?14-phase.t:0;
  h.bodyX=n.x;h.bodyY=n.y;
  if(!phase.active){h.hitTimer=0;h.hitIds=[];return;}
  if(!previous.active)world.event('hazard',{kind:'rocket',x:h.x,y:n.y});
  const plume=rocketPlume(h,world.platforms);
  h.hitTimer-=dt;const damageTick=h.hitTimer<=0;if(damageTick)h.hitTimer=.2;
  for(const p of world.players){
    if(!rocketTouches(plume,playerBox(p),6))continue;
    if(p.alive&&damageTick)world.hit(p,{x:n.x,y:n.y,vx:0,vy:0},30,190,n.s,n.c,
      {blast:true,effect:'burn',cause:'rocket',hitstop:0});
    if(p.alive){igniteFighter(p);p.vx+=n.s*650*dt;p.vy+=n.c*650*dt;carryImpulse(p,.3);}
    // Damage, knockback and passive-body momentum remain owned by the host.
    if(!p.alive){p.vx+=n.s*650*dt;p.vy+=n.c*650*dt;}
  }
  for(const b of [...world.cover,...world.chunks])if(b.hp>0&&rocketTouches(plume,bodyBounds(b),5)){
    impulseProp(b,n.s*14000*dt,n.c*14000*dt);
    if(damageTick)damageProp(world,b,9,0,0);
  }
  for(const d of world.drops)if(rocketTouches(plume,{x:d.x-7,y:d.y-7,w:14,h:14},4)){
    d.vx+=n.s*1100*dt;d.vy+=n.c*1100*dt;
  }
  for(const points of [...world.players.filter(p=>!p.alive||p.knockdown>0).map(p=>p.rig),...world.ragdolls.map(r=>r.points)]){
    for(const q of points||[])if(rocketTouches(plume,{x:q.x-4,y:q.y-4,w:8,h:8},6)){
      q.px-=n.s*650*dt*dt;q.py-=n.c*650*dt*dt;
    }
  }
}
export function validRocket(h,arena){
  return h.type!=='rocket'||(arena?.rocket===true&&h.id===1&&h.x===1280&&h.y===660&&h.w===360&&h.h===280&&
    h.done===false&&h.warning<=3&&h.duration<=5&&Number.isFinite(h.hitTimer)&&h.hitTimer>=-.02&&h.hitTimer<=.21&&
    h.bodyX>=1218&&h.bodyX<=1342&&h.bodyY>=640&&h.bodyY<=661);
}
