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

// Carved collision rectangles are thin slices. Paint their shared surface once,
// clipped to the surviving pieces, so a cut does not repeat the platform trim
// on every physics slice or draw across a subsequently broken fragment.
export function drawScorchedPlatforms(r, platforms, time) {
  const groups = new Map(), c = r.ctx;
  for (const p of platforms) {
    if (p.move || p.travel) continue;
    if (typeof p.id !== "string" || !p.id.includes(":c")) {r.platform(p,time);continue;}
    const id = p.id.split(":c")[0];
    if (!groups.has(id)) groups.set(id,[]);
    groups.get(id).push(p);
  }
  for (const pieces of groups.values()) {
    const alive = pieces.filter(p=>p.hp!==0);
    if (!alive.length) continue;
    const x=Math.min(...pieces.map(p=>p.x)), y=Math.min(...pieces.map(p=>p.y));
    const w=Math.max(...pieces.map(p=>p.x+p.w))-x, h=Math.max(...pieces.map(p=>p.y+p.h))-y;
    c.save();c.beginPath();
    for (const p of alive)c.rect(p.x,p.y,p.w,p.h);
    c.clip();r.platform({...alive[0],x,y,w,h},time);c.restore();
  }
}

const falloutSprites = new Map();
function falloutSprite(kind) {
  if (falloutSprites.has(kind)) return falloutSprites.get(kind);
  const canvas = document.createElement("canvas");
  const size = kind === "mist" ? 128 : 512;
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d"), half = size/2;
  const g = c.createRadialGradient(half,half,0,half,half,half);
  const stops = kind === "desaturate"
    ? [[0,"#8080809c"],[.65,"#80808085"],[.84,"#80808055"],[1,"#80808000"]]
    : kind === "mist"
      ? [[0,"#dfedb887"],[.28,"#a9c48a44"],[.65,"#91ae7220"],[1,"#83985a00"]]
      : [[0,"#bfd78312"],[.42,"#b7cc781c"],[.72,"#8aa74a35"],[.84,"#b6ca6543"],[.93,"#72663628"],[1,"#4a4c2200"]];
  for (const [at,color] of stops) g.addColorStop(at,color);
  c.fillStyle=g;c.fillRect(0,0,size,size);
  falloutSprites.set(kind,canvas);
  return canvas;
}

export function drawCraters(r, state) {
  const c = r.ctx;
  const scars = (state.craters || []).filter(f=>state.time-f.born>=NUCLEAR.meltAt);
  if (!scars.length) return;
  const animated = scars.slice(-6);
  c.save();
  for (const f of scars) {
    const age = Math.max(0,state.time-f.born), radius=f.radius;
    const heat = Math.exp(-age/12), settle=.3+.7*heat;
    const t = r.reduced ? 0 : age;
    // Only the backdrop is graded. Soft alpha masks retain its silhouettes and
    // lighting, feather the blast boundary, and leave fighters fully readable.
    c.globalCompositeOperation="saturation";
    c.globalAlpha=.55+.35*heat;
    c.drawImage(falloutSprite("desaturate"),f.x-radius,f.y-radius,radius*2,radius*2);
    c.globalCompositeOperation="source-over";
    c.globalAlpha=.55+.45*heat;
    c.drawImage(falloutSprite("tint"),f.x-radius,f.y-radius,radius*2,radius*2);
    if (!animated.includes(f)) continue;
    c.save();circle(c,f.x,f.y,radius);c.clip();
    // Broad, translucent sheets drift upwards inside the emptied space. Cached
    // sprites replace full-canvas blur/filter passes, including on mobile.
    const mist=falloutSprite("mist");
    for(let n=0;n<9;n++) {
      const a=n*2.39996+f.id*.7;
      const orbit=radius*(.22+(n%4)*.14);
      const x=f.x+Math.cos(a)*orbit+Math.sin(t*.22+n)*17;
      const y=f.y+Math.sin(a)*orbit-Math.sin(t*.17+n*2)*28;
      const size=radius*(.65+(n%3)*.15);
      c.globalAlpha=(.13+.13*heat)*(r.reduced?1:.9+.1*Math.sin(t*.5+n));
      c.drawImage(mist,x-size/2,y-size*.32,size,size*.64);
    }
    // Slow fallout replaces the solid circular void. Seeded paths stay stable
    // between host and guest; old overlapping scars do not multiply particles.
    for(let n=0;n<44;n++) {
      const a=n*2.39996+f.id, distance=radius*Math.sqrt(((n*37)%101)/104);
      const drift=t*(5+n%4*2);
      const x=f.x+Math.cos(a)*distance+Math.sin(t*.35+n)*10;
      const y=f.y+((Math.sin(a)*distance+drift+radius)%(radius*2))-radius;
      if(Math.hypot(x-f.x,y-f.y)>radius-8 || scars.some(other=>other.id>f.id&&Math.hypot(x-other.x,y-other.y)<other.radius))continue;
      c.globalAlpha=(.22+.5*settle)*(r.reduced?1:.72+.28*Math.sin(t*.75+n));
      c.fillStyle=n%7===0?"#e6f7aa":n%3?"#bcc6a4":"#d8d1b0";
      const size=n%7===0?2.8:1.3+n%2;
      c.fillRect(x,y,size,size);
      if(n%7===0) {
        c.globalAlpha*=.16;r.circle(x+size/2,y+size/2,7,"#defe8f");
      }
    }
    c.restore();
  }
  c.restore();
}

export function drawNuclear(r, f) {
  const c = r.ctx, age = f.age, radius = Math.min(f.radius, age*NUCLEAR.waveSpeed);
  const fade = Math.min(1,Math.max(0,f.life/1.2));
  c.save();
  circle(c,f.x,f.y,radius); c.clip();
  if (age < .72) {
    // A single circular white exposure, then the flash burns down to the exposed scenery.
    c.globalAlpha = r.reduced ? Math.max(0,.42*(1-age/.72)) : Math.min(1,Math.max(0,(.72-age)/.42));
    c.fillStyle = r.reduced ? "#d4a267" : "#fffff2";
    c.fillRect(f.x-radius,f.y-radius,radius*2,radius*2);
  }
  c.globalAlpha = fade*Math.exp(-Math.max(0,age-.4)*2.2);
  for (const [width,color] of [[32,"#ff9e3822"],[12,"#ffc06544"],[2,"#fff0b9"]]) {
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
