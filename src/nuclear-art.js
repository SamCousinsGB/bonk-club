import { NUCLEAR } from "./impact.js";
import { JOINTS } from "./puppet.js";
import { W, H } from "./scale.js";
const TAU = Math.PI * 2;
const circle = (c, x, y, radius) => { c.beginPath(); c.arc(x,y,Math.max(.01,radius),0,TAU); };

export function clipCraters(c, state) {
  for (const f of state.craters || []) {
    if (state.time - f.born < NUCLEAR.meltAt) continue;
    c.beginPath(); c.rect(-200,-200,W+400,H+400);
    c.moveTo(f.x+f.radius,f.y); c.arc(f.x,f.y,f.radius,0,TAU);
    c.clip("evenodd");
  }
}

export function drawCraters(r, state) {
  const c = r.ctx;
  c.save();
  for (const f of state.craters || []) {
    const age = Math.max(0,state.time-f.born);
    if (age < NUCLEAR.meltAt) continue;
    // Opaque emptiness removes the scenery as well as the destroyed geometry.
    circle(c,f.x,f.y,f.radius); c.fillStyle="#050b12"; c.fill();
  }
  c.restore();
}

export function drawNuclear(r, f) {
  const c = r.ctx, age = f.age, radius = Math.min(f.radius, age*NUCLEAR.waveSpeed);
  const fade = Math.min(1,Math.max(0,f.life/1.2));
  c.save();
  circle(c,f.x,f.y,radius); c.clip();
  if (age < .72) {
    // A single circular white exposure, then the flash burns down to the hole.
    c.globalAlpha = r.reduced ? Math.max(0,.42*(1-age/.72)) : Math.min(1,Math.max(0,(.72-age)/.42));
    c.fillStyle = r.reduced ? "#d4a267" : "#fffff2";
    c.fillRect(f.x-radius,f.y-radius,radius*2,radius*2);
  }
  c.globalAlpha = fade;
  for (const [width,color] of [[42,"#e9572420"],[17,"#ff8d3748"],[6,"#ffb14d"],[2,"#fff0b9"]]) {
    circle(c,f.x,f.y,Math.max(1,radius-width/2));c.strokeStyle=color;c.lineWidth=width;c.stroke();
  }
  // Molten fragments peel inward from the cut. Fixed counts and no blur keep
  // the effect inexpensive on online guests and phones.
  for (let n=0;n<72;n++) {
    const angle=n*2.39996, start=.25+(n%9)*.06, t=Math.max(0,age-start);
    const edge=f.radius-(n%5)*2;
    const x=f.x+Math.cos(angle)*(edge-t*(12+n%7*5));
    const y=f.y+Math.sin(angle)*edge+t*t*(25+n%4*12);
    c.globalAlpha=fade*Math.min(1,t*4)*Math.max(0,1-t/2.7);
    r.line([[x,y],[x-Math.cos(angle)*3,y-8-t*12]],n%3?"#ff9f47":"#fff2b9",2+n%3);
  }
  c.restore();
}

export function drawAshSkeleton(r, rag) {
  const c=r.ctx, age=rag.ashAge, pts=rag.points;
  const crumble=Math.max(0,Math.min(1,(age-.65)/1.05));
  c.save();
  c.globalAlpha=Math.min(1,rag.life)*Math.max(0,1-crumble);
  for (const [a,b] of JOINTS) {
    if(a===0) continue;
    r.line([[pts[a].x,pts[a].y],[pts[b].x,pts[b].y]],"#121418",8);
    r.line([[pts[a].x,pts[a].y],[pts[b].x,pts[b].y]],"#eee5cb",3.5);
    r.circle(pts[b].x,pts[b].y,2.7,"#fff4d8");
  }
  const neck=pts[1],hip=pts[2],dx=hip.x-neck.x,dy=hip.y-neck.y,len=Math.hypot(dx,dy)||1;
  const nx=-dy/len,ny=dx/len;
  for(let n=1;n<=4;n++) {
    const t=n/5,x=neck.x+dx*t,y=neck.y+dy*t,width=10-n;
    r.line([[x+nx*width,y+ny*width],[x+dx*.09,y+dy*.09],[x-nx*width,y-ny*width]],"#eee5cb",2.2);
  }
  r.line([[hip.x+nx*6,hip.y+ny*6],[hip.x+dx*.16,hip.y+dy*.16],[hip.x-nx*6,hip.y-ny*6]],"#eee5cb",3);
  const head=pts[0];
  c.save();c.translate(head.x,head.y);
  c.rotate(Math.atan2(head.y-neck.y,head.x-neck.x)+Math.PI/2);
  r.circle(0,0,11.5,"#10151b");r.circle(0,-1,9.5,"#f7eed4");
  c.fillStyle="#eee5cb";c.fillRect(-5,4,10,8);
  r.circle(-4,-1,2.8,"#111721");r.circle(4,-1,2.8,"#111721");
  r.line([[0,2],[-1,5]],"#111721",2);
  for(let x=-3;x<=3;x+=3)r.line([[x,8],[x,11]],"#111721",1);
  c.restore();
  // Ash starts on the actual bones, then separates into a falling, drifting cloud.
  const t=Math.max(0,age-.6),dir=rag.ashDirection||1;
  for(let n=0;n<66;n++) {
    const [a,b]=JOINTS[n%JOINTS.length],along=((n*17)%31)/31;
    const x=pts[a].x+(pts[b].x-pts[a].x)*along;
    const y=pts[a].y+(pts[b].y-pts[a].y)*along;
    c.globalAlpha=Math.min(1,t*3)*Math.min(1,rag.life/.65)*(.45+(n%4)*.15);
    c.fillStyle=n%4===0?"#ffbf68":n%2?"#b7b2a5":"#6c7277";
    const size=1.3+n%3*.7;
    c.fillRect(x+dir*t*(12+n%9*8)+Math.sin(n*7)*t*15,y+t*t*(12+n%5*8)-t*(n%7)*7,size,size);
  }
  c.restore();
}
