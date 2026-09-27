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
export function drawBridgeStructure(c,state) {
  const live=state.platforms.filter(p=>p.hp!==0),walks=live.filter(p=>p.bridgePart==='walk');
  // Continuous rear legs give each open tower one coherent silhouette. These
  // recessed faces are scenery; front column pieces retain service doorways.
  for(const x of [320,1920])if(live.some(p=>p.bridgePart==='cap'&&p.x<=x+160&&p.x+p.w>=x+160)){
    for(const u of [x,x+286]){
      rect(c,u+3,272,28,1168,'#694c48');rect(c,u+5,272,4,1168,'#a77b6160');
      rect(c,u+26,272,5,1168,'#322e36');
      for(let y=300;y<1440;y+=190)rect(c,u+3,y,28,8,'#815b50');
    }
    for(const [top,bottom] of [[278,440],[475,640],[920,1030],[1065,1240],[1280,1440]]){
      // Low-contrast rear bracing leaves the harbour visible through the tower.
      if(bottom<1440&&!walks.some(p=>p.x<=x+160&&p.x+p.w>=x+160&&Math.abs(p.y-bottom-10)<2))continue;
      line(c,[[x+34,top],[x+286,bottom]],'#54565a',7);
      line(c,[[x+286,top],[x+34,bottom]],'#54565a',7);
    }
    if(walks.some(p=>p.x<=x+160&&p.x+p.w>=x+160&&Math.abs(p.y-650)<2)){
      line(c,[[x+34,675],[x+286,675]],'#5d4b49',14);
      fixture(c,x+160,683);
    }
  }
  for(const p of walks){
    railing(c,p);
    // Brackets terminate at the actual tower leg, never in empty space.
    if(p.w>100&&p.bridgeBay===undefined){
      const tower=p.x<1280?320:1920;
      for(const root of [tower+17,tower+303]){
        const tip=root===tower+17?p.x+8:p.x+p.w-8;
        if(root<p.x||root>p.x+p.w||Math.abs(tip-root)<25)continue;
        line(c,[[tip,p.y+p.h],[root,p.y+p.h+65],[root,p.y+p.h]],'#283d48',7);
        line(c,[[tip,p.y+p.h],[root,p.y+p.h+65]],'#7b8585',1.5);
      }
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
    const ox=x-(p.bridgeOffsetX||0),oy=y-(p.bridgeOffsetY||0);
    rect(c,x,y,w,h,'#293e48');rect(c,x,oy,w,9,'#30343a');rect(c,x,oy,w,2,'#d5c9a5');
    rect(c,x,oy+10,w,3,'#89928a');rect(c,x,oy+46,w,6,'#667e83');
    for(let u=ox;u<x+w;u+=90){
      line(c,[[u,oy+16],[u+45,oy+45],[u+90,oy+16]],'#536d78',4);
      disc(c,u+45,oy+44,2,'#99a9a6');
    }
    // A thin joint keeps adjacent road tiles readable as one continuous deck.
    if(p.bridgePanel!==undefined)rect(c,ox,oy+13,1,33,'#20333e');
  }else if(p.bridgePart==='walk'){
    rect(c,x,y,w,h,'#172f3e');rect(c,x,y,w,4,'#dfbd75');rect(c,x,y+h-3,w,3,'#73868a');
    for(let u=x+5;u<x+w;u+=12)rect(c,u,y+6,4,h-9,'#779297');
    for(let u=x+8;u<x+w;u+=72){rect(c,u,y+2,25,2,'#f4dba1');}
  }else{
    const g=c.createLinearGradient(x,y,x+w,y+h*.05);
    g.addColorStop(0,'#694a44');g.addColorStop(.16,'#a9795c');g.addColorStop(.32,'#8b5e4c');g.addColorStop(.82,'#755045');g.addColorStop(1,'#3e3036');
    rect(c,x,y,w,h,g);rect(c,x+2,y+2,3,h-4,'#ba896260');rect(c,x+w-7,y,5,h,'#3e3036');
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
