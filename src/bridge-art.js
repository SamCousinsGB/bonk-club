import { cableRuns } from './cable-art.js';
import { BRIDGE_BAYS, bridgeBayMounts } from './bridge-arena.js';

const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const line=(c,points,color,width=2)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const polygon=(c,points,color)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();};
const disc=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#ffcd8200');disc(c,x,y,r,g);}
function bolts(c,x,y,w,h){for(const u of [x+7,x+w-7])for(const v of [y+8,y+h-8]){disc(c,u,v,2.5,'#402e30');disc(c,u-.6,v-.8,1.5,'#d39373');}}

// The harbour is distant scenery. Every foreground floor and column is drawn
// separately from the surviving collision pieces below.
export function drawBridgeHall(c) {
  const sky=c.createLinearGradient(0,0,0,1440);
  sky.addColorStop(0,'#142a40');sky.addColorStop(.47,'#536374');sky.addColorStop(.76,'#b49a8b');sky.addColorStop(1,'#71818a');
  rect(c,0,0,2560,1440,sky);
  const light=c.createRadialGradient(1340,780,30,1340,780,1020);
  light.addColorStop(0,'#ffd5a637');light.addColorStop(1,'#ffd5a600');rect(c,0,0,2560,1440,light);
  for(let i=0;i<16;i++){
    const x=(i*337)%2700-160,y=110+(i*83)%550;
    line(c,[[x,y],[x+120,y-8],[x+360,y+6],[x+510,y]],'#c4c1b60b',8+i%4*5);
  }
  polygon(c,[[0,1050],[160,955],[370,989],[610,1044],[860,940],[1120,1000],[1370,960],[1580,1020],[1890,917],[2140,998],[2370,956],[2560,1020],[2560,1440],[0,1440]],'#526571');
  for(let i=0;i<54;i++){
    const x=i*51-12,w=28+(i*31)%39,h=35+(i*47)%138,y=1120-h;
    rect(c,x,y,w,h,'#435967');rect(c,x+6,y-5,w-12,5,'#506774');
    for(let u=7;u<w-5;u+=13)for(let v=12;v<h-6;v+=19)if((u+v+i)%5<2)rect(c,x+u,y+v,3,5,'#c8b29755');
  }
  // Low dock cranes and a container ship establish the height above the water.
  for(const [x,y,dir] of [[95,1000,1],[910,1050,-1],[1700,1020,1],[2400,990,-1]]){
    line(c,[[x,y+155],[x,y],[x+dir*185,y+45],[x,y+45]],'#344d5b',7);
    line(c,[[x-dir*50,y+155],[x,y+45],[x+dir*40,y+155]],'#344d5b',4);
    line(c,[[x+dir*154,y+39],[x+dir*154,y+117]],'#415d69',2);
  }
  const sea=c.createLinearGradient(0,1140,0,1440);sea.addColorStop(0,'#506876');sea.addColorStop(1,'#152f43');rect(c,0,1140,2560,300,sea);
  for(let i=0;i<160;i++){
    const x=(i*193)%2560,y=1150+(i*47)%289,w=12+(i*31)%110;
    rect(c,x,y,w,i%4?1:2,i%3?'#95aca518':'#e8bea82b');
  }
  polygon(c,[[930,1180],[1200,1180],[1170,1202],[960,1202]],'#304b5b');
  for(let i=0;i<7;i++)rect(c,969+i*27,1163-(i%2)*14,24,17+(i%2)*14,['#5f6b6a','#786e65','#536a72'][i%3]);
  rect(c,1151,1136,23,43,'#81918f');rect(c,1158,1119,4,20,'#4b6773');
  line(c,[[0,1141],[2560,1141]],'#d0b7a139',2);
}

