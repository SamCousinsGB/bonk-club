import { PROP_TYPES } from './props.js';
import { BARRELS } from './barrels.js';

// Resize the host's round instances, never the arena templates. Keep each
// landing and its headroom usable; capacities and mass follow the actual size.
export function randomizeLiquidContainers(world) {
  for(const b of world.cover) {
    const water=b.kind==='waterTank';
    const gas=b.kind==='canister',bulk=gas||b.kind==='oilBarrel'||b.kind==='tarBarrel';
    if(b.chunk || (!water && !gas && !BARRELS[b.kind]?.contents))continue;
    const cx=b.x+b.w/2,bottom=b.y+b.h,area=b.w*b.h;
    const choices=water?[.62,.76,.9,1]:bulk?[.82,1.18,1.8,2.2,2.6]:[.65,.82,1,1.18,1.38];
    let scale=choices[Math.min(choices.length-1,Math.floor(world.random()*choices.length))];
    let w,h,x,y;
    do {
      w=Math.round(b.w*scale);h=Math.round(b.h*scale);x=cx-w/2;y=bottom-h;
      const support=world.platforms.find(p=>p.hp!==0&&Math.abs(p.y-bottom)<1&&cx>=p.x&&cx<=p.x+p.w);
      const blocked=w>250||h>200||(support&&(x<support.x+12||x+w>support.x+support.w-12))||
        world.platforms.some(p=>p.hp!==0 && p.y<bottom-.5 && x<p.x+p.w+4 && x+w>p.x-4 && y-110<p.y+p.h && bottom>p.y) ||
        world.cover.some(p=>p!==b && p.hp>0 && x<p.x+p.w+12 && x+w>p.x-12 && y<p.y+p.h+12 && bottom>p.y-12) ||
        world.arena.spawns.some(([px,py])=>Math.abs(px-cx)<w/2+75 && py+100>y && py-100<bottom);
      if(!blocked || scale<=.65)break;
      scale=Math.max(.62,scale-.1);
    } while(true);
    const ratio=w*h/area;
    Object.assign(b,{x,y,w,h,mass:PROP_TYPES[b.kind].mass*w*h/(water?64*76:gas?44*72:54*68)});
    if(water)b.waterLeft=b.waterCapacity=Math.min(1200,Math.round((b.waterCapacity||b.waterLeft||210)*ratio));
    else if(!gas)b.liquidLeft=b.liquidCapacity=Math.min(1200,Math.round(96*ratio));
  }
}
