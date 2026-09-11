import { conductorNodes, conductorBounds, conductorPolygon, conductorsTouch } from "./conductors.js";
import { hazardZone } from "./hazards.js";
import { JOINTS } from "./puppet.js";

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const seedOf=b=>String(b.id).split("").reduce((n,c)=>(n*31+c.charCodeAt(0))%65521,0);
const water=b=>b.grounded!==undefined;
const anchor=b=>water(b)?{x:b.x+b.w/2,y:b.grounded?b.y-1:b.y+b.h*.65}:{x:b.x+b.w/2,y:b.y+b.h/2};
export const CIRCUIT_NODE_LIMIT=320, CIRCUIT_LINK_LIMIT=256;

// A bounded spanning forest shows continuous chains, without drawing every
// possible connection in a pile of metal. Charge still comes only from the host.
export function visibleCircuit(state) {
  const nodes=conductorNodes(state).filter(b=>b.charge).slice(0,CIRCUIT_NODE_LIMIT);
  const boxes=nodes.map(conductorBounds),parent=nodes.map((_,i)=>i),links=[];
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const order=nodes.map((_,i)=>i).sort((a,b)=>boxes[a].x-boxes[b].x);
  for(let n=0;n<order.length && links.length<CIRCUIT_LINK_LIMIT;n++) {
    const i=order[n];
    for(let m=n+1;m<order.length && links.length<CIRCUIT_LINK_LIMIT;m++) {
      const j=order[m];if(boxes[j].x>boxes[i].x+boxes[i].w+1.2)break;
      if(root(i)===root(j)||!conductorsTouch(nodes[i],nodes[j],state.platforms,boxes[i],boxes[j]))continue;
      parent[root(j)]=root(i);links.push([nodes[i],nodes[j]]);
    }
  }
  return {nodes,links};
}

function poolRuns(nodes,links) {
  const pools=nodes.filter(b=>water(b)&&b.grounded),parent=new Map(pools.map(b=>[b,b]));
  const root=b=>{while(parent.get(b)!==b)b=parent.get(b);return b;};
  const joined=new Set();
  for(const link of links) {
    const [a,b]=link;
    if(!parent.has(a)||!parent.has(b)||Math.abs(a.y+a.h-b.y-b.h)>2)continue;
    parent.set(root(b),root(a));joined.add(link);
  }
  const groups=new Map();
  for(const b of pools){const r=root(b);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(b);}
  return {runs:[...groups.values()].filter(g=>g.length>1).map(g=>g.sort((a,b)=>a.x-b.x)),joined};
}

