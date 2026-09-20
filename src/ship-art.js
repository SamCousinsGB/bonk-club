import { SHIP, shipBottom, shipPose, seaLevel, shipLevels, shipOpenings } from './ship.js';

const path=(c,points)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();};
const line=(c,points,color,width=2)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
const gradient=(c,y,h,stops)=>{const g=c.createLinearGradient(0,y,0,y+h);stops.forEach(([at,color])=>g.addColorStop(at,color));return g;};
function hullPath(c){path(c,[[230,680],[2350,680],[2120,1130],[440,1130]]);}
function lamp(c,x,y,color='#ffcf88',r=65){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color+'52');g.addColorStop(1,color+'00');circle(c,x,y,r,g);rect(c,x-15,y-3,30,6,color);}
function rail(c,x,y,w){line(c,[[x,y],[x+w,y]],'#cad8d4',4);line(c,[[x,y+20],[x+w,y+20]],'#759394',2);for(let a=x;a<=x+w;a+=44)line(c,[[a,y],[a,y+44]],'#b6c9c5',3);}

export function drawShipSky(c,time,reduced){
  rect(c,0,0,2560,1440,gradient(c,0,1000,[[0,'#091927'],[.48,'#284857'],[.7,'#b18e7e'],[1,'#183645']]));
  const glow=c.createRadialGradient(2040,450,10,2040,450,600);glow.addColorStop(0,'#ffdaa660');glow.addColorStop(1,'#e6ab7800');rect(c,1100,0,1460,1000,glow);
  circle(c,2050,460,62,'#f4cf9b');
  for(let n=0;n<18;n++) {
    const x=((n*331+(reduced?0:time*(2+n%3)))%3100)-260,y=110+(n*113)%390;
    const w=230+n%4*80,h=12+n%3*10;
    c.fillStyle=gradient(c,y-h,h*2,[[0,'#69818b00'],[.4,n%3===0?'#102b3a60':'#81909632'],[1,'#122a3a00']]);
    c.beginPath();c.moveTo(x-w,y);c.bezierCurveTo(x-w*.6,y-h,x-w*.35,y-h*.2,x-w*.15,y-h);
    c.bezierCurveTo(x+w*.2,y-h*2,x+w*.45,y-h*.4,x+w,y-h*.2);
    c.bezierCurveTo(x+w*.4,y+h,x-w*.6,y+h,x-w,y);c.fill();
  }
  path(c,[[0,795],[260,767],[520,786],[680,751],[885,786],[1100,777],[1500,801],[2560,807],[2560,860],[0,860]]);c.fillStyle='#183544';c.fill();
  rect(c,0,812,2560,628,gradient(c,812,628,[[0,'#4b7279'],[.11,'#234c5d'],[.6,'#102d40'],[1,'#081b2c']]));
  for(let n=0;n<90;n++) {
    const y=827+(n*61)%640,x=(n*233+(reduced?0:time*(10+n%7)))%2830-150;
    line(c,[[x,y],[x+40+n%7*18,y-2],[x+100+n%6*21,y]],n%4===0?'#89b6b04a':'#528b9b24',n%3+1);
  }
  for(let n=0;n<30;n++){const y=828+n*13,w=17+n*7,x=2050+Math.sin(n*17+time*.3)*n*4;line(c,[[x-w,y],[x+w,y]],'#ebc992'+(n<8?'35':'13'),2);}
  // Distant vessel and soft reflected light stay in the ocean frame.
  path(c,[[90,814],[275,814],[257,827],[114,827]]);c.fillStyle='#1e3541';c.fill();rect(c,195,795,42,19,'#243d48');line(c,[[208,795],[208,779]],'#243d48',3);
}
export function transformShip(c,s){const p=shipPose(s);c.translate(1280,800+p.y);c.scale(p.scale,p.scale);c.rotate(p.angle);c.translate(-1280,-800);}

