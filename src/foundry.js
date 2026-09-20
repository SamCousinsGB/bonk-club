import { emitLiquid } from "./liquid.js";
export const ladleZone=h=>({x:h.x-22,y:705,w:44,h:h.y-705});
export function updateLadle(world,h,dt){
  if(world.prediction)return;
  if(!world.platforms.some(p=>p.hp!==0&&!p.wreckId&&p.y===570&&p.x<=h.x&&p.x+p.w>=h.x)){
    h.done=true;h.active=false;h.warning=0;return;
  }
  h.age+=dt;const phase=(h.age+(h.dir<0?5:0))%12,was=h.active;
  h.warning=h.ladleLeft>0&&phase>=4&&phase<6?6-phase:0;h.active=h.ladleLeft>0&&phase>=6&&phase<9;
  h.bodyX=h.x;h.bodyY=660;h.duration=h.active?9-phase:0;
  if(h.active&&!was)world.event("hazard",{x:h.x,y:710,kind:"geyser"});
  if(!h.active || h.ladleLeft<=0)return;
  h.ladleLeft-=emitLiquid(world,'molten',h.x,705,Math.min(h.ladleLeft,240*dt),{vy:90});
}
