import {colossusPoint} from './colossus.js';

// Small textured mesh over the existing painting. Fixed outer vertices join
// seamlessly to the static valley; close rows preserve the square head and eyes.
const xs=[1218,1234,1244,1254,1264,1270,1274.5,1280.5,1287,1298,1308,1320,1338];
const ys=[603,617,622,628,634,641,650,661,674,688,702,717,737];
const vertices=ys.flatMap(y=>xs.map(x=>({x,y}))),faces=[];
for(let y=0;y<ys.length-1;y++)for(let x=0;x<xs.length-1;x++){
  const a=y*xs.length+x,b=a+1,c=a+xs.length,d=c+1;
  faces.push([a,b,c],[b,d,c]);
}
let texture;
export function drawColossusMotion(c,backdrop,h) {
  if(!texture){
    texture=document.createElement('canvas');texture.width=240;texture.height=268;
    const t=texture.getContext('2d');t.scale(2,2);t.translate(-1218,-603);
    t.drawImage(backdrop,-6,-5,2572,1450);
  }
  const moved=vertices.map(p=>colossusPoint(h,p.x,p.y));
  c.save();c.beginPath();c.rect(1218,603,120,134);c.clip();
  for(const ids of faces){
    const [a,b,d]=ids.map(i=>vertices[i]),[p,q,r]=ids.map(i=>moved[i]);
    const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-a.x,vy=d.y-a.y,det=ux*vy-uy*vx;
    const aa=((q.x-p.x)*vy-(r.x-p.x)*uy)/det,bb=((q.y-p.y)*vy-(r.y-p.y)*uy)/det;
    const cc=((r.x-p.x)*ux-(q.x-p.x)*vx)/det,dd=((r.y-p.y)*ux-(q.y-p.y)*vx)/det;
    const mx=(p.x+q.x+r.x)/3,my=(p.y+q.y+r.y)/3;
    c.save();c.beginPath();
    // Subpixel overlap prevents antialiased triangle seams from exposing the
    // stationary copy underneath. Both sides share the same transformed edge.
    for(const [i,s] of [p,q,r].entries()){
      const length=Math.hypot(s.x-mx,s.y-my),x=s.x+(s.x-mx)/length*.45,y=s.y+(s.y-my)/length*.45;
      if(i)c.lineTo(x,y);else c.moveTo(x,y);
    }
    c.closePath();c.clip();
    c.transform(aa,bb,cc,dd,p.x-aa*a.x-cc*a.y,p.y-bb*a.x-dd*a.y);
    c.drawImage(texture,1218,603,120,134);c.restore();
  }
  c.restore();
}