// Static artwork is cached once. The shell, deck caps and water are drawn from
// current geometry separately, so none of this dressing seals a destroyed hull.
export function drawShipInterior(c){
  c.save();hullPath(c);c.clip();
  rect(c,220,680,2140,460,gradient(c,680,460,[[0,'#34434a'],[.35,'#26333b'],[1,'#101e2a']]));
  // Recessed watertight spaces, hull ribs, steel joints and service pipes.
  for(let i=0;i<5;i++) {
    const x=SHIP.edges[i];rect(c,x+22,724,380,360,'#0c1b2580');
    rect(c,x+32,737,358,332,gradient(c,737,330,[[0,'#30444b'],[1,'#192c37']]));
    for(let a=x+53;a<x+412;a+=63){rect(c,a,730,8,399,'#4a5b5b');rect(c,a+8,730,5,399,'#101e2b');}
    for(let y=784;y<1130;y+=86)line(c,[[x+18,y],[x+405,y]],'#0a1927',3);
    for(let a=x+42;a<x+412;a+=63)for(let y=778;y<1125;y+=86){circle(c,a,y,2,'#91a59b65');circle(c,a+12,y,1.4,'#071a29');}
    line(c,[[x+25,760],[x+394,760],[x+394,1080]],'#94795b',9);
    line(c,[[x+25,757],[x+394,757],[x+394,1080]],'#c2a075',3);
    lamp(c,x+212,710);
    for(let k=0;k<4;k++)circle(c,x+55+k*83,804,3,'#92aaa4');
  }
  // Twin marine engines, flywheels, heat shields and copper coolant manifolds.
  for(const x of [1110,1300]) {
    rect(c,x,971,160,133,gradient(c,970,135,[[0,'#467779'],[.45,'#284b54'],[1,'#122938']]));
    rect(c,x-8,1091,176,25,'#0e1d27');
    for(let k=0;k<4;k++){rect(c,x+8+k*37,947,27,104,'#456469');rect(c,x+11+k*37,950,8,96,'#70918a');rect(c,x+5+k*37,938,33,13,'#93a49a');}
    for(const xx of [x+37,x+125]){circle(c,xx,1072,24,'#0a202c');circle(c,xx,1072,18,'#627b7a');circle(c,xx,1072,10,'#1a3441');circle(c,xx,1072,4,'#b1bcb0');}
    line(c,[[x+22,958],[x+22,928],[x+130,928],[x+130,958]],'#c28c5f',9);
    rect(c,x+63,1057,30,20,'#132936');rect(c,x+68,1062,18,7,'#85d9c0');
  }
  // Rear pump room and forward storage racks.
  for(const x of [360,500]){circle(c,x,1010,45,'#122631');circle(c,x,1010,35,'#547575');circle(c,x,1010,25,'#213e4b');line(c,[[x,985],[x,1035]],'#9ca995',5);line(c,[[x-25,1010],[x+25,1010]],'#9ca995',5);line(c,[[x,970],[x,885],[x+45,885]],'#71958e',12);}
  for(let y=970;y<1120;y+=56){rect(c,1965,y,148,7,'#829496');for(let n=0;n<4;n++)rect(c,1970+n*34,y-32,28,31,n%2?'#6f796e':'#8e7c60');}
  for(const x of [725,870,1580,1730]) {
    rect(c,x,949,101,7,'#9ca59a');rect(c,x,956,7,173,'#556a6a');rect(c,x+94,956,7,173,'#556a6a');
    for(let y=982;y<1130;y+=48)rect(c,x+8,y,86,4,'#647774');
  }
  c.restore();
  // Streamlined ivory superstructure, recessed glazing and bridge brow.
  path(c,[[650,659],[650,480],[735,352],[1710,352],[1860,465],[1860,659]]);c.fillStyle=gradient(c,350,315,[[0,'#e6e4d3'],[.45,'#b3c4bf'],[1,'#6a8588']]);c.fill();
  path(c,[[724,354],[1707,354],[1789,412],[690,412]]);c.fillStyle='#f0e8d4';c.fill();
  rect(c,656,455,1196,19,'#1c3441');rect(c,662,474,1184,12,'#d3d6c5');
  rect(c,665,486,1180,18,gradient(c,486,18,[[0,'#1b3b456e'],[1,'#1b3b4500']]));
  for(let x=685;x<1840;x+=58){line(c,[[x,492],[x,653]],'#3b596218',1);for(const y of [495,645])circle(c,x,y,1.8,'#e5e3cc90');}
  // Bridge windows have deep blue glazing and warm instrument reflections.
  for(let n=0;n<10;n++) {
    const x=755+n*94;path(c,[[x,368],[x+78,368],[x+93,408],[x-7,408]]);c.fillStyle=gradient(c,365,46,[[0,'#173241'],[.65,'#3f6c75'],[1,'#76a4a2']]);c.fill();
    line(c,[[x+7,370],[x+17,401]],'#bfe0d34d',3);rect(c,x+18,401,34,3,'#ffd18c');
  }
  for(const x of [745,850,955,1460,1565,1670]) {
    rect(c,x-4,520,72,92,'#647f84');rect(c,x,524,64,83,gradient(c,520,88,[[0,'#102b3b'],[1,'#476b75']]));
    rect(c,x+5,529,4,69,'#9bb3ac');rect(c,x+2,565,61,4,'#80999a');
    lamp(c,x+30,625,'#ffce86',35);
  }
  for(const x of [681,1765]){rect(c,x,526,48,94,'#647f83');for(let y=531;y<615;y+=9){rect(c,x+5,y,37,3,'#203e4b');rect(c,x+5,y+3,37,1,'#b0c3b8');}}
  for(const x of [1043,1404]){circle(c,x,584,18,'#bf6748');circle(c,x,584,12,'#d8d6b9');circle(c,x,584,7,'#456772');}
  // Central stairwell/open passage; machinery room remains accessible below.
  rect(c,1122,464,304,215,'#182f3d');
  for(let y=484;y<670;y+=24){line(c,[[1160,y],[1375,y]],'#6d898e',5);line(c,[[1160,y],[1160,y+12]],'#2b454e',3);}
  line(c,[[1141,476],[1141,675]],'#b7c6bd',5);line(c,[[1390,476],[1390,675]],'#b7c6bd',5);
  // Split deck walkways and forward/rear lifeboats.
  for(const x of [354,1970]) {
    line(c,[[x+20,518],[x+20,414],[x+170,414],[x+188,481]],'#c2cec4',7);
    path(c,[[x,461],[x+207,461],[x+174,492],[x+30,492]]);c.fillStyle='#df633d';c.fill();
    path(c,[[x+33,461],[x+58,432],[x+151,432],[x+178,461]]);c.fillStyle='#edb17c';c.fill();
    rect(c,x+61,438,84,17,'#294551');line(c,[[x+8,470],[x+198,470]],'#ffd2a1',3);
  }
  // Funnel, mast, antenna and rigging: strong silhouette against the sky.
  path(c,[[1190,345],[1198,240],[1364,240],[1392,345]]);c.fillStyle=gradient(c,240,105,[[0,'#c75239'],[.7,'#b14334'],[1,'#76352d']]);c.fill();
  path(c,[[1198,240],[1364,240],[1371,267],[1196,267]]);c.fillStyle='#142a35';c.fill();
  for(let n=0;n<7;n++)rect(c,1212+n*21,281,9,46,'#562e29');
  line(c,[[983,350],[983,178],[1035,178]],'#cfdbce',7);line(c,[[951,228],[1049,228]],'#a9c0b8',5);
  line(c,[[986,207],[883,350]],'#617e87',2);line(c,[[986,208],[1110,350]],'#617e87',2);
  circle(c,1035,178,6,'#ccded0');rect(c,953,223,79,9,'#d6dfce');
  line(c,[[1568,350],[1568,268]],'#9bada6',6);path(c,[[1571,274],[1640,288],[1571,304]]);c.fillStyle='#b9573d';c.fill();
  rail(c,702,398,412);rail(c,1435,398,410);
  circle(c,698,443,6,'#ec8171');circle(c,1845,443,6,'#88e7be');
  lamp(c,698,443,'#ec8171',50);lamp(c,1845,443,'#88e7be',50);
}