// Keep endpoints attached while the channel writhes and repeatedly rebranches.
// Smooth noise interpolation avoids replacing the entire bolt on every frame.
export function arcPoints(a,b,time,seed,amplitude=9) {
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  const count=clamp(Math.ceil(len/9),3,36),tick=time*13,k=Math.floor(tick),t=tick-k,s=t*t*(3-2*t);
  return Array.from({length:count+1},(_,i)=>{
    const u=i/count,n0=noise(seed+i*17+k*101),n1=noise(seed+i*17+(k+1)*101);
    const offset=i===0||i===count?0:((n0+(n1-n0)*s)*2-1)*amplitude*Math.sin(Math.PI*u);
    return {x:a.x+dx*u-dy/len*offset,y:a.y+dy*u+dx/len*offset};
  });
}
function stroke(c,points,color,width) {
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));
  c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function channel(c,points,power=1) {
  stroke(c,points,"#6a56f52a",13*power);
  stroke(c,points,"#41ccff55",7*power);
  stroke(c,points,"#70ebff",2.9*power);
  stroke(c,points,"#f1ffff",1.25*power);
}
function arc(c,a,b,time,seed,power=1,branches=true) {
  const points=arcPoints(a,b,time,seed,Math.min(17,5+Math.hypot(b.x-a.x,b.y-a.y)*.15));
  channel(c,points,power);
  if(branches)for(let i=0;i<2;i++) {
    const index=1+Math.floor(noise(seed+i+Math.floor(time*7))*(points.length-2)),p=points[index];
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,side=i?1:-1;
    const reach=(14+noise(seed+i*9)*39)*power;
    const end={x:p.x+dx/len*reach*.4-dy/len*reach*side,y:p.y+dy/len*reach*.4+dx/len*reach*side};
    const fork=arcPoints(p,end,time,seed+71+i,6);
    stroke(c,fork,"#6ee6ff80",3*power);stroke(c,fork,"#dcffffdd",.85*power);
  }
  // Bright pulses travel along the channel, not a global screen flash.
  const u=(time*2.7+noise(seed))%1,p=points[Math.floor(u*(points.length-1))];
  c.fillStyle="#edffff";c.beginPath();c.arc(p.x,p.y,1.5*power,0,Math.PI*2);c.fill();
}
function perimeterPoint(poly,distance) {
  const lengths=poly.map((p,i)=>Math.hypot(poly[(i+1)%poly.length].x-p.x,poly[(i+1)%poly.length].y-p.y));
  const total=lengths.reduce((a,b)=>a+b,0);let d=((distance%1)+1)%1*total;
  for(let i=0;i<poly.length;i++) {
    if(d<=lengths[i]||i===poly.length-1){const t=d/(lengths[i]||1),a=poly[i],b=poly[(i+1)%poly.length];return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
    d-=lengths[i];
  }
}
export function drawElectricity(c,state,time) {
  const {nodes,links}=visibleCircuit(state);if(!nodes.length)return;
  const {runs,joined}=poolRuns(nodes,links),connected=new Set(links.flat());
  c.save();c.lineCap="round";c.lineJoin="round";
  for(const link of links)if(!joined.has(link)) {
    const [a,b]=link;arc(c,anchor(a),anchor(b),time,seedOf(a)+seedOf(b),1,true);
  }
  for(const run of runs) {
    const points=run.flatMap((b,i)=>i?arcPoints(anchor(run[i-1]),anchor(b),time,seedOf(run[0])+i,11).slice(1):[anchor(b)]);
    channel(c,points,1.1);
    // Longer forks leap between contacts within this same continuous pool.
    // Their roots slide across the water instead of repeating a bolt per cell.
    const index=Math.floor((time*.9+noise(seedOf(run[0])))%1*(run.length-1));
    const a=anchor(run[index]),b=anchor(run[Math.min(run.length-1,index+3)]);
    arc(c,a,b,time,seedOf(run[0])+177,1.15);
  }
  for(const b of nodes) {
    const seed=seedOf(b);
    if(water(b)) {
      // Discharge IN the fluid, with a reflected cyan glow beneath the surface.
      if(b.grounded){
        c.fillStyle="#9beaff28";c.fillRect(b.x,b.y,b.w,Math.min(b.h,12));
        if(!connected.has(b))arc(c,{x:b.x+2,y:b.y},{x:b.x+b.w-2,y:b.y},time,seed,.9);
      }else arc(c,{x:b.x+b.w/2,y:b.y-10},{x:b.x+b.w/2,y:b.y+b.h},time,seed,.8);
    }else {
      const poly=conductorPolygon(b),start=time*.7+noise(seed),points=[];
      // Multiple corner-following segments crawl around the rotating silhouette.
      for(let i=0;i<9;i++)points.push(perimeterPoint(poly,start+i*.065));
      const writhing=points.flatMap((p,i)=>i?arcPoints(points[i-1],p,time,seed+i,5).slice(1):[p]);
      channel(c,writhing,b.chunk?.6:1);
      arc(c,perimeterPoint(poly,start+.65),perimeterPoint(poly,start+.87),time,seed+89,b.chunk?.5:.8,false);
    }
  }
  for(const h of state.hazards||[])if(h.type==="tesla"&&h.active&&!h.done) {
    const z=hazardZone(h),near=nodes.filter(b=>{const a=conductorBounds(b);return a.x<z.x+z.w+2&&a.x+a.w>z.x-2&&a.y<z.y+z.h+2&&a.y+a.h>z.y-2;});
    for(const b of near.slice(0,2))arc(c,{x:h.x,y:h.y-12},anchor(b),time,seedOf(b)+h.id,1.15);
  }
  for(const p of state.players||[])if(p.alive&&p.xray>0&&p.xrayType==="tesla"&&p.rig) {
    const closest=nodes.map(b=>({b,a:anchor(b)})).sort((a,b)=>Math.hypot(a.a.x-p.x,a.a.y-p.y)-Math.hypot(b.a.x-p.x,b.a.y-p.y))[0];
    if(Math.hypot(closest.a.x-p.x,closest.a.y-p.y)<130)
      arc(c,closest.a,p.rig[8],time,p.id+59,1.2);
    for(const [i,[a,b]] of JOINTS.entries())if(i%2===0)arc(c,p.rig[a],p.rig[b],time,p.id*19+i,.75,false);
  }
  c.restore();
}