function railing(c,p){
  // Rear guard rails are pass-through, with the bright floor edge below them.
  const y=p.y-49;
  line(c,[[p.x+3,y],[p.x+p.w-3,y]],'#526774',3);
  for(let x=p.x+7;x<p.x+p.w-3;x+=48)line(c,[[x,y],[x,p.y-3]],'#415968',3);
  line(c,[[p.x+3,y+23],[p.x+p.w-3,y+23]],'#415968',2);
}
function fixture(c,x,y){
  glow(c,x,y+4,48,'#ffd18d20');rect(c,x-19,y-5,38,9,'#172b38');rect(c,x-14,y+4,28,4,'#ffe1a5');
}
function room(c,x,y,w,h){
  const g=c.createLinearGradient(x,y,x+w,y);g.addColorStop(0,'#252d39');g.addColorStop(.5,'#35404a');g.addColorStop(1,'#202e3a');
  rect(c,x,y,w,h,g);
  rect(c,x+12,y+8,w-24,h-16,'#151f2a45');
  line(c,[[x+8,y+h-10],[x+w/2,y+14],[x+w-8,y+h-10]],'#46505a',7);
  line(c,[[x+8,y+h-10],[x+w/2,y+14],[x+w-8,y+h-10]],'#7b73704a',2);
  for(let v=y+16;v<y+h-4;v+=41)rect(c,x+4,v,w-8,1,'#a8938120');
  const ex=x+30,ey=y+h-69;
  rect(c,ex,ey,44,61,'#192b36');rect(c,ex+3,ey+3,38,53,'#53626b');
  for(let v=0;v<4;v++)rect(c,ex+9,ey+11+v*5,26,2,'#243842');
  rect(c,ex+29,ey+37,5,8,'#adb6ac');disc(c,ex+11,ey+42,2,'#d1b17f');
  line(c,[[x+w-26,y+6],[x+w-26,y+h-26],[x+w-42,y+h-26]],'#1a2b36',8);
  line(c,[[x+w-26,y+6],[x+w-26,y+h-26],[x+w-42,y+h-26]],'#71808a',3);
  fixture(c,x+w/2,y+22);
}

export function drawBridgeStructure(c,state) {
  const live=state.platforms.filter(p=>p.hp!==0),walks=live.filter(p=>p.bridgePart==='walk');
  // Recessed rear legs frame the road portal. Their muted depth separates
  // this cutaway wall from the bright playable columns and floor edges.
  for(const x of [320,1920])if(live.some(p=>p.bridgePart==='cap'&&p.x<=x+160&&p.x+p.w>=x+160)){
    for(const u of [x+45,x+254]){
      rect(c,u,270,22,1170,'#493e43');rect(c,u+3,270,3,1170,'#8a696052');
      for(let y=293;y<1440;y+=130)rect(c,u-2,y,26,9,'#6e5250');
    }
    polygon(c,[[x+45,674],[x+135,718],[x+188,718],[x+276,674]],'#39404a');
    line(c,[[x+45,674],[x+135,718],[x+188,718],[x+276,674]],'#80675c',4);
    fixture(c,x+160,717);
    rect(c,x+45,919,231,15,'#3b424a');rect(c,x+45,919,231,3,'#846e5c');
  }
  // Interior back walls and equipment only remain while their room floor survives.
  for(const x of [320,1920])for(const [y,h] of [[450,176],[650,174],[1040,116],[1250,184]]){
    if(walks.some(p=>p.x<=x+160&&p.x+p.w>=x+160&&Math.abs(p.y-y)<2))room(c,x+34,y-h,252,h);
  }
  for(const p of walks){
    railing(c,p);
    // Individual diagonal brackets make the side balconies read as cantilevers.
    if(p.w>100&&p.bridgeBay===undefined){
      const side=p.x<1280?1:-1,root=side>0?p.x+p.w-12:p.x+12,tip=root-side*Math.min(110,p.w*.4);
      line(c,[[tip,p.y+p.h],[root,p.y+p.h+57],[root,p.y+p.h]],'#172d3b',9);
      line(c,[[tip,p.y+p.h],[root,p.y+p.h+57]],'#74818a',2);
    }
  }
  // Each maintenance bay is hung independently; no line bridges a missing road tile.
  for(const p of walks.filter(p=>p.bridgeBay!==undefined)){
    const spec=BRIDGE_BAYS[p.bridgeBay];
    bridgeBayMounts(live,p.bridgeBay).forEach((m,i)=>{
      const offset=i?spec.w-16:16;
      if(!m||offset<(p.bridgeOffsetX||0)||offset>(p.bridgeOffsetX||0)+p.w)return;
      const x=p.x-(p.bridgeOffsetX||0)+offset;
      line(c,[[m.x,m.y],[x,p.y]],'#203b4b',7);line(c,[[m.x-1,m.y],[x-1,p.y]],'#7f9499',2);
      rect(c,x-6,p.y-10,12,10,'#c0a170');
    });
  }
  const panels=live.filter(p=>Number.isInteger(p.bridgePanel));
  for(const cable of state.cables||[])if(cable.id.startsWith('bridge')){
    c.lineCap='round';
    for(const run of cableRuns(cable)){
      const points=run.map(p=>[p.x,p.y]);
      line(c,points,'#172a38',16);line(c,points,'#687c87',10);line(c,points,'#c2c7bb',4);
    }
    for(let i=1;i<cable.points.length-1;i+=2){
      if(!cable.links[i-1]||!cable.links[i])continue;
      const q=cable.points[i],panel=panels.find(p=>q.x>=p.x&&q.x<=p.x+p.w);
      if(!panel||panel.y<q.y+15)continue;
      line(c,[[q.x,q.y],[q.x,panel.y]],'#1c3443',6);
      line(c,[[q.x-1,q.y],[q.x-1,panel.y]],'#aebdb9',2);
      rect(c,q.x-5,q.y-4,10,8,'#607984');rect(c,q.x-7,panel.y-13,14,9,'#b18c68');
    }
    for(const [i,attached] of cable.attached.entries())if(attached){
      const p=cable.points[i?cable.points.length-1:0];disc(c,p.x,p.y,12,'#263843');disc(c,p.x,p.y,7,'#e0b28a');disc(c,p.x,p.y,3,'#5c4945');
    }
  }
  c.lineCap='butt';
  // Short exposed hinges only join complete adjacent tiles in the same span.
  // A cut fragment must never produce a new beam across the centre or a crater.
  for(let id=0;id<15;id++){
    if(id===7)continue;
    const a=panels.find(p=>p.bridgePanel===id&&p.w>=89&&p.h>=51),b=panels.find(p=>p.bridgePanel===id+1&&p.w>=89&&p.h>=51);
    if(!a||!b)continue;
    const ax=a.x+a.w/2,bx=b.x+b.w/2,by=b.y+26,ay=a.y+26;
    if(Math.hypot(bx-ax,by-ay)>115)continue;
    line(c,[[ax,ay],[bx,by]],'#142c3a',30);line(c,[[ax,ay],[bx,by]],'#778b90',9);
    disc(c,ax,ay,7,'#182f3b');disc(c,ax,ay,3,'#d4b884');
  }
}

