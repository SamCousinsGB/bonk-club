export function drawMatter(r, core) {
  const c = r.ctx, radius = core.w / 2;
  c.save();
  if (core.packing > 0) {
    c.globalAlpha = core.packing;
    r.circle(core.x,core.y,radius,"#1c2027");
    r.circle(core.x,core.y,radius-3,"#59534e");
    c.globalAlpha = 1;
  }
  // Draw the retained heads over the rubble so dense cores cannot bury them.
  for (let pass = 0; pass < 2; pass++) for (const q of core.items) {
    if ((q.kind === "fighter") !== (pass === 1)) continue;
    c.save(); c.translate(q.x,q.y); c.rotate(q.angle);
    if (q.kind === "weapon" && q.type) {
      r.weapon(q.type,0,0,1,0,.42);
    } else if (q.kind === "fighter") {
      // Compression leaves just the head visible among the collected matter.
      r.circle(0,0,8,"#11161e");
      r.circle(0,0,6.5,q.color);
      r.line([[2,-2],[4,-2]],"#18262c",1.5);
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
  if(core.packing>0) {
    c.strokeStyle="#c5b7a155"; c.lineWidth=2;
    c.beginPath(); c.arc(core.x,core.y,radius-.5,Math.PI,Math.PI*1.8); c.stroke();
  }
  c.restore();
}
