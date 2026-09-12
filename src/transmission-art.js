import { electricArc } from "./electricity-art.js";
import { wireCable } from "./powerlines.js";
import { cableRuns, drawCableStroke } from "./cable-art.js";
import { TOWER_MOUNTS, TOWER_LEVELS, PYLON_CENTRES, TOWER_TOP, TOWER_BASE, towerHalfWidth } from "./cable-layout.js";

const line=(c,pts,color,width)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const bolt=(c,x,y,r=3)=>{c.fillStyle="#c3ced0";c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
function beam(c,pts,width=13) {
  line(c,pts,"#15232e",width+5);line(c,pts,"#7f98a3",width);
  line(c,pts.map(([x,y])=>[x-1.5,y-1.5]),"#bdcbd0",2);
}
const supported=(s,x,y)=>s.platforms.some(p=>p.hp!==0&&!p.wreckId&&p.x<=x&&p.x+p.w>=x&&Math.abs(p.y-y)<2);

// Broad tapered steelwork fills the arena. Each bay belongs to its supporting
// deck, so rear lattice and insulator art agree with actual destruction.
export function drawTransmissionTowers(c,state) {
  c.save();c.lineJoin="round";c.lineCap="round";
  for(const x of PYLON_CENTRES) {
    for(const [top,bottom] of [[90,TOWER_LEVELS[0]],[...TOWER_LEVELS],[TOWER_LEVELS[1],TOWER_BASE]]) {
      const mounts=state.platforms.filter(p=>p.hp!==0&&!p.wreckId&&Math.abs(p.y-bottom)<2&&p.x<x+440&&p.x+p.w>x-440);
      if(!mounts.length)continue;
      c.save();c.beginPath();for(const p of mounts)c.rect(p.x,top,p.w,bottom-top+15);c.clip();
      for(const side of [-1,1]) {
        const a=[x+side*towerHalfWidth(top),top],b=[x+side*towerHalfWidth(bottom),bottom];
        beam(c,[a,b],16);
        line(c,[[a[0]+side*13,top],[b[0]+side*13,bottom]],"#465e6b",5);
      }
      const bays=Math.ceil((bottom-top)/150);
      for(let i=0;i<bays;i++) {
        const y=top+(bottom-top)*i/bays,end=top+(bottom-top)*(i+1)/bays,
          l=x-towerHalfWidth(y),r=x+towerHalfWidth(y),bl=x-towerHalfWidth(end),br=x+towerHalfWidth(end);
        beam(c,[[l,y],[br,end]],5);beam(c,[[r,y],[bl,end]],5);
        line(c,[[bl,end],[br,end]],"#79909a",6);
        for(const [bx,by] of [[l,y],[r,y],[bl,end],[br,end]]) {
          c.fillStyle="#435966";c.fillRect(bx-9,by-12,18,24);bolt(c,bx,by-5,2.3);bolt(c,bx,by+5,2.3);
        }
        bolt(c,x,(y+end)/2,3);
      }
      // Recessed service ladder is artwork, never a platform.
      for(const dx of [-14,14])line(c,[[x+dx,top],[x+dx,bottom]],"#3c505d",3);
      for(let y=top+12;y<bottom;y+=24)line(c,[[x-14,y],[x+14,y]],"#5a707b",2);
      c.restore();
    }
    for(const [index,y] of TOWER_LEVELS.entries()) {
      for(const side of [-1,1]) {
        const end=x+side*(x<1280?side<0?430:480:side>0?430:480);
        if(!supported(state,end,y))continue;
        beam(c,[[x+side*towerHalfWidth(y-120),y-120],[end,y]],9);
        line(c,[[x+side*towerHalfWidth(y-75),y-75],[end-side*160,y]],"#647e8b",4);
        for(const dx of [140,260,380]) {
          const xx=x+side*dx;line(c,[[xx,y-24],[xx+side*32,y]],"#5f7986",4);
        }
      }
      const mount=TOWER_MOUNTS[index][x<1280?0:1],cable=state.cables?.find(q=>q.id==="tower"+index);
      if(cable?.attached[x<1280?0:1]&&supported(state,mount.x,y)) {
        beam(c,[[mount.x,y+20],[mount.x,mount.y]],5);
        for(let i=0;i<6;i++) {
          const yy=y+28+i*6;
          line(c,[[mount.x-18,yy],[mount.x+18,yy]],"#694b32",7);
          line(c,[[mount.x-16,yy-2],[mount.x+16,yy-2]],"#d9ad73",3);
        }
        line(c,[[mount.x-9,mount.y],[mount.x+9,mount.y]],"#d4dedc",7);
      }
    }
    if(supported(state,x,150)) {
      beam(c,[[x-180,150],[x,TOWER_TOP],[x+180,150]],9);
      line(c,[[x,TOWER_TOP],[x,150]],"#718d9b",6);
      line(c,[[x,TOWER_TOP-32],[x,TOWER_TOP]],"#b9c9cd",4);
    }
    for(const side of [-1,1]) {
      const foot=x+side*towerHalfWidth(TOWER_BASE);
      if(!supported(state,foot,TOWER_BASE))continue;
      c.fillStyle="#314451";c.fillRect(foot-33,TOWER_BASE-18,66,30);
      line(c,[[foot-35,TOWER_BASE-18],[foot+35,TOWER_BASE-18]],"#9aacb3",6);
      for(const dx of [-22,22])bolt(c,foot+dx,TOWER_BASE-10,3);
    }
  }
  c.restore();
}

export function drawPowerlines(c,state,time) {
  c.save();c.lineCap="round";c.lineJoin="round";
  for(const cable of state.cables||[])if(cable.id.startsWith("tower")) {
    const runs=cableRuns(cable),h=state.hazards?.find(h=>h.type==="powerline"&&"tower"+h.circuit===cable.id);
    for(const run of runs) {
      drawCableStroke(c,run,"#18232d",11);drawCableStroke(c,run,"#899b9f",6);
      drawCableStroke(c,run,"#c4ceca",1.4,-1.5);
      // Energize each surviving run independently, never across a cut gap.
      if(h?.active&&!h.done)for(let i=0;i<run.length-1;i+=2)
        electricArc(c,run[i],run[Math.min(i+2,run.length-1)],time,h.id*109+i,1.1,i%4===0);
      if(h?.warning>0)drawCableStroke(c,run,"#efb965",2);
    }
  }
  for(const h of state.hazards||[]) {
    if(h.type!=="powerline"||h.done)continue;
    const color=h.active?"#bcfaff":h.warning>0&&Math.sin(time*18)>0?"#ffc565":"#526c6b",cable=wireCable(state,h);
    for(const [i,p] of TOWER_MOUNTS[h.circuit].entries())if(cable?.attached[i]) {
      c.fillStyle="#182732";c.fillRect(p.x-8,p.supportY-26,16,20);
      c.fillStyle=color;c.fillRect(p.x-4,p.supportY-22,8,12);
    }
  }
  c.restore();
}