// Called through the shared carved-platform clipper, so paint, seams and bolts
// disappear with exactly the same slices as the colliding metal.
export function drawBridgePlatform(c,p){
  const {x,y,w,h}=p;
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
  if(p.bridgePart==='road'){
    rect(c,x,y,w,h,'#233e4b');rect(c,x,y,w,9,'#28323b');rect(c,x,y,w,2,'#d5c9a5');
    rect(c,x,y+9,w,5,'#a59c84');rect(c,x,y+h-6,w,6,'#869492');
    for(let u=x+8;u<x+w;u+=45){
      line(c,[[u,y+18],[u+29,y+h-9],[u+40,y+18]],'#5d7580',5);
      disc(c,u+1,y+18,2,'#bec2aa');disc(c,u+29,y+h-9,2,'#bec2aa');
    }
    for(let u=x+7;u<x+w;u+=90)rect(c,u,y+5,31,2,'#c6ac70');
    rect(c,x,y,3,h,'#142c38');rect(c,x+w-3,y,3,h,'#142c38');
  }else if(p.bridgePart==='walk'){
    rect(c,x,y,w,h,'#172f3e');rect(c,x,y,w,4,'#dfbd75');rect(c,x,y+h-3,w,3,'#73868a');
    for(let u=x+5;u<x+w;u+=12)rect(c,u,y+6,4,h-9,'#779297');
    for(let u=x+8;u<x+w;u+=72){rect(c,u,y+2,25,2,'#f4dba1');}
  }else{
    const g=c.createLinearGradient(x,y,x+w,y+h*.05);
    g.addColorStop(0,'#713f3c');g.addColorStop(.16,'#cf8767');g.addColorStop(.32,'#a65f4e');g.addColorStop(.82,'#8b4e44');g.addColorStop(1,'#432f34');
    rect(c,x,y,w,h,g);rect(c,x+2,y+2,4,h-4,'#e4a57a');rect(c,x+w-7,y,5,h,'#3e3036');
    if(p.bridgePart==='cap'){
      rect(c,x,y,w,5,'#edb786');rect(c,x,y+h-8,w,8,'#4e3438');
      for(let u=x+12;u<x+w;u+=45)bolts(c,u,y,25,h);
    }else{
      for(let v=y+8;v<y+h;v+=92){rect(c,x,v,w,13,'#b77459');rect(c,x,v+13,w,3,'#512f32');bolts(c,x,v,w,14);}
      for(let v=y+30;v<y+h;v+=137)rect(c,x+10,v,3,26,'#d5926d35');
    }
  }
  c.restore();
}

export function drawBridgeAtmosphere(c,time,reduced){
  for(let i=0;i<18;i++){
    const x=(i*179+(reduced?0:time*9))%2560,y=1310+(i*31)%130;
    rect(c,x,y,27+i%4*19,1,'#c3d0c51c');
  }
}
