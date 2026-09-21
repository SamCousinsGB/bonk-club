import { emitLiquid } from './liquid.js';

// A furnace holds enough metal for a visible, short-lived rupture.  The old
// 18k reserve was paired with a pinhole rate, so a damaged wall emitted a row
// of isolated liquid samples for minutes instead of a physical pour.
export const FURNACE_MELT_CAPACITY = 180000;
const MIN_POUR_RATE = 24000;
// One solver sample stays within its 160-unit column depth.  Larger direct
// time steps (tests, catch-up frames) therefore cannot fan one breach across
// adjacent columns before gravity has a chance to shape the stream.
const MAX_POUR_SAMPLE = 160;

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
  const outlets=furnaceOutlets(h);
  const width=outlets.reduce((sum,p)=>sum+p.r,0)||1;
  for(const p of outlets) {
    // The cross-section of a real breach sets its share of the finite charge.
    // A minimum total rate keeps adjacent simulation samples touching at the
    // fixed physics step, which makes this a pour rather than a bead launcher.
    const rate=Math.max(MIN_POUR_RATE,p.r*1800)*p.r/width;
    const amount=Math.min(h.furnaceMelt*FURNACE_MELT_CAPACITY,dt*rate,MAX_POUR_SAMPLE);
    const emitted=emitLiquid(world,'molten',p.x,p.y,amount,{vx:p.vx,vy:35});
    h.furnaceMelt=Math.max(0,h.furnaceMelt-emitted/FURNACE_MELT_CAPACITY);
  }
}
