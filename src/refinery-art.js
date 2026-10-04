import {REFINERY_TANKS as TANKS,REFINERY_PIPES as PIPES} from './refinery-arena.js';
import {refineryLiquids} from './refinery.js';
import {SPILLS} from './barrels.js';
const TAU=Math.PI*2,COLORS=['#b99b68','#e6ba58','#77cfce','#b8d566'];
const line=(c,pts,color,w=2)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=w;c.stroke();};
const oval=(c,x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();};
const label=(c,text,x,y,color='#c1d1c4',size=19)=>{c.fillStyle=color;c.font=`600 ${size}px "Barlow Condensed",sans-serif`;c.textAlign='center';c.fillText(text,x,y);};
const gradient=(c,x,w,a,b,d)=>{const g=c.createLinearGradient(x,0,x+w,0);g.addColorStop(0,a);g.addColorStop(.34,b);g.addColorStop(1,d);return g;};
let backdrop;
function createBackdrop(){
  const a=document.createElement('canvas');a.width=2560;a.height=1440;const c=a.getContext('2d');
  const sky=c.createLinearGradient(0,0,0,1440);sky.addColorStop(0,'#102b37');sky.addColorStop(.42,'#426260');sky.addColorStop(.68,'#ba9470');sky.addColorStop(1,'#132f37');c.fillStyle=sky;c.fillRect(0,0,2560,1440);
  oval(c,2010,380,120,120,'#edc59155');
  // Distant process trains, chimneys and spherical gas holders establish scale.
  for(let i=0;i<16;i++){
    const x=i*181-40,y=650+Math.sin(i*2.8)*130,w=55+i%3*17;
    c.fillStyle='#344e51';c.fillRect(x,y,w,700);oval(c,x+w/2,y,w/2,25,'#526763');
    for(let v=y+40;v<1300;v+=95){c.fillStyle='#263f4699';c.fillRect(x-7,v,w+14,9);}
    if(i%3===0){line(c,[[x+9,y],[x+9,y-260]],'#3c5859',19);oval(c,x+9,y-263,5,9,'#dfab73');}
  }
  for(const x of [220,2200]){oval(c,x,960,225,170,'#41595a');line(c,[[x-150,1030],[x-175,1340]],'#243f47',20);line(c,[[x+150,1030],[x+175,1340]],'#243f47',20);line(c,[[x-220,960],[x+220,960]],'#6d7c6d66',7);}
  for(const x of [560,1930]){
    c.fillStyle='#29464e';c.fillRect(x,170,22,1150);c.fillRect(x+58,170,18,1150);
    for(let y=170;y<1280;y+=100){line(c,[[x+10,y],[x+65,y+100],[x+10,y+100]],'#466063',5);}
  }
  // Rear fractionation column: trays and a glazed longitudinal inspection cut.
  // Foreground tanks and pipe shells below are drawn from surviving collision.
  c.fillStyle=gradient(c,1120,320,'#263f48','#82948b','#233f48');c.fillRect(1120,175,320,825);
  oval(c,1280,175,160,85,'#809288');oval(c,1280,175,139,67,'#617d78');
  c.fillStyle='#123237';c.fillRect(1190,200,180,790);
  for(let y=260;y<960;y+=116){line(c,[[1120,y],[1440,y]],'#1d3942',16);line(c,[[1120,y-7],[1440,y-7]],'#a3aa8a',3);}
  for(const x of [1150,1402]){
    line(c,[[x,210],[x,1030]],'#314f52',6);line(c,[[x+20,210],[x+20,1030]],'#314f52',6);
    for(let y=215;y<1000;y+=25)line(c,[[x,y],[x+20,y]],'#758a7a',3);
  }
  line(c,[[1270,92],[1270,35],[1440,35],[1440,140]],'#537675',19);
  for(const y of [240,585,935]){
    c.fillStyle='#233e44';c.fillRect(1070,y,425,12);line(c,[[1070,y],[1070,y-37],[1495,y-37],[1495,y]],'#7a8e7b55',5);
  }
  label(c,'FRACTIONATION',1280,155,'#d4d3ad',23);
  const haze=c.createLinearGradient(0,900,0,1440);haze.addColorStop(0,'#16343d00');haze.addColorStop(1,'#112d3bba');c.fillStyle=haze;c.fillRect(0,900,2560,540);
  return a;
}
export function drawRefineryBackground(c,state,reduced){
  backdrop||=createBackdrop();c.drawImage(backdrop,0,0);
  const r=state.refinery;if(!r)return;const time=reduced?0:r.clock,heat=r.heat;
  // Amber lower trays, cooler upper fractions, with motion powered by actual
  // throughput. Empty/cold columns stop boiling instead of playing a vignette.
  c.save();c.beginPath();c.rect(1192,202,176,790);c.clip();
  for(let i=0;i<7;i++){
    const y=906-i*116,color=i<2?'#ed9e50':i<4?'#c7b779':'#78c5be',volume=r.tanks[1].volume/700;
    const fill=heat*(12+volume*30),g=c.createLinearGradient(0,y-fill,0,y+15);g.addColorStop(0,color+'a0');g.addColorStop(1,color+'25');c.fillStyle=g;c.fillRect(1192,y-fill,176,fill+15);
    line(c,[[1192,y-fill],[1368,y-fill]],color+'bb',2);
    if(heat>.05)for(let k=0;k<9;k++){const u=(time*(.3+heat*.4)+k*.117+i*.38)%1;oval(c,1204+(k*47+i*23)%148,y-u*95,2+u*4,3+u*5,color+(Math.round((1-u)*heat*100)).toString(16).padStart(2,'0'));}
  }
  c.restore();line(c,[[1198,210],[1198,976]],'#d7f6e036',3);
  // Slow atmospheric vapour stays behind actors and honours reduced motion.
  for(const x of [450,1850])for(let i=0;i<7;i++){
    const u=(time*.04+i*.14)%1;oval(c,x-u*150,340-u*290,30+u*100,14+u*38,`rgba(172,193,175,${(1-u)*.055})`);
  }
}
export function drawRefineryPlatform(c,p){
  const pipe=p.refineryPipe!==undefined?PIPES[p.refineryPipe]:null,tank=p.refineryTank!==undefined?TANKS[p.refineryTank]:null;
  if(pipe){
    const vertical=pipe.x===pipe.ex,g=vertical?gradient(c,p.x,p.w,'#182f36','#849b8e','#29464b'):c.createLinearGradient(0,p.y,0,p.y+p.h);
    if(!vertical){g.addColorStop(0,'#9aac97');g.addColorStop(.3,'#5b7875');g.addColorStop(.65,'#304e55');g.addColorStop(1,'#172f38');}
    c.fillStyle=g;c.fillRect(p.x,p.y,p.w,p.h);
    // Flanges belong only to surviving shell pixels, including after cuts.
    c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
    for(const [x,y] of [[pipe.x,pipe.y],[pipe.ex,pipe.ey]]){
      c.fillStyle='#1c3741';c.fillRect(x-(vertical?12:5),y-(vertical?5:12),vertical?24:10,vertical?10:24);
      c.fillStyle=COLORS[pipe.route];c.fillRect(x-(vertical?12:2),y-(vertical?2:12),vertical?24:4,vertical?4:24);
    }
    c.restore();return;
  }
  if(tank){
    c.fillStyle=gradient(c,tank.x,tank.w,'#385960','#b6be9e','#36525b');c.fillRect(p.x,p.y,p.w,p.h);
    c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
    line(c,[[tank.x,tank.y+2],[tank.x+tank.w,tank.y+2]],'#e0d9b2',3);
    for(let x=tank.x+8;x<tank.x+tank.w;x+=26)for(const y of [tank.y+8,tank.y+tank.h-8])oval(c,x,y,2.5,2.5,'#273f49');
    c.restore();return;
  }
  c.fillStyle=p.material==='stone'?'#4b5b59':'#274652';c.fillRect(p.x,p.y,p.w,p.h);
  c.fillStyle='#c1ba8c';c.fillRect(p.x,p.y,p.w,3);
  if(p.oneWay)for(let x=Math.ceil(p.x/18)*18;x<p.x+p.w-6;x+=18){c.fillStyle='#0b2b37';c.fillRect(x,p.y+6,8,p.h-8);}
  else for(let x=Math.ceil(p.x/85)*85;x<p.x+p.w;x+=85){line(c,[[x,p.y+8],[x+20,p.y+30]],'#263f47',9);}
}
function gauge(c,x,y,value,color){
  oval(c,x,y,21,21,'#132d39');oval(c,x,y,17,17,'#bac9ac');
  for(let i=0;i<6;i++){const a=-2.7+i*.46;line(c,[[x+Math.cos(a)*12,y+Math.sin(a)*12],[x+Math.cos(a)*15,y+Math.sin(a)*15]],'#425751',2);}
  const a=-2.7+Math.min(1,value)*4.4;line(c,[[x,y],[x+Math.cos(a)*13,y+Math.sin(a)*13]],color,3);oval(c,x,y,3,3,'#234249');
}
export function drawRefineryProcess(c,state,reduced){
  const r=state.refinery;if(!r)return;const time=reduced?0:r.clock;
  const surviving=state.platforms.filter(p=>p.hp!==0&&!p.wreckId);
  // Virtual contained regions use these same exact bounds for buoyancy and
  // chemical contact, and become ordinary moving parcels through real holes.
  for(const q of refineryLiquids(r)){
    const t=TANKS.find(t=>t.kind===q.kind&&(q.kind!=='oil'||Math.abs(q.x-t.x-16)<1));
    if(!t)continue;const liquid=SPILLS[q.kind],g=c.createLinearGradient(0,q.y,0,q.y+q.h);
    g.addColorStop(0,liquid.rim);g.addColorStop(.12,liquid.color);g.addColorStop(1,liquid.color);c.fillStyle=g;c.fillRect(q.x,q.y,q.w,q.h);
    line(c,[[q.x,q.y],[q.x+q.w,q.y]],liquid.rim,2);
  }
  for(const p of surviving){
    if(p.refineryPipe===undefined)continue;const spec=PIPES[p.refineryPipe],q=r.pipes[spec.id],ratio=q.volume/spec.capacity;if(ratio<.015)continue;
    const dx=spec.ex-spec.x,dy=spec.ey-spec.y,len=Math.hypot(dx,dy),color=spec.route===0?SPILLS.oil.color:COLORS[spec.route];
    c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
    line(c,[[spec.x,spec.y],[spec.x+dx*ratio,spec.y+dy*ratio]],color+'b0',8);
    if(q.flow>.1){const phase=time*Math.min(180,40+q.flow*5);for(let n=0;n<len;n+=44){const v=((n+phase)%len)/len;if(v>ratio)continue;line(c,[[spec.x+dx*v,spec.y+dy*v],[spec.x+dx*(v-8/len),spec.y+dy*(v-8/len)]],'#ecf5c9',3);}}
    c.restore();
  }
  TANKS.forEach((t,i)=>{
    const q=r.tanks[i],top=surviving.some(p=>p.refineryTank===i&&p.y<=t.y+8&&p.w>50);
    if(!top)return;
    const x=t.x+t.w/2,y=t.y+37;
    c.fillStyle='#173540';c.fillRect(x-61,y-18,122,30);label(c,t.name,x,y+4,t.color,22);
    gauge(c,t.x+35,t.y+42,q.pressure/1.5,q.warning?'#b74629':'#365c56');
    const level=q.volume/t.capacity;
    c.fillStyle='#142e38';c.fillRect(t.x+t.w-38,t.y+28,14,t.h-55);c.fillStyle=t.color;c.fillRect(t.x+t.w-35,t.y+t.h-30-(t.h-61)*level,8,(t.h-61)*level);
    for(let v=0;v<5;v++)line(c,[[t.x+t.w-45,t.y+30+v*(t.h-60)/4],[t.x+t.w-39,t.y+30+v*(t.h-60)/4]],'#bdc9ae',2);
    if(q.warning>0){const pulse=reduced?1:.5+.5*Math.sin(time*14)**2;oval(c,t.x+t.w-61,t.y+42,9,9,'#ffc35d');oval(c,t.x+t.w-61,t.y+42,23,23,`rgba(255,160,59,${pulse*.25})`);label(c,String(Math.max(1,Math.ceil(q.warning))),x,t.y+77,'#ffe2a2',25);}
    if(t.kind==='gas'&&q.volume>0){c.fillStyle='#73bdba19';c.fillRect(t.x+17,t.y+65,t.w-64,t.h-83);for(let k=0;k<5;k++){const u=(time*.2+k*.2)%1;oval(c,t.x+65+k*29,t.y+t.h-30-u*(t.h-96),22,9,`rgba(122,204,200,${(1-u)*level*.3})`);}}
  });
  // Exposed pump flywheel tracks feed flow; a severed intake leaves it stopped.
  const feed=r.pipes[0];if(surviving.some(p=>p.refineryPipe===0)){
    const x=576,y=1190;oval(c,x,y,37,37,'#19323d');oval(c,x,y,29,29,'#899c89');oval(c,x,y,23,23,'#2b5156');
    for(let k=0;k<5;k++){const a=(reduced?0:time*feed.flow*.18)+k*TAU/5;line(c,[[x,y],[x+Math.cos(a)*21,y+Math.sin(a)*21]],'#b1bc94',5);}oval(c,x,y,7,7,'#d6c596');
  }
  // Heater light is tied to process heat and the surviving bottom mounting.
  const core=TANKS[1];if(surviving.some(p=>p.refineryTank===1&&p.y>1300)){
    for(let i=0;i<7;i++){const x=core.x+58+i*37,h=(12+Math.sin(time*13+i*2)*6)*r.heat;c.fillStyle='#f5a352';c.fillRect(x,1310-h,16,h);}
    label(c,Math.round(20+r.heat*410)+' °C',1280,1262,'#f6b67a',22);
  }
}
