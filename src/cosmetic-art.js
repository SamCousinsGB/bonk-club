import { restCloth, TRAIL_LIFE } from "./cosmetics.js";
const TAU = Math.PI * 2;
const line = (c, points, color, width = 1) => {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round"; c.lineJoin = "round"; c.stroke();
};
const dot = (c, x, y, radius, color) => {
  c.fillStyle = color; c.beginPath(); c.arc(x, y, radius, 0, TAU); c.fill();
};
const star = (c, x, y, size, color, angle = 0) => {
  c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = color; c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? size * .22 : size;
    if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(r, 0);
  }
  c.closePath(); c.fill(); c.restore();
};

// Broad colour bands plus fine texture keep the finish legible at arena scale.
export function materialPaint(c, p, x, y, width = 24, height = 72, time = 0) {
  const base = p.color || "#55baff", finish = p.finish;
  if (!finish || finish === "Matte") return base;
  const drift = Math.sin(time * .8) * 5;
  const g = c.createLinearGradient(x - width / 2 + drift, y, x + width / 2 + drift, y + height);
  const stops = finish === "Chrome" ? [[0,"#13293c"],[.21,base],[.38,"#f4ffff"],[.44,"#314559"],[.64,base],[.82,"#fff"],[1,"#405769"]]
    : finish === "Gold leaf" ? [[0,"#6c3712"],[.27,"#d9932e"],[.42,"#fff1ae"],[.48,"#a76518"],[.75,"#ffd46e"],[1,base]]
    : finish === "Iridescent" ? [[0,base],[.25,"#8e82f9"],[.44,"#9cffe1"],[.5,"#fff0f8"],[.72,"#ee8ace"],[1,base]]
    : finish === "Opal" ? [[0,base],[.25,"#d7ccff"],[.48,"#f5fff1"],[.66,"#a7eed9"],[.86,"#ffd0e8"],[1,"#bbcdf8"]]
    : finish === "Carbon fibre" ? [[0,"#15212f"],[.38,base],[.48,"#61717f"],[.7,"#24323f"],[1,base]]
    : finish === "Starfield" ? [[0,"#132347"],[.3,base],[.5,"#7556a5"],[.76,"#232a58"],[1,base]]
    : [[0,"#291b2b"],[.28,"#75343c"],[.45,"#ffb34d"],[.53,"#9b3b31"],[.77,"#2c2336"],[1,base]];
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}
export function drawFinish(c, p, rig, time, ox = 0, oy = 0) {
  if (!p.finish || p.finish === "Matte" || p.flash > 0) return;
  c.save(); c.translate(-ox, -oy);
  // Follow each limb, so the weave/facets move with the physical pose.
  for (const [a, b] of [[1,2],[1,3],[3,4],[1,5],[5,6],[2,7],[7,8],[2,9],[9,10]]) {
    const u = rig[a], v = rig[b], dx = v.x-u.x, dy = v.y-u.y, d = Math.hypot(dx,dy) || 1;
    for (let i = 0; i < 4; i++) {
      const t = (i+.5)/4, x = u.x+dx*t, y=u.y+dy*t;
      c.globalAlpha = p.finish === "Carbon fibre" ? .55 : .28;
      if (["Carbon fibre","Gold leaf","Opal","Magma"].includes(p.finish)) {
        line(c,[{x:x-dy/d*2,y:y+dx/d*2},{x:x+dy/d*2+dx/d*2,y:y-dx/d*2+dy/d*2}],p.finish === "Magma" ? "#ffad57" : i%2 ? "#fff5de" : "#12283b",.85);
      } else if (p.finish === "Starfield") dot(c,x,y,i%2?.7:1,"#f4e6ff");
    }
  }
  const h=rig[0]; c.beginPath();c.arc(h.x,h.y,10.3,0,TAU);c.clip();c.globalAlpha=.5;
  if (p.finish === "Carbon fibre") {
    for(let i=-16;i<18;i+=4) line(c,[{x:h.x+i,y:h.y-12},{x:h.x+i+12,y:h.y+12}],"#102938",1.2);
  } else if (["Opal","Gold leaf","Magma"].includes(p.finish)) {
    for(let i=0;i<8;i++) {const x=h.x+Math.sin(i*7)*10,y=h.y+Math.cos(i*5)*10;
      line(c,[{x:x-4,y:y-3},{x:x+2,y:y},{x:x-1,y:y+5}],p.finish === "Magma" ? "#ffad4d" : "#fff8de",1);}
  } else if(p.finish === "Starfield") {
    for(let i=0;i<10;i++) dot(c,h.x+Math.sin(i*12)*9,h.y+Math.cos(i*7)*9,.55+(i%3)*.25,"#fff0ff");
  }
  c.globalAlpha=.75;line(c,[{x:h.x-6,y:h.y-4},{x:h.x-4,y:h.y-7},{x:h.x,y:h.y-8}],"#fff9eb",1.2);
  c.restore();
}

