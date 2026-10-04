import { SHIP, shipBottom, shipPose, seaLevel, shipLevels, shipOpenings } from './ship.js';

const path=(c,points)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();};
const line=(c,points,color,width=2)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
const gradient=(c,y,h,stops)=>{const g=c.createLinearGradient(0,y,0,y+h);stops.forEach(([at,color])=>g.addColorStop(at,color));return g;};
function hullPath(c){path(c,[[230,680],[2350,680],[2120,SHIP.bottom],[440,SHIP.bottom]]);}
function lamp(c,x,y,color='#ffcf88',r=65){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color+'52');g.addColorStop(1,color+'00');circle(c,x,y,r,g);rect(c,x-15,y-3,30,6,color);}
function rail(c,x,y,w){line(c,[[x,y],[x+w,y]],'#789393',2);for(let a=x;a<=x+w;a+=100)line(c,[[a,y],[a,y+44]],'#658181',2);}
function backgroundCrate(c,x,bottom,w,h){
  const y=bottom-h;
  rect(c,x,y,w,h,gradient(c,y,h,[[0,'#4c5047'],[1,'#35413f']]));
  for(let n=1;n<4;n++)line(c,[[x+w*n/4,y+5],[x+w*n/4,bottom-5]],'#34423e',2);
  line(c,[[x+3,y+3],[x+w-3,y+3],[x+w-3,bottom-3],[x+3,bottom-3],[x+3,y+3]],'#606253',5);
  line(c,[[x+6,bottom-6],[x+w-6,y+6]],'#686653',5);
}

