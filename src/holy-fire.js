import {JOINTS} from './puppet.js';
import {passiveBody} from './body-physics.js';

export const HOLY_FIRE=Object.freeze({ashAt:3.2,duration:5.2});
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
export function holyFireStage(age){
  const swell=smooth((age-.25)/1.6),ash=smooth((age-HOLY_FIRE.ashAt)/.65);
  return {swell:swell*(1-ash),blister:smooth((age-.7)/.9)*(1-ash),ash,
    flame:smooth(age/.12)*(1-smooth((age-2.8)/1.2)),fade:1-smooth((age-4.35)/.85)};
}
export function holyJoints(rag){
  const age=rag.deathAge,{swell}=holyFireStage(age);
  return JOINTS.filter((_,i)=>age<HOLY_FIRE.ashAt+.15+((i*7)%10)*.035)
    .map(([a,b,len],i)=>[a,b,len*(1+swell*(i===1?.2:.07))]);
}
export function holyRadii(age){
  const {swell,ash}=holyFireStage(age);
  return Array.from({length:11},(_,i)=>ash>.8?2:i===0?10+swell*10:i<3?5+swell*13:3+swell*5);
}
// Host-owned muscle contractions and heat lift act on the existing physical
// body. Momentum, swept collision and external impulses remain in the solver.
export function updateHolyFire(rag,solids,dt){
  const age=rag.deathAge,{swell,ash}=holyFireStage(age),pts=rag.points;
  const neck=pts[1],hip=pts[2],length=Math.hypot(neck.x-hip.x,neck.y-hip.y)||1;
  const nx=-(neck.y-hip.y)/length,ny=(neck.x-hip.x)/length;
  if(age<HOLY_FIRE.ashAt)for(const [i,j,phase] of [[0,2,0],[4,8,1.8],[6,10,3.5]]){
    const spasm=Math.sin(age*11+phase)*Math.sin(age*4.3+phase)*850*(.3+swell)*dt*dt;
    pts[i].px-=nx*spasm;pts[i].py-=ny*spasm;
    pts[j].px+=nx*spasm;pts[j].py+=ny*spasm;
  }
  const lift=2150*smooth(age/.25);
  passiveBody(pts,holyJoints(rag),solids,dt,{gravity:(1800-lift)*(1-ash)+380*ash,
    drag:ash>.5?.965:.992,restitution:.12,radii:holyRadii(age)});
}
