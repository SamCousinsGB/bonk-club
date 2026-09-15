import { POWER_INTERVAL } from "./transmission-arena.js";

const clamp = n => Math.max(0, Math.min(1, n));
const cross = (x, y, a, b) => x*b-y*a;
const project = (p, a, b) => {
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1));
  return {x:a.x+dx*t,y:a.y+dy*t};
};
function contact(a,b,c,d) {
  if(Math.max(a.x,b.x)+10<Math.min(c.x,d.x)||Math.max(c.x,d.x)+10<Math.min(a.x,b.x)||
     Math.max(a.y,b.y)+10<Math.min(c.y,d.y)||Math.max(c.y,d.y)+10<Math.min(a.y,b.y))return null;
  const dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y,den=cross(dx,dy,ex,ey);
  if(Math.abs(den)>1e-8) {
    const t=cross(c.x-a.x,c.y-a.y,ex,ey)/den,u=cross(c.x-a.x,c.y-a.y,dx,dy)/den;
    if(t>=0&&t<=1&&u>=0&&u<=1)return {x:a.x+dx*t,y:a.y+dy*t};
  }
  // Include parallel conductors and end contacts at their actual thickness.
  for(const [p,q] of [[a,project(a,c,d)],[b,project(b,c,d)],[c,project(c,a,b)],[d,project(d,a,b)]])
    if(Math.hypot(p.x-q.x,p.y-q.y)<=10)return {x:(p.x+q.x)/2,y:(p.y+q.y)/2};
  return null;
}

// Derived from the same validated rope geometry on host, guest and hot join.
// A run needs a surviving mount for timed power. Cross-circuit contact bypasses
// the timer, feeding every touching run while any run still has a supply.
export function powerlineCircuit(state) {
  const runs=[],contacts=[];
  for(const cable of state.cables||[]) {
    if(!cable.id.startsWith("tower"))continue;
    const h=state.hazards?.find(h=>h.type==="powerline"&&`tower${h.circuit}`===cable.id);
    for(let i=0;i<cable.links.length;i++) {
      if(!cable.links[i])continue;
      const start=i;
      while(i+1<cable.links.length&&cable.links[i+1])i++;
      const supplied=start===0&&cable.attached[0]||i===cable.links.length-1&&cable.attached[1];
      runs.push({cable:cable.id,points:cable.points.slice(start,i+2),supplied,shorted:false,
        powered:!!(supplied&&h&&!h.done&&(h.age+1e-9)%(POWER_INTERVAL*2)>=POWER_INTERVAL)});
    }
  }
  const parent=runs.map((_,i)=>i),root=i=>{while(parent[i]!==i)i=parent[i];return i;};
  for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++) {
    const a=runs[i],b=runs[j];if(a.cable===b.cable)continue;
    for(let m=1;m<a.points.length;m++)for(let n=1;n<b.points.length;n++) {
      const p=contact(a.points[m-1],a.points[m],b.points[n-1],b.points[n]);
      if(p){parent[root(j)]=root(i);contacts.push({...p,run:i});}
    }
  }
  const supplied=new Set(runs.flatMap((r,i)=>r.supplied?[root(i)]:[]));
  const shorted=new Set(contacts.flatMap(p=>supplied.has(root(p.run))?[root(p.run)]:[]));
  for(let i=0;i<runs.length;i++)if(shorted.has(root(i)))runs[i].shorted=runs[i].powered=true;
  // Bound contact artwork even when two long sections lie on top of each other.
  const arcs=[];
  for(const p of contacts)if(shorted.has(root(p.run))&&arcs.length<8&&
    !arcs.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<55))arcs.push({x:p.x,y:p.y});
  return {runs,arcs};
}

export const poweredWirePieces = state => powerlineCircuit(state).runs.flatMap(r=>
  r.powered?r.points.slice(1).map((b,i)=>({a:r.points[i],b})):[]);