export function drawShipSky(c,time,reduced){
  rect(c,0,0,2560,1440,gradient(c,0,1000,[[0,'#091927'],[.48,'#284857'],[.7,'#b18e7e'],[1,'#183645']]));
  const glow=c.createRadialGradient(2040,450,10,2040,450,600);glow.addColorStop(0,'#ffdaa660');glow.addColorStop(1,'#e6ab7800');rect(c,1100,0,1460,1000,glow);
  circle(c,2050,460,62,'#f4cf9b');
  for(let n=0;n<8;n++) {
    const x=((n*331+(reduced?0:time*(2+n%3)))%3100)-260,y=110+(n*113)%390;
    const w=230+n%4*80,h=12+n%3*10;
    c.fillStyle=gradient(c,y-h,h*2,[[0,'#69818b00'],[.4,n%3===0?'#102b3a60':'#81909632'],[1,'#122a3a00']]);
    c.beginPath();c.moveTo(x-w,y);c.bezierCurveTo(x-w*.6,y-h,x-w*.35,y-h*.2,x-w*.15,y-h);
    c.bezierCurveTo(x+w*.2,y-h*2,x+w*.45,y-h*.4,x+w,y-h*.2);
    c.bezierCurveTo(x+w*.4,y+h,x-w*.6,y+h,x-w,y);c.fill();
  }
  path(c,[[0,795],[260,767],[520,786],[680,751],[885,786],[1100,777],[1500,801],[2560,807],[2560,860],[0,860]]);c.fillStyle='#183544';c.fill();
  rect(c,0,812,2560,628,gradient(c,812,628,[[0,'#4b7279'],[.11,'#234c5d'],[.6,'#102d40'],[1,'#081b2c']]));
  for(let n=0;n<35;n++) {
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
  rect(c,220,680,2140,SHIP.bottom-680,gradient(c,680,SHIP.bottom-680,[[0,'#293f4a'],[1,'#152733']]));
  // Broad quiet panels distinguish rooms without imitating climbable scenery.
  for(let i=0;i<5;i++) {
    const x=SHIP.edges[i];
    rect(c,x+26,724,372,SHIP.bottom-744,gradient(c,724,SHIP.bottom-724,[[0,'#263c47'],[1,'#192c39']]));
    line(c,[[x+30,748],[x+394,748]],'#38505a',2);
    lamp(c,x+212,710,'#c6c4a3',28);
  }
  // Sparse, subdued storage painted on the back wall, behind physical cargo,
  // fighters and floodwater. Keep the open upper hold and exit ledges clear.
  for(const [x,offset,w,h] of [
    [555,0,78,72],
    [1145,0,120,80],[1271,0,100,66],[1185,80,90,62],
    [1740,0,128,88],[1784,88,76,62],
    [1975,0,108,90],
  ])backgroundCrate(c,x,SHIP.bottom-offset,w,h);
  c.restore();
  // Muted superstructure sits behind the bright, physical deck edges.
  // Overlap the hull top slightly so the shared edge stays sealed when tilted.
  const cabinBottom=SHIP.top+1;
  path(c,[[650,cabinBottom],[650,480],[735,352],[1710,352],[1860,465],[1860,cabinBottom]]);
  c.fillStyle=gradient(c,350,315,[[0,'#91a6a6'],[1,'#506b78']]);c.fill();
  path(c,[[724,354],[1707,354],[1789,412],[690,412]]);c.fillStyle='#b3bfb6';c.fill();
  for(let n=0;n<6;n++) {
    const x=755+n*156;
    path(c,[[x,370],[x+126,370],[x+139,406],[x-7,406]]);c.fillStyle='#294854';c.fill();
  }
  for(const x of [760,955,1500,1695])circle(c,x,553,24,'#365360');
  // A plain recessed passage has no decorative stair treads to read as ledges.
  rect(c,1122,464,304,cabinBottom-464,'#203845');
  // Funnel, mast, antenna and rigging: strong silhouette against the sky.
  path(c,[[1190,345],[1198,240],[1364,240],[1392,345]]);c.fillStyle=gradient(c,240,105,[[0,'#c75239'],[.7,'#b14334'],[1,'#76352d']]);c.fill();
  path(c,[[1198,240],[1364,240],[1371,267],[1196,267]]);c.fillStyle='#142a35';c.fill();
  line(c,[[983,350],[983,178],[1035,178]],'#cfdbce',7);line(c,[[951,228],[1049,228]],'#a9c0b8',5);
  circle(c,1035,178,6,'#ccded0');rect(c,953,223,79,9,'#d6dfce');
  line(c,[[1568,350],[1568,268]],'#9bada6',6);path(c,[[1571,274],[1640,288],[1571,304]]);c.fillStyle='#b9573d';c.fill();
  rail(c,702,398,412);rail(c,1435,398,410);
  circle(c,698,443,6,'#ec8171');circle(c,1845,443,6,'#88e7be');
  lamp(c,698,443,'#ec8171',50);lamp(c,1845,443,'#88e7be',50);
}

export function drawShipLifeboats(c,platforms) {
  // Background fittings share the ship frame and depend on surviving deck
  // mounts. Keep them out of the static cache so broken mounts cannot hover.
  const mounted=x=>platforms.some(p=>p.shipDeck&&p.hp!==0&&p.y===680&&p.x<=x-8&&p.x+p.w>=x+8);
  for(const x of [354,1970]) {
    const feet=[x+56,x+186],intact=feet.map(mounted);
    for(let i=0;i<2;i++)if(intact[i]) {
      const foot=feet[i],hook=x+(i?163:43);
      // Footplates, gusseted columns and the walkway's diagonal bracing.
      line(c,[[foot,676],[foot,418],[hook,396],[hook,414]],'#233e4b',14);
      line(c,[[foot-2,675],[foot-2,419],[hook,400],[hook,414]],'#799391',5);
      path(c,[[foot-15,675],[foot,643],[foot+15,675]]);c.fillStyle='#799693';c.fill();
      rect(c,foot-20,674,40,6,'#ced6c5');
      for(const dx of [-14,14])circle(c,foot+dx,677,2,'#28424b');
      circle(c,foot,544,10,'#294651');circle(c,foot,544,6,'#b0bdb0');
      circle(c,hook,409,6,'#e2dec7');circle(c,hook,409,2.5,'#2b4551');
      if(intact.every(Boolean))line(c,[[hook-2,414],[hook-2,466],[hook+2,466],[hook+2,414]],'#cbd4c2',1.8);
    }
    if(!intact.every(Boolean))continue;
    path(c,[[x,461],[x+207,461],[x+174,492],[x+30,492]]);c.fillStyle=gradient(c,460,34,[[0,'#ee8552'],[1,'#ac412c']]);c.fill();
    path(c,[[x+33,461],[x+58,432],[x+151,432],[x+178,461]]);c.fillStyle='#edb17c';c.fill();
    rect(c,x+61,438,84,17,'#294551');line(c,[[x+8,470],[x+198,470]],'#ffd2a1',3);
    for(const dx of [43,163]){rect(c,x+dx-3,459,6,26,'#e0d5b9');circle(c,x+dx,459,3,'#f7dec0');}
  }
}

export function drawShipPlatform(c,p) {
  if(p.hp===0)return;
  if(p.shipHull)return;
  c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
  if(p.shipBulkhead) {
    rect(c,p.x,p.y,p.w,p.h,'#55747c');rect(c,p.x+3,p.y,4,p.h,'#99b0ad');rect(c,p.x+p.w-6,p.y,6,p.h,'#203845');
  } else {
    rect(c,p.x,p.y,p.w,p.h,'#162d38');rect(c,p.x,p.y,p.w,5,'#d5d6bb');rect(c,p.x,p.y+5,p.w,5,'#6e8c8a');
    if(p.oneWay)for(let x=p.x;x<p.x+p.w;x+=15)rect(c,x,p.y,5,4,'#233a46');
  }
  c.restore();
}
export function drawShipShell(c,platforms){
  c.save();c.beginPath();for(const p of platforms)if(p.shipHull&&p.hp!==0)c.rect(p.x,p.y,p.w,p.h);c.clip();
  const bottom=SHIP.bottom;
  path(c,[[213,680],[449,bottom+18],[2129,bottom+18],[2380,680],[2357,680],[2111,bottom-2],[454,bottom-2],[237,680]]);
  c.fillStyle=gradient(c,680,bottom-662,[[0,'#a7bbb4'],[.27,'#6d898b'],[.28,'#a85d49'],[1,'#573c3b']]);c.fill();
  line(c,[[230,686],[448,bottom+4],[2125,bottom+4],[2362,686]],'#c6be9c',3);
  c.restore();
}
function waterPolygon(c,x0,x1,level,slope,bottom=1900,wave=0,time=0) {
  c.beginPath();for(let x=x0;x<=x1+1;x+=12){const xx=Math.min(x,x1),y=level+slope*(xx-1280)+wave*(Math.sin(xx*.024+time*1.8)+.4*Math.sin(xx*.051-time*2.4));if(x===x0)c.moveTo(xx,y);else c.lineTo(xx,y);}
  c.lineTo(x1,bottom);c.lineTo(x0,bottom);c.closePath();
}
export function drawShipWater(c,state,time,reduced,foreground=false,interiorOnly=false) {
  const s=state.ship;if(!s)return;
  const slope=-Math.tan(s.angle),levels=shipLevels(s),clock=reduced?0:time;
  // Ocean lies outside the real hull cross-section. seaLevel converts its
  // fixed screen-space plane into the descending, listing ship frame.
  if(!interiorOnly){c.save();c.beginPath();c.rect(-3500,-3500,9500,9500);c.moveTo(230,680);c.lineTo(440,SHIP.bottom);c.lineTo(2120,SHIP.bottom);c.lineTo(2350,680);c.closePath();c.clip('evenodd');
  waterPolygon(c,-3400,5800,seaLevel(s,1280),slope,5000,reduced?0:4,clock);
  c.fillStyle=foreground?'#2b71852b':gradient(c,600,1800,[[0,'#538e9a'],[.3,'#143d52'],[1,'#071c30']]);c.fill();
  if(!foreground) {
    for(let n=0;n<35;n++){const x=(n*137+clock*31)%3500-430,y=seaLevel(s,x)+24+n%6*21;line(c,[[x,y],[x+49+n%4*22,y+slope*(49+n%4*22)]],n%4?'#6eb1b34a':'#d5e8d58c',2);}
    for(let n=0;n<42;n++){const x=(n*397+clock*12)%4500-1000,y=seaLevel(s,x)+140+n%7*85;line(c,[[x,y],[x+90+n%5*50,y+slope*(90+n%5*50)]],'#5280931c',1+n%2);}
  }
  c.restore();}
  for(let i=0;i<5;i++)if(s.volumes[i]>1) {
    const x0=SHIP.edges[i],x1=SHIP.edges[i+1];
    c.save();hullPath(c);c.clip();c.beginPath();c.rect(x0,680,x1-x0,SHIP.bottom-680);c.clip();
    waterPolygon(c,x0,x1,levels[i],slope,SHIP.bottom+10,reduced?0:1.8,clock);
    c.fillStyle=foreground?'#57b7bf30':gradient(c,680,SHIP.bottom-680,[[0,'#4caaa78c'],[.4,'#247b929e'],[1,'#102e49dd']]);c.fill();
    if(foreground) {
      const points=[];for(let x=x0;x<=x1;x+=8)points.push([x,levels[i]+slope*(x-1280)+(reduced?0:1.8*Math.sin(x*.024+clock*1.8))]);
      line(c,points,'#b5edda',2.5);line(c,points.map(([x,y])=>[x,y+5]),'#4da8b56b',5);
      if(!reduced)for(let k=0;k<5;k++) {
        const x=x0+20+(k*67)%383,y=SHIP.bottom-2-(clock*(13+k%5*4)+k*39)%(SHIP.bottom-710);
        if(y>levels[i]+slope*(x-1280)&&y<shipBottom(x)-5){c.strokeStyle='#b5e6dd55';c.lineWidth=1;c.beginPath();c.arc(x+Math.sin(clock+k)*3,y,1.5+k%3,0,Math.PI*2);c.stroke();}
      }
    }
    c.restore();
  }
  if(foreground) {
    // Ingress jets originate only at actual open underwater shell rays.
    for(const b of shipOpenings(state).filter(b=>b.j<0)) {
      const head=b.y-seaLevel(s,b.x);if(head<=0||compartmentLevelAt(s,levels,b.i,b.x)<seaLevel(s,b.x)+3)continue;
      const dir=b.x<1280?1:-1,reach=Math.min(95,20+Math.sqrt(head)*4);
      line(c,[[b.x,b.y],[b.x+dir*reach*.6,b.y-24],[b.x+dir*reach,b.y-9]],'#b1e9e28c',6);
      if(!reduced)for(let k=0;k<3;k++){const t=(time*2+k/3)%1;circle(c,b.x+dir*reach*t,b.y-60*t+51*t*t,2.5,'#d5f5e9b0');}
    }
  }
}
export function drawOxygen(c,state){
  c.save();
  for(const p of state.players)if(p.alive&&(p.submerged||p.oxygen<11.98)) {
    const x=p.x,y=Math.min(p.y-108,(p.rig?.[0]?.y??p.y-40)-70),ratio=p.oxygen/12;
    rect(c,x-28,y-2,56,10,'#071724ee');rect(c,x-26,y,52,6,'#214455');rect(c,x-26,y,52*ratio,6,ratio<.25?'#ff9b69':'#99e5eb');
    c.fillStyle='#d6f8ef';c.font='600 11px "DM Sans",sans-serif';c.textAlign='center';c.fillText('O₂',x,y-6);
  }
  c.restore();
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