export function drawShipPlatform(c,p) {
  if(p.hp===0)return;
  if(p.shipHull)return;
  c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
  if(p.shipHull) {
    rect(c,p.x,p.y,p.w,p.h,gradient(c,680,480,[[0,'#d1d7c7'],[.25,'#7d9a9b'],[.26,'#a64e40'],[.75,'#783934'],[1,'#281f28']]));
    for(let x=Math.floor(p.x/80)*80;x<p.x+p.w;x+=80){line(c,[[x,p.y],[x,p.y+p.h]],'#241e2a70',2);circle(c,x+9,p.y+8,2,'#d1ab8270');}
    line(c,[[p.x,p.y],[p.x+p.w,p.y]],'#e4d7b155',2);
  } else if(p.shipBulkhead) {
    rect(c,p.x,p.y,p.w,p.h,'#6a8383');rect(c,p.x+3,p.y,5,p.h,'#bed0ba');rect(c,p.x+p.w-6,p.y,6,p.h,'#203845');
    for(let y=812;y<p.y+p.h;y+=36)circle(c,p.x+p.w/2,y,2.4,'#bcd0bf');
  } else {
    rect(c,p.x,p.y,p.w,p.h,'#162d38');rect(c,p.x,p.y,p.w,5,'#d5d6bb');rect(c,p.x,p.y+5,p.w,5,'#6e8c8a');
    for(let x=Math.floor(p.x/23)*23;x<p.x+p.w;x+=23)rect(c,x,p.y+11,3,7,'#839493');
    if(p.oneWay)for(let x=p.x;x<p.x+p.w;x+=15)rect(c,x,p.y,5,4,'#233a46');
  }
  c.restore();
}
export function drawShipShell(c,platforms){
  c.save();c.beginPath();for(const p of platforms)if(p.shipHull&&p.hp!==0)c.rect(p.x,p.y,p.w,p.h);c.clip();
  path(c,[[213,680],[449,1148],[2129,1148],[2380,680],[2357,680],[2111,1128],[454,1128],[237,680]]);
  c.fillStyle=gradient(c,680,478,[[0,'#d7dec9'],[.27,'#799697'],[.28,'#b86046'],[.7,'#8a4439'],[1,'#403038']]);c.fill();
  line(c,[[230,686],[448,1134],[2125,1134],[2362,686]],'#edd5a66b',3);
  line(c,[[222,686],[446,1144],[2128,1144],[2371,686]],'#181e2a55',3);
  for(let x=440;x<2150;x+=48){circle(c,x,1140,2,'#dec29677');line(c,[[x,1131],[x,1154]],'#16283788',1);}
  for(let y=700;y<1130;y+=45)for(const side of [-1,1]){const x=side<0?223+(y-680)*.47:2372-(y-680)*.51;circle(c,x,y,2,'#e2b89388');}
  c.restore();
}
function waterPolygon(c,x0,x1,level,slope,bottom=1900,wave=0,time=0) {
  c.beginPath();for(let x=x0;x<=x1+1;x+=12){const xx=Math.min(x,x1),y=level+slope*(xx-1280)+wave*(Math.sin(xx*.024+time*1.8)+.4*Math.sin(xx*.051-time*2.4));if(x===x0)c.moveTo(xx,y);else c.lineTo(xx,y);}
  c.lineTo(x1,bottom);c.lineTo(x0,bottom);c.closePath();
}
export function drawShipWater(c,state,time,reduced,foreground=false,interiorOnly=false) {
  const s=state.ship;if(!s)return;
  const slope=-Math.tan(s.angle),levels=shipLevels(s),clock=reduced?0:time;
  // Ocean lies outside the real hull cross-section. Drawing the same plane
  // through the inverse ship transform keeps it level while the vessel lists.
  if(!interiorOnly){c.save();c.beginPath();c.rect(-3500,-3500,9500,9500);c.moveTo(230,680);c.lineTo(440,1130);c.lineTo(2120,1130);c.lineTo(2350,680);c.closePath();c.clip('evenodd');
  waterPolygon(c,-3400,5800,seaLevel(s,1280),slope,5000,reduced?0:4,clock);
  c.fillStyle=foreground?'#2b71852b':gradient(c,600,1800,[[0,'#538e9a'],[.3,'#143d52'],[1,'#071c30']]);c.fill();
  if(!foreground) {
    for(let n=0;n<35;n++){const x=(n*137+clock*31)%3500-430,y=seaLevel(s,x)+24+n%6*21;line(c,[[x,y],[x+49+n%4*22,y+slope*(49+n%4*22)]],n%4?'#6eb1b34a':'#d5e8d58c',2);}
    for(let n=0;n<42;n++){const x=(n*397+clock*12)%4500-1000,y=seaLevel(s,x)+140+n%7*85;line(c,[[x,y],[x+90+n%5*50,y+slope*(90+n%5*50)]],'#5280931c',1+n%2);}
  }
  c.restore();}
  for(let i=0;i<5;i++)if(s.volumes[i]>1) {
    const x0=SHIP.edges[i],x1=SHIP.edges[i+1];
    c.save();hullPath(c);c.clip();c.beginPath();c.rect(x0,680,x1-x0,450);c.clip();
    waterPolygon(c,x0,x1,levels[i],slope,1140,reduced?0:1.8,clock);
    c.fillStyle=foreground?'#57b7bf30':gradient(c,680,460,[[0,'#4caaa78c'],[.4,'#247b929e'],[1,'#102e49dd']]);c.fill();
    if(foreground) {
      const points=[];for(let x=x0;x<=x1;x+=8)points.push([x,levels[i]+slope*(x-1280)+(reduced?0:1.8*Math.sin(x*.024+clock*1.8))]);
      line(c,points,'#b5edda',2.5);line(c,points.map(([x,y])=>[x,y+5]),'#4da8b56b',5);
      if(!reduced)for(let k=0;k<14;k++) {
        const x=x0+20+(k*67)%383,y=1128-(clock*(13+k%5*4)+k*39)%420;
        if(y>levels[i]+slope*(x-1280)&&y<shipBottom(x)-5){c.strokeStyle='#b5e6dd55';c.lineWidth=1;c.beginPath();c.arc(x+Math.sin(clock+k)*3,y,1.5+k%3,0,Math.PI*2);c.stroke();}
      }
    }
    c.restore();
  }
  if(foreground) {
    for(const p of state.players)if(p.alive&&(p.submerged||p.oxygen<11.98)) {
      const x=p.x,y=Math.min(p.y-68,(p.rig?.[0]?.y??p.y-40)-22),ratio=p.oxygen/12;
      rect(c,x-28,y-2,56,10,'#071724ee');rect(c,x-26,y,52,6,'#214455');rect(c,x-26,y,52*ratio,6,ratio<.25?'#ff9b69':'#99e5eb');
      c.fillStyle='#d6f8ef';c.font='600 11px "DM Sans",sans-serif';c.textAlign='center';c.fillText('O₂',x,y-6);
    }
    // Ingress jets originate only at actual open underwater shell rays.
    for(const b of shipOpenings(state).filter(b=>b.j<0)) {
      const head=b.y-seaLevel(s,b.x);if(head<=0||compartmentLevelAt(s,levels,b.i,b.x)<seaLevel(s,b.x)+3)continue;
      const dir=b.x<1280?1:-1,reach=Math.min(95,20+Math.sqrt(head)*4);
      line(c,[[b.x,b.y],[b.x+dir*reach*.6,b.y-24],[b.x+dir*reach,b.y-9]],'#b1e9e28c',6);
      if(!reduced)for(let k=0;k<3;k++){const t=(time*2+k/3)%1;circle(c,b.x+dir*reach*t,b.y-60*t+51*t*t,2.5,'#d5f5e9b0');}
    }
  }
}
function compartmentLevelAt(s,levels,i,x){return levels[i]-Math.tan(s.angle)*(x-1280);}

export function drawShipDetails(c,state,time,reduced){
  // Railings stop at surviving deck edges and never bridge explosion holes.
  for(const p of state.platforms)if(p.shipDeck&&p.hp!==0&&p.y===680&&p.w>15)rail(c,p.x,p.y-44,p.w);
  if(!reduced)for(let n=0;n<7;n++) {
    const t=(time*.13+n/7)%1;c.globalAlpha=(1-t)*.09;
    c.fillStyle='#c2cac1';c.beginPath();c.ellipse(1280+t*240,238-t*210,18+t*61,12+t*39,-.5,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
}
