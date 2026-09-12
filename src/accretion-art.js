import { drawAppearance } from "./identity.js";
import { materialPaint } from "./cosmetic-art.js";

export function drawMatter(r, core) {
  const c = r.ctx, radius = core.w / 2;
  c.save();
  if (core.packing > 0) {
    c.globalAlpha = core.packing;
    const halo = c.createRadialGradient(core.x,core.y,radius-1,core.x,core.y,radius+7);
    halo.addColorStop(0,"#c2efff66"); halo.addColorStop(1,"#86c8ff00");
    r.circle(core.x,core.y,radius+7,halo);
    const body = c.createRadialGradient(core.x-radius*.3,core.y-radius*.4,1,core.x,core.y,radius);
    body.addColorStop(0,"#526778"); body.addColorStop(.48,"#273746");
    body.addColorStop(.84,"#101827"); body.addColorStop(1,"#030610");
    r.circle(core.x,core.y,radius,body);
    c.globalAlpha = 1;
  }
  c.save();
  if (core.packing === 1) {
    c.beginPath(); c.arc(core.x,core.y,radius-1,0,Math.PI*2); c.clip();
  }
  // Draw the retained heads over the rubble so dense cores cannot bury them.
  for (let pass = 0; pass < 2; pass++) for (const q of core.items) {
    if ((q.kind === "fighter") !== (pass === 1)) continue;
    c.save(); c.translate(q.x,q.y); c.rotate(q.angle);
    if (q.kind === "weapon" && q.type) {
      r.weapon(q.type,0,0,1,0,.42);
    } else if (q.kind === "fighter") {
      // Compression leaves just the head visible among the collected matter.
      c.scale(.85,.85);
      r.circle(0,0,13,"#11161e");
      r.circle(0,0,10.5,materialPaint(c,q,0,-10,20,20));
      r.line([[2*q.facing,-2],[6*q.facing,-2]],"#18262c",2);
      drawAppearance(c,q,0,0,0,q.facing);
    } else if (q.kind === "prop" && q.sourceKind) {
      c.scale(.27,.27);
      r.table({kind:q.sourceKind,x:-32,y:-20,w:64,h:40,hp:100,maxHp:100,angle:0});
    } else if (q.kind === "trap") {
      r.circle(0,0,q.size,"#44414d");
      for(let i=0;i<8;i++) { const a=i*Math.PI/4;
        r.line([[Math.cos(a)*3,Math.sin(a)*3],[Math.cos(a)*q.size,Math.sin(a)*q.size]],"#bbb4c2",3);
      }
      r.circle(0,0,3,"#292a31");
    } else if (q.kind === "blood" || q.kind === "projectile") {
      r.circle(0,0,q.kind === "blood" ? 2.5 : 3,q.color);
    } else {
      c.fillStyle=q.color;
      c.beginPath(); c.moveTo(-q.size,-q.size*.45); c.lineTo(q.size*.7,-q.size*.65);
      c.lineTo(q.size,q.size*.3); c.lineTo(-q.size*.6,q.size*.6); c.closePath(); c.fill();
      r.line([[-q.size*.7,0],[0,-2],[q.size*.5,2]],"#2d3036",1.5);
    }
    c.restore();
  }
  c.restore();
  if(core.packing>0) {
    c.globalAlpha=core.packing;
    // Transparent edge shading and narrow reflections leave the contents clear.
    const glass=c.createRadialGradient(core.x,core.y,radius*.55,core.x,core.y,radius);
    glass.addColorStop(0,"#badfff00"); glass.addColorStop(.72,"#99dfff12");
    glass.addColorStop(.94,"#b3e9ff55"); glass.addColorStop(1,"#e5f7ffbb");
    r.circle(core.x,core.y,radius,glass);
    c.strokeStyle="#87a8c9"; c.lineWidth=1.2;
    c.beginPath(); c.arc(core.x,core.y,radius,0,Math.PI*2); c.stroke();
    c.lineCap="round";
    c.strokeStyle="#d4f0ff77"; c.lineWidth=5;
    c.beginPath(); c.arc(core.x,core.y,radius-5,Math.PI*1.09,Math.PI*1.55); c.stroke();
    c.strokeStyle="#ffffffee"; c.lineWidth=2.5;
    c.beginPath(); c.arc(core.x,core.y,radius-4,Math.PI*1.15,Math.PI*1.43); c.stroke();
    c.strokeStyle="#79c5f8aa"; c.lineWidth=2;
    c.beginPath(); c.arc(core.x,core.y,radius-3,Math.PI*.08,Math.PI*.4); c.stroke();
  }
  c.restore();
}
