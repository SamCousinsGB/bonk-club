import {ROCKET,rocketNozzle,rocketPhase,rocketPlume} from './rocket.js';
const TAU=Math.PI*2;
const line=(c,points,color,width=3)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const ellipse=(c,x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();};
const poly=(c,points,color)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();};
let backdrop,engine,plumes;
function canvas(w,h){const a=document.createElement('canvas');a.width=w;a.height=h;return a;}
function truss(c,x,y,w,h){
  c.fillStyle='#263e48';c.fillRect(x,y,18,h);c.fillRect(x+w-18,y,18,h);
  for(let v=y;v<y+h-20;v+=110){
    line(c,[[x+10,v],[x+w-10,Math.min(v+110,y+h)],[x+10,Math.min(v+110,y+h)]],'#3d5055',9);
    ellipse(c,x+9,v+4,4,4,'#6c7776');ellipse(c,x+w-9,v+4,4,4,'#6c7776');
  }
}
function createBackdrop(){
  const a=canvas(2560,1440),c=a.getContext('2d');
  const sky=c.createLinearGradient(0,0,0,1300);sky.addColorStop(0,'#081b31');sky.addColorStop(.45,'#3c5867');sky.addColorStop(.72,'#9a8b7c');sky.addColorStop(1,'#293d46');c.fillStyle=sky;c.fillRect(0,0,2560,1440);
  ellipse(c,2110,270,66,66,'#ccd1bd');ellipse(c,2084,246,62,62,'#2c465b');
  for(let layer=0;layer<3;layer++){
    const points=[[0,1440]];for(let x=0;x<=2640;x+=80)points.push([x,730+layer*155+Math.sin(x*.004+layer*2)*75+Math.sin(x*.011+layer)*38]);
    points.push([2560,1440]);poly(c,points,['#536775','#3c535e','#293f49'][layer]);
  }
  // Distant launch towers and vehicle halls are muted; playable ledges receive
  // the bright top faces. No background rail masquerades as a route.
  for(const [x,y,w,h] of [[60,830,360,460],[2140,750,350,560]]){
    const tank=c.createLinearGradient(x,0,x+w,0);tank.addColorStop(0,'#344853');tank.addColorStop(.4,'#718083');tank.addColorStop(1,'#334752');
    c.fillStyle=tank;c.fillRect(x,y,w,h);ellipse(c,x+w/2,y,w/2,65,'#758487');
    for(let k=1;k<5;k++)line(c,[[x,y+k*90],[x+w,y+k*90]],'#475a62',4);
    line(c,[[x+w/2,y-50],[x+w/2,y-110]],'#94a4a4',10);
  }
  truss(c,690,90,130,1230);truss(c,1740,90,130,1230);
  line(c,[[690,100],[1870,100]],'#233c48',56);
  for(let x=730;x<1830;x+=100)line(c,[[x,84],[x+90,124],[x+90,84]],'#5a6867',6);
  // Main cryogenic feed, flexible elbow and oxidiser manifolds.
  for(const [side,color] of [[-1,'#7b969d'],[1,'#b3865d']]){
    const x=1280+side*440;
    line(c,[[x,1320],[x,240],[1280+side*230,240],[1280+side*150,320]],'#162c38',45);
    line(c,[[x,1320],[x,240],[1280+side*230,240],[1280+side*150,320]],color,28);
    for(let y=280;y<1280;y+=140){c.fillStyle='#203b48';c.fillRect(x-24,y,48,12);}
    ellipse(c,x,285,37,37,'#293e47');ellipse(c,x,285,26,26,'#ad8552');
    line(c,[[x-22,285],[x+22,285]],'#243b46',5);line(c,[[x,263],[x,307]],'#243b46',5);
  }
  // The anchored pressure vessel above the gimbal.
  const vessel=c.createLinearGradient(1110,0,1450,0);vessel.addColorStop(0,'#274552');vessel.addColorStop(.35,'#a3b6b3');vessel.addColorStop(.65,'#627d87');vessel.addColorStop(1,'#1b3442');
  c.fillStyle=vessel;c.fillRect(1135,-40,290,390);ellipse(c,1280,340,145,55,'#64838a');
  for(const y of [30,145,285]){c.fillStyle='#273f4a';c.fillRect(1128,y,304,14);line(c,[[1132,y],[1428,y]],'#b2b9a8',3);}
  for(let x=1160;x<1420;x+=34)line(c,[[x,20],[x,285]],'#abc0b333',3);
  line(c,[[995,105],[1110,400],[1450,400],[1565,105]],'#253e4a',26);
  line(c,[[995,105],[1110,400],[1450,400],[1565,105]],'#81968f',5);
  // Recessed flame trench, tiles and restrained hazard chevrons.
  c.fillStyle='#102531';c.fillRect(950,1180,660,260);
  for(let x=960;x<1610;x+=70)for(let y=1190;y<1440;y+=55){c.fillStyle=(x+y)%3?'#223743':'#29414b';c.fillRect(x,y,65,49);}
  const haze=c.createLinearGradient(0,950,0,1440);haze.addColorStop(0,'#76909600');haze.addColorStop(1,'#102631bb');c.fillStyle=haze;c.fillRect(0,950,2560,490);
  return a;
}
function createEngine(){
  const a=canvas(640,520),c=a.getContext('2d');c.translate(320,160);
  const shell=c.createLinearGradient(-150,0,150,0);shell.addColorStop(0,'#1a303b');shell.addColorStop(.25,'#839a9b');shell.addColorStop(.48,'#d4d0b7');shell.addColorStop(.65,'#6b848b');shell.addColorStop(1,'#1a303d');
  // Turbopump, flange, copper regenerative cooling tubes and bell nozzle.
  ellipse(c,0,-55,96,66,'#253a44');ellipse(c,-75,-64,51,51,'#657e83');ellipse(c,-75,-64,32,32,'#233a46');
  for(let i=0;i<12;i++){const a=i*TAU/12;line(c,[[-75+Math.cos(a)*16,-64+Math.sin(a)*16],[-75+Math.cos(a+.35)*28,-64+Math.sin(a+.35)*28]],'#92a7a6',4);}
  line(c,[[-119,-28],[-154,15],[-137,130],[-84,171]],'#1a303b',24);
  line(c,[[-119,-28],[-154,15],[-137,130],[-84,171]],'#ad8b60',14);
  line(c,[[80,-85],[138,-66],[145,54],[65,84]],'#7b9da3',18);
  c.fillStyle=shell;c.fillRect(-50,-80,100,120);
  c.beginPath();c.moveTo(-47,25);c.bezierCurveTo(-40,80,-57,137,-92,230);c.lineTo(92,230);c.bezierCurveTo(57,137,40,80,47,25);c.closePath();c.fillStyle=shell;c.fill();
  for(let i=-8;i<=8;i++){
    const u=i/8;c.beginPath();c.moveTo(u*43,32);c.bezierCurveTo(u*38,95,u*59,153,u*85,224);c.strokeStyle=i%2?'#b59a6c':'#263d49';c.lineWidth=3;c.stroke();
  }
  for(const y of [12,35,205,226]){ellipse(c,0,y,y>100?90:58,12,'#253e4a');ellipse(c,0,y-3,y>100?90:58,8,'#89998f');}
  ellipse(c,0,231,88,17,'#111d29');ellipse(c,0,231,66,10,'#4c3840');
  for(const side of [-1,1]){ellipse(c,side*102,0,30,30,'#162c38');ellipse(c,side*102,0,20,20,'#a7b4a5');ellipse(c,side*102,0,9,9,'#314955');}
  return a;
}
function createPlumes(){
  // Cache turbulent luminosity, with transparent edges and soft shock cells.
  // Four blended frames avoid per-frame pixel work or a hard geometric beam.
  const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  const noise=(x,y)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return (hash(a,b)*(1-s)+hash(a+1,b)*s)*(1-t)+(hash(a,b+1)*(1-s)+hash(a+1,b+1)*s)*t;};
  return Array.from({length:4},(_,frame)=>{
    const a=canvas(256,768),c=a.getContext('2d'),data=c.createImageData(256,768);
    for(let y=0;y<768;y++)for(let x=0;x<256;x++){
      const wy=y/768*1050,wx=(x/256-.5)*410;
      const rough=noise(x*.055+frame*2,y*.027-frame*3)*.6+noise(x*.14-frame,y*.095+frame*5)*.4;
      const radius=74+wy*.102,edge=Math.exp(-Math.pow(Math.abs(wx)/(radius*(.78+rough*.22)),4)*3.5);
      const cells=Math.sin(wy/105*Math.PI)**2,core=Math.exp(-((wx/(24+cells*32))**2))*(.28+cells*.3);
      const value=Math.min(1,.44+rough*.4+core),warm=Math.max(0,(wy-260)/790);
      const i=(y*256+x)*4;
      data.data[i]=Math.min(255,120+value*50+warm*115);data.data[i+1]=150+value*55-warm*75;
      data.data[i+2]=255-warm*210;
      data.data[i+3]=Math.min(255,(.45+rough*.3+core)*edge*245);
    }
    c.putImageData(data,0,0);return a;
  });
}
export function drawRocketBackground(c,state,reduced){
  backdrop ||= createBackdrop();engine ||= createEngine();plumes ||= createPlumes();c.drawImage(backdrop,0,0);
  const h=state.hazards.find(h=>h.type==='rocket');if(!h)return;
  const n=rocketNozzle(h),t=reduced?0:h.age;
  // Hydraulic actuators stay attached to the rotating thrust frame.
  for(const side of [-1,1]){
    const ex=1280+Math.cos(n.angle)*side*100+Math.sin(n.angle)*40,ey=ROCKET.pivotY-Math.sin(n.angle)*side*100+Math.cos(n.angle)*40;
    line(c,[[1280+side*236,300],[ex,ey]],'#233c48',23);
    line(c,[[1280+side*236,300],[ex,ey]],'#9eaead',10);
  }
  c.save();c.translate(1280,ROCKET.pivotY);c.rotate(-n.angle);c.drawImage(engine,-320,-160);c.restore();
  const pulse=reduced?1:.6+.4*Math.sin(t*8)**2;
  for(const x of [820,1740]){
    const color=h.active?'#f6a376':h.warning>0?'#ffd35c':'#64b4bb';
    ellipse(c,x,365,14,14,color);ellipse(c,x,365,32,32,h.warning>0?`rgba(255,186,76,${pulse*.13})`:'#75d9ef0b');
    // Three physical warning lamps count down the actual remaining seconds.
    for(let i=0;i<3;i++){c.fillStyle=h.warning>i?'#ffd572':'#283e4c';c.fillRect(x-32+i*24,401,16,8);}
  }
  if(h.warning>0||n.purge>0){
    const intensity=h.warning>0?.6:n.purge;
    for(const side of [-1,1])for(let i=0;i<9;i++){
      const u=((t*.45+i/9)%1),x=1280+side*(170+u*210),y=400+u*90+Math.sin(i*2.3)*25;
      ellipse(c,x,y,18+u*60,10+u*24,`rgba(185,213,214,${(1-u)*.14*intensity})`);
    }
  }
}
export function drawRocketPlatform(c,p){
  c.fillStyle=p.oneWay?'#304b59':'#263e4b';c.fillRect(p.x,p.y,p.w,p.h);
  c.fillStyle='#98a6a1';c.fillRect(p.x,p.y,p.w,Math.min(3,p.h));
  if(p.oneWay){for(let x=Math.ceil(p.x/15)*15;x<p.x+p.w-4;x+=15){c.fillStyle='#0d2330';c.fillRect(x,p.y+5,7,Math.max(1,p.h-7));}}
  else{
    c.fillStyle='#132c39';c.fillRect(p.x,p.y+p.h-5,p.w,Math.min(5,p.h));
    for(let x=Math.ceil(p.x/75)*75+6;x<p.x+p.w-6;x+=75){ellipse(c,x,p.y+Math.min(14,p.h/2),3,3,'#879791');}
  }
}
export function drawRocketExhaust(c,state,reduced){
  const h=state.hazards.find(h=>h.type==='rocket');if(!h||!h.active||state.phase!=='fight')return;
  const {nozzle:n,rays}=rocketPlume(h,state.platforms),t=reduced?0:h.age;
  const end=rays[8];
  c.save();c.globalCompositeOperation='screen';
  const glow=c.createRadialGradient(n.x,n.y+320,10,n.x,n.y+320,650);glow.addColorStop(0,'#5c85bf24');glow.addColorStop(.6,'#e8923810');glow.addColorStop(1,'#00000000');c.fillStyle=glow;c.fillRect(n.x-650,n.y-330,1300,1300);
  c.restore();
  c.save();
  c.beginPath();c.moveTo(rays[0].x,rays[0].y);c.lineTo(rays.at(-1).x,rays.at(-1).y);
  for(let i=rays.length-1;i>=0;i--)c.lineTo(rays[i].ex,rays[i].ey);c.closePath();c.clip();
  c.translate(n.x,n.y);c.rotate(-n.angle);
  const frame=t*14,index=Math.floor(frame)%4,blend=frame-Math.floor(frame);
  c.globalCompositeOperation='screen';c.globalAlpha=1-blend;c.drawImage(plumes[index],-205,0,410,1050);
  c.globalAlpha=blend;c.drawImage(plumes[(index+1)%4],-205,0,410,1050);c.globalAlpha=1;
  const core=c.createLinearGradient(0,0,0,950);core.addColorStop(0,'#e6f4ffa0');core.addColorStop(.2,'#9bbfff44');core.addColorStop(1,'#d89e6300');
  c.fillStyle=core;c.beginPath();c.moveTo(-52,0);c.quadraticCurveTo(-26,290,-76,950);c.lineTo(76,950);c.quadraticCurveTo(26,290,52,0);c.fill();
  c.restore();
  c.save();c.globalCompositeOperation='screen';
  // Impingement light and outward dust exist only at real ray contacts.
  for(let i=0;i<rays.length;i+=4){const r=rays[i];if(r.t>=1)continue;
    ellipse(c,r.ex,r.ey-3,45,10,'#ffe1a74d');
    if(!reduced)for(let j=0;j<3;j++){const u=(t*1.8+j*.31+i*.13)%1,side=j%2?-1:1;ellipse(c,r.ex+side*u*95,r.ey-8-u*35,8+u*20,5+u*8,`rgba(239,186,126,${(1-u)*.13})`);}
  }
  ellipse(c,n.x,n.y,90,18,'#f4fbffb0');c.restore();
}
export function rocketShake(state){const h=state?.phase==='fight'&&state.hazards?.find(h=>h.type==='rocket'&&h.active);return h?1.4+Math.max(0,1-rocketPhase(h.age).fire*12)*4:0;}
