// Shared mechanical skeleton. The distant machine is assembled from rigid
// parts, never sampled from a background image. Beam origins use this same rig.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const COLOSSUS_EYES=Object.freeze([{x:-12,y:3.3},{x:12,y:3.3}]);
export const COLOSSUS_SCALE=.48;
export function rigPoint(frame,x,y){
  return {x:frame.x+frame.a*x+frame.c*y,y:frame.y+frame.b*x+frame.d*y};
}
function frame(x,y,angle,sx=1){
  return {x,y,a:Math.cos(angle)*sx,b:Math.sin(angle)*sx,c:-Math.sin(angle),d:Math.cos(angle)};
}
function endpoint(p,angle,length){return {x:p.x+Math.sin(angle)*length,y:p.y+Math.cos(angle)*length};}
function knee(hip,foot,side){
  const dx=foot.x-hip.x,dy=foot.y-hip.y,d=Math.hypot(dx,dy),upper=72,lower=78;
  const along=(upper*upper-lower*lower+d*d)/(2*d),across=Math.sqrt(Math.max(0,upper*upper-along*along));
  return {x:hip.x+dx*along/d+side*dy*across/d,y:hip.y+dy*along/d-side*dx*across/d};
}
export function colossusRig(h){
  const t=h.age,look=clamp(((h.gazeX??1280)-1280)/1280,-1,1);
  const lean=Math.sin(t*.21)*.085;
  const body=frame(1280+Math.sin(t*.19)*19,641+Math.sin(t*.17)*3,lean);
  const neck=rigPoint(body,Math.sin(t*.27)*9+look*5,-128);
  const head=frame(neck.x,neck.y-9,lean+Math.sin(t*.29-.4)*.13,
    .93-Math.sin(t*.23+look*.5)**2*.15);
  const arms=[-1,1].map(side=>{
    const shoulder=rigPoint(body,side*65,-100);
    const a=side*(.1+Math.sin(t*.23+side*.5)*.18)+lean;
    const elbow=endpoint(shoulder,a,67);
    const b=a-side*(.08+(.5+.5*Math.sin(t*.19+side))*.26);
    return {side,shoulder,elbow,hand:endpoint(elbow,b,77)};
  });
  const legs=[-1,1].map(side=>{
    const hip=rigPoint(body,side*27,0),foot={x:1280+side*49,y:780};
    return {side,hip,knee:knee(hip,foot,side),foot};
  });
  const distant=p=>({x:1280+(p.x-1280)*COLOSSUS_SCALE,y:653+(p.y-500)*COLOSSUS_SCALE});
  const scaled=f=>({...distant(f),a:f.a*COLOSSUS_SCALE,b:f.b*COLOSSUS_SCALE,c:f.c*COLOSSUS_SCALE,d:f.d*COLOSSUS_SCALE});
  const distantHead=scaled(head);
  return {body:scaled(body),head:distantHead,
    arms:arms.map(a=>({side:a.side,shoulder:distant(a.shoulder),elbow:distant(a.elbow),hand:distant(a.hand)})),
    legs:legs.map(l=>({side:l.side,hip:distant(l.hip),knee:distant(l.knee),foot:distant(l.foot)})),
    eyes:COLOSSUS_EYES.map(e=>rigPoint(distantHead,e.x,e.y))};
}
