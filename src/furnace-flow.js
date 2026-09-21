import { emitLiquid } from './liquid.js';

// Only the outlet and its pressure are derived from the vessel. Everything
// downstream is an ordinary finite parcel, including landing, pooling and heat.
export function furnaceOutlets(h) {
  if(!h || h.furnaceMelt<=0)return [];
  const level=35+(1-h.furnaceMelt)*280;
  return (h.furnaceLeaks||[]).flatMap(leak=>{
    const head=leak.y-level;if(head<=0)return [];
    const dir=leak.x<-20?-1:leak.x>20?1:0;
    return [{x:h.x+leak.x,y:h.y+leak.y,vx:dir*Math.sqrt(2*850*head)*.9,
      r:Math.max(3,leak.r*Math.min(1,Math.sqrt(head/70)))}];
  });
}
export function updateFurnaceFlow(world,h,dt) {
  if(world.prediction)return;
  for(const p of furnaceOutlets(h)) {
    const amount=Math.min(h.furnaceMelt*18000,dt*p.r*18000/1600);
    const emitted=emitLiquid(world,'molten',p.x,p.y,amount,{vx:p.vx,vy:35});
    h.furnaceMelt=Math.max(0,h.furnaceMelt-emitted/18000);
  }
}
