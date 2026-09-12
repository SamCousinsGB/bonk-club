import { electricArc } from "./electricity-art.js";
import { wirePieces, wireCable } from "./powerlines.js";
import { cableRuns, drawCableStroke } from "./cable-art.js";
import { TOWER_MOUNTS } from "./cable-layout.js";

const line=(c,points,color,width)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
// Rear lattice is open to fighters, like the rear walls in building arenas.
// Each bay belongs to its mounting deck; cuts remove the corresponding artwork.
export function drawTransmissionTowers(c,state) {
  c.save();c.lineJoin="round";
  for(const x of [470,2090]) {
    const half=y=>48+(y-160)*.15;
    for(const [top,bottom] of [[160,440],[440,860],[860,1280]]) {
      const mounts=state.platforms.filter(p=>p.hp!==0&&!p.wreckId&&p.material!=="cable"&&Math.abs(p.y-bottom)<2&&p.x<x+260&&p.x+p.w>x-260);
      if(!mounts.length)continue;
      c.save();c.beginPath();
      for(const p of mounts)c.rect(p.x,top,p.w,bottom-top+8);
      c.clip();
      for(const side of [-1,1]) {
        line(c,[[x+side*half(top),top],[x+side*half(bottom),bottom]],"#17232f",13);
        line(c,[[x+side*half(top),top],[x+side*half(bottom),bottom]],"#99adb5",6);
      }
      for(let y=top;y<bottom;y+=90) {
        const end=Math.min(y+90,bottom);
        line(c,[[x-half(y),y],[x+half(end),end],[x-half(end),end],[x+half(y),y]],"#617983",3);
      }
      c.restore();
    }
    // Peak and cross-arm braces are tied to the surviving steel decks.
    for(const y of [440,860]) for(const side of [-1,1]) {
      const end=x+side*300;
      if(!state.platforms.some(p=>p.hp!==0&&!p.wreckId&&p.x<=end&&p.x+p.w>=end&&p.y===y))continue;
      line(c,[[x+side*half(y-75),y-75],[end,y]],"#819aa4",5);
      const mount = TOWER_MOUNTS.flat().find(m => m.x === end && m.supportY === y);
      const cable = mount && state.cables?.find(q => q.id === `tower${y === 440 ? 0 : 1}`);
      const attached = !mount || cable?.attached[end < 1280 ? 0 : 1];
      if (attached) {
        const tip = mount?.y ?? y + 70;
        line(c,[[end,y+20],[end,tip]],"#574337",6);
        for(let i=0;i<5;i++)line(c,[[end-15,y+28+i*7],[end+15,y+28+i*7]],"#d3935c",5);
        line(c,[[end-8,tip],[end+8,tip]],"#a9b9bb",6);
      }
    }
    if(state.platforms.some(p=>p.hp!==0&&p.x<x&&p.x+p.w>x&&p.y===230))
      line(c,[[x-150,230],[x,140],[x+150,230]],"#a1b3b9",6);
  }
  c.restore();
}
export function drawPowerlines(c,state,time) {
  c.save();c.lineCap="round";
  c.lineJoin = "round";
  for (const cable of state.cables || []) if (cable.id.startsWith("tower")) {
    for (const run of cableRuns(cable)) {
      drawCableStroke(c, run, "#18232d", 11);
      drawCableStroke(c, run, "#768b92", 6);
      drawCableStroke(c, run, "#b1bdb9", 1.4, -1.5);
    }
  }
  for(const h of state.hazards||[]) {
    if(h.type!=="powerline"||h.done)continue;
    const pieces=wirePieces(state,h);
    if(h.active)for(let i=0;i<pieces.length;i+=3) {
      const a=pieces[i],b=pieces[Math.min(i+2,pieces.length-1)];
      electricArc(c,a.a,b.b,time,h.id*109+i,1.1,i%2===0);
    }
    const color=h.active?"#bcfaff":h.warning>0&&Math.sin(time*18)>0?"#ffc565":"#526c6b";
    const cable = wireCable(state, h);
    for(const p of [cable?.points[0],cable?.points.at(-1)].filter(Boolean)) {
      // Indicators sit on the cross-arm, above the hanging insulator.
      c.fillStyle="#182732";c.fillRect(p.x-7,p.y-95,14,18);
      c.fillStyle=color;c.fillRect(p.x-4,p.y-92,8,10);
    }
    if(h.warning>0)for(const p of pieces)line(c,[[p.a.x,p.a.y],[p.b.x,p.b.y]],"#efb965",2);
  }
  c.restore();
}
