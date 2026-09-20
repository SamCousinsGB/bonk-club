// Volume stays in w*h. Falling parcels stretch with their speed and narrow by
// the same factor: rendering, electricity and body contact use this one shape.
export function liquidBounds(q) {
  if(q.grounded || q.frozen || (q.vy||0)<=0 || !(q.h>0))return q;
  const h=Math.max(q.h,Math.min(72,(q.fallDistance??72)+q.h,Math.abs(q.vy||0)*.065+Math.sqrt(q.w*q.h)*.5));
  const w=q.w*q.h/h;
  return {x:q.x+(q.w-w)/2,y:q.y+q.h-h,w,h};
}
export const isLiquid = q => typeof q.grounded==='boolean' && !q.mass && q.id>0;

// Clip a swept point against a convex liquid boundary, including tilted ship
// surfaces. The bounding box alone includes dry corners above the waterline.
export function liquidPolygonHit(poly,x,y,ex,ey,padding=0) {
  const area=poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a.x*b.y-b.x*a.y;},0);
  const sign=Math.sign(area)||1;let enter=0,leave=1,nx=0,ny=0;
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if(!len)continue;
    const ix=-dy*sign/len,iy=dx*sign/len,d=(x-a.x)*ix+(y-a.y)*iy+padding,v=(ex-x)*ix+(ey-y)*iy;
    if(Math.abs(v)<1e-10){if(d<0)return null;continue;}
    const t=-d/v;
    if(v>0){if(t>enter){enter=t;nx=-ix;ny=-iy;}}else leave=Math.min(leave,t);
    if(enter>leave)return null;
  }
  return {t:enter,nx,ny};
}
