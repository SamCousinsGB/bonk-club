import { playerBox, segmentBox } from './collision.js';

// Host and renderer derive exactly the same gravity arc and first solid contact.
export function furnaceStreams(h,platforms=[]) {
  if(!h||h.furnaceMelt<=0)return [];
  const level=35+(1-h.furnaceMelt)*280,streams=[];
  for(const leak of h.furnaceLeaks||[]) {
    const head=leak.y-level;if(head<=0)continue;
    const dir=leak.x<-20?-1:leak.x>20?1:0;
    const speed=Math.sqrt(2*850*head)*.9,r=Math.max(3,leak.r*Math.min(1,Math.sqrt(head/70)));
    const points=[{x:h.x+leak.x,y:h.y+leak.y}],age=Math.max(0,h.age-leak.born);
    let landed=false;
    for(let t=.025;t<=Math.min(1.8,age)+.0001;t+=.025) {
      const a=points.at(-1),b={x:h.x+leak.x+dir*speed*t,y:h.y+leak.y+35*t+425*t*t};
      let hit=null;
      for(const p of platforms)if(p.hp!==0){const q=segmentBox(a.x,a.y,b.x,b.y,p,r*.6);if(q&&(!hit||q.t<hit.t))hit=q;}
      if(hit){points.push({x:a.x+(b.x-a.x)*hit.t,y:a.y+(b.y-a.y)*hit.t});landed=true;break;}
      points.push(b);if(b.y>1510)break;
    }
    if(points.length>1)streams.push({points,r,landed,leak});
  }
  return streams;
}
export function streamTouches(stream,box) {
  return stream.points.some((b,i)=>i>0&&segmentBox(stream.points[i-1].x,stream.points[i-1].y,b.x,b.y,box,stream.r)) ||
    stream.landed&&segmentBox(stream.points.at(-1).x-stream.r*2,stream.points.at(-1).y,
      stream.points.at(-1).x+stream.r*2,stream.points.at(-1).y,box,stream.r*.5);
}
export function updateFurnaceFlow(world,h,dt) {
  if(world.prediction)return;
  const streams=furnaceStreams(h,world.platforms);
  h.furnaceMelt=Math.max(0,h.furnaceMelt-dt*streams.reduce((n,s)=>n+s.r,0)/1600);
  if(!streams.length)return;
  for(const p of world.players)if(p.alive&&streams.some(s=>streamTouches(s,playerBox(p))))
    world.hit(p,{x:h.x,y:h.y+100,vx:0,vy:0},1000,260,Math.sign(p.x-h.x)||1,-.2,
      {blast:true,effect:'burn',cause:'burn',hitstop:.008});
  h.meltHitTimer=(h.meltHitTimer||0)-dt;
  if(h.meltHitTimer<=0){
    h.meltHitTimer=.2;
    for(const p of world.cover||[])if(p.hp>0&&streams.some(s=>streamTouches(s,p)))world.damageCover(p,1000);
    for(const p of world.chunks||[])if(p.hp>0&&streams.some(s=>streamTouches(s,p)))p.hp=0;
  }
}
