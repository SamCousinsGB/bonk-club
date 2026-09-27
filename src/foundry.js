import { emitLiquid } from "./liquid.js";
// The spout endpoint is shared by the artwork, emission and AI warning.
export const LADLE_LIP = {x:86,y:-36};
export function ladlePose(h) {
  const phase=(h.age+(h.dir<0?5:0))%12;
  const tilt=phase>=4&&phase<6?(phase-4)/2:phase>=6&&phase<9?1:phase>=9&&phase<10?10-phase:0;
  const angle=tilt*1.1*h.dir, x=LADLE_LIP.x*h.dir,y=LADLE_LIP.y;
  return {angle,x:h.x+x*Math.cos(angle)-y*Math.sin(angle),y:660+x*Math.sin(angle)+y*Math.cos(angle)};
}
export const ladleZone=h=>{
  const p=ladlePose({...h,age:h.dir<0?1.5:6.5});
  return {x:p.x-22,y:p.y,w:44,h:h.y-p.y};
};
export function updateLadle(world,h,dt){
  if(world.prediction)return;
  if(![-70,70].every(offset=>world.platforms.some(p=>p.hp!==0&&!p.wreckId&&p.y===570&&p.x<=h.x+offset&&p.x+p.w>=h.x+offset))){
    h.done=true;h.active=false;h.warning=0;return;
  }
  h.age+=dt;const phase=(h.age+(h.dir<0?5:0))%12,was=h.active;
  h.warning=h.ladleLeft>0&&phase>=4&&phase<6?6-phase:0;h.active=h.ladleLeft>0&&phase>=6&&phase<9;
  h.bodyX=h.x;h.bodyY=660;h.duration=h.active?9-phase:0;
  const lip=ladlePose(h);
  if(h.active&&!was)world.event("hazard",{x:lip.x,y:lip.y,kind:"geyser"});
  if(!h.active || h.ladleLeft<=0)return;
  h.ladleLeft-=emitLiquid(world,'molten',lip.x,lip.y,Math.min(h.ladleLeft,420*dt),{vy:90,centered:true});
}
