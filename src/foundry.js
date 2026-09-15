import { playerBox } from "./collision.js";
const overlap=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;
export const ladleZone=h=>({x:h.x-22,y:705,w:44,h:h.y-705});
export function updateLadle(world,h,dt){
  if(world.prediction)return;
  if(!world.platforms.some(p=>p.hp!==0&&!p.wreckId&&p.y===570&&p.x<=h.x&&p.x+p.w>=h.x)){
    h.done=true;h.active=false;h.warning=0;return;
  }
  h.age+=dt;const phase=(h.age+(h.dir<0?5:0))%12,was=h.active;
  h.warning=phase>=4&&phase<6?6-phase:0;h.active=phase>=6&&phase<9;
  h.bodyX=h.x;h.bodyY=660;h.duration=h.active?9-phase:0;
  if(h.active&&!was)world.event("hazard",{x:h.x,y:710,kind:"geyser"});
  if(!h.active)return;
  const zone=ladleZone(h);
  for(const p of world.players)if(p.alive&&overlap(playerBox(p),zone)){
    world.kill(p,{effect:"burn",cause:"burn",ash:true});
  }
  // Scrap really feeds the crucible: the same finite material pieces are
  // consumed in the hot stream, rather than collecting as an invisible wall.
  for(const b of world.cover)if(b.hp>0&&overlap(b,zone))world.damageCover(b,1000);
  for(const b of world.chunks)if(b.hp>0&&overlap(b,zone))b.hp=0;
}