export function drawCape(c, p, motion, time = 0, ox = 0, oy = 0) {
  if (!p.cape || p.cape === "None" || !p.rig || p.strands) return;
  const pts = motion?.cloth?.length ? motion.cloth : restCloth(p), left=[],right=[];
  c.save(); c.translate(-ox,-oy);
  for(let i=0;i<pts.length;i++) {
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],d=Math.hypot(b.x-a.x,b.y-a.y)||1;
    const width=2.5+i*1.15, nx=(b.y-a.y)/d,ny=-(b.x-a.x)/d;
    left.push({x:pts[i].x+nx*width,y:pts[i].y+ny*width});right.push({x:pts[i].x-nx*width,y:pts[i].y-ny*width});
  }
  const path=()=>{c.beginPath();left.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));
    if(p.cape==="Split")c.lineTo(pts[5].x,pts[5].y);
    for(const q of [...right].reverse())c.lineTo(q.x,q.y);c.closePath();};
  path(); c.fillStyle="#071322";c.strokeStyle="#071322";c.lineWidth=2.5;c.fill();c.stroke();
  c.save();path();c.clip();
  const clothProfile={color:p.capeColor,finish:p.cape==="Holographic"?"Iridescent":p.cape==="Ember"?"Magma":p.cape==="Starlight"?"Starfield":"Chrome"};
  c.fillStyle=materialPaint(c,clothProfile,pts[4].x,pts[0].y,35,52,time);
  path();c.fill();
  // Alternating panels form moving silk folds, each driven by its cloth section.
  for(let i=0;i<8;i++) {
    c.beginPath();c.moveTo(left[i].x,left[i].y);c.lineTo(pts[i].x,pts[i].y);c.lineTo(pts[i+1].x,pts[i+1].y);c.lineTo(left[i+1].x,left[i+1].y);c.closePath();
    c.fillStyle=i%2?"#030d2348":"#ffffff18";c.fill();
    if(p.cape==="Starlight")star(c,pts[i].x+(i%2?3:-3),pts[i].y,1.4+(i%3)*.5,"#f5edff",time*.3);
    if(p.cape==="Holographic")line(c,[left[i],right[i]],"#e0fff477",.65);
    if(p.cape==="Ember")line(c,[left[i],pts[Math.min(8,i+2)],right[i]],"#ffb657",.8);
  }
  c.restore();
  const trim=["Royal","Split"].includes(p.cape)?"#f6d88a":p.cape==="Ember"?"#ffb16b":"#c3f5ff";
  line(c,left,trim,1.1);line(c,right,trim,1.1);
  if(p.cape!=="Split")line(c,[left[8],right[8]],trim,1.3);
  if(p.cape==="Royal") {star(c,pts[4].x,pts[4].y,5,"#ffe8a7");dot(c,pts[4].x,pts[4].y,1.5,p.capeColor);}
  dot(c,pts[0].x,pts[0].y,3.4,"#20303c");dot(c,pts[0].x,pts[0].y,2.1,trim);
  c.restore();
}

export function drawTrail(c,p,motion) {
  const points=motion?.trail;
  if(!points?.length || p.trail==="None")return;
  c.save();
  for(let i=0;i<points.length;i++) {
    const q=points[i],fade=Math.max(0,1-q.age/TRAIL_LIFE),prev=points[i-1]||q;
    c.globalAlpha=fade*.6;
    const color=p.trail==="Prism"?`hsl(${(q.seed*19)%360} 90% 73%)`:p.trail==="Embers"?"#ffa653":p.trail==="Frost"?"#c3f7ff":p.color;
    if(["Prism","Ion"].includes(p.trail)) {
      line(c,[prev,q],color,fade*(p.trail==="Ion"?7:10));
      if(p.trail==="Ion") {c.globalAlpha=fade*.85;line(c,[prev,q],"#eefcff",1.3);}
    } else {
      const x=q.x+Math.sin(q.seed)*q.age*30,y=q.y+Math.cos(q.seed*3)*8+(p.trail==="Embers"?-25:15)*q.age;
      if(p.trail==="Petals") {c.save();c.translate(x,y);c.rotate(q.seed+q.age*4);c.fillStyle=i%2?p.color:"#ffd7e9";c.beginPath();c.ellipse(0,0,3.5*fade,1.8*fade,0,0,TAU);c.fill();c.restore();}
      else if(p.trail==="Embers")dot(c,x,y,2.5*fade,color);
      else star(c,x,y,(p.trail==="Frost"?4:3)*fade,i%3?color:"#fff6db",q.seed);
    }
  }
  c.restore();
}

export function drawAura(c,p,time=0,ox=0,oy=0) {
  if(!p.aura || p.aura==="None")return;
  c.save();c.translate(p.x-ox,p.y-oy);c.globalAlpha=.65;
  if(p.aura==="Runes") {
    for(let i=0;i<6;i++){const a=i*TAU/6+time*.35,x=Math.cos(a)*34,y=Math.sin(a)*39-4;
      line(c,[{x:x-2,y:y-3},{x:x+2,y:y},{x:x-2,y:y+3},{x:x-2,y:y-3}],p.color,1);}
  } else for(let i=0;i<(p.aura==="Satellites"?3:5);i++) {
    const a=time*(p.aura==="Satellites"?1.4:.65)+i*2.39996,x=Math.cos(a)*(30+i%2*5),y=Math.sin(a)*39-5;
    if(p.aura==="Satellites"){star(c,x,y,3.5,p.color,a);dot(c,x,y,1,"#fff8df");}
    else {dot(c,x,y,3,p.color+"25");dot(c,x,y,1.1,"#fff3bd");}
  }
  c.restore();
}
