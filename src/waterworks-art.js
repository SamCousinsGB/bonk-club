import { WATERWORKS_PIPES } from './waterworks-arena.js';
import { waterworksOutlet, generatorPhase } from './waterworks.js';

const circle=(c,x,y,r,fill)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();};
function pipe(c,points,width=48) {
  c.lineJoin='round';c.lineCap='butt';
  for(const [w,color,offset] of [[width+12,'#091e29',6],[width,'#247879',0],[width-10,'#419797',-4],[5,'#91cebe',-width*.28]]) {
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x+offset,y):c.moveTo(x+offset,y));
    c.strokeStyle=color;c.lineWidth=w;c.stroke();
  }
}
function valve(c,x,y,r=24) {
  circle(c,x,y,r+4,'#142e36');circle(c,x,y,r,'#c16e4b');circle(c,x,y,r-6,'#24484d');
  c.strokeStyle='#cf825c';c.lineWidth=5;
  for(let i=0;i<3;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(x-Math.cos(a)*r,y-Math.sin(a)*r);c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.stroke();}
  circle(c,x,y,6,'#ead09b');
}
export function drawWaterworksHall(c) {
  const bg=c.createLinearGradient(0,0,0,1440);bg.addColorStop(0,'#102b37');bg.addColorStop(.7,'#255159');bg.addColorStop(1,'#102e3b');
  c.fillStyle=bg;c.fillRect(0,0,2560,1440);
  // Glazed service-hall tiles, with a broad darker inspection pit behind water.
  for(let y=120;y<1400;y+=64)for(let x=0;x<2560;x+=128) {
    c.fillStyle=(x/128+y/64)%3<1?'#57858110':'#9fc0ad08';c.fillRect(x+2,y+2,124,60);
    c.strokeStyle='#0a27322b';c.lineWidth=2;c.strokeRect(x,y,128,64);
  }
  c.fillStyle='#082532';c.fillRect(672,1030,1216,350);
  for(let y=1040;y<1380;y+=40)for(let x=672;x<1888;x+=64) {
    c.fillStyle=(x+y)%128?'#255464':'#2f6270';c.fillRect(x+1,y+1,62,38);
  }
  // Recessed filter vessels and inspection windows are background equipment.
  for(const x of [50,2210]) {
    const g=c.createLinearGradient(x,0,x+300,0);g.addColorStop(0,'#142e38');g.addColorStop(.35,'#55757a');g.addColorStop(.65,'#3c5c66');g.addColorStop(1,'#112d37');
    c.fillStyle=g;c.beginPath();c.roundRect(x,165,300,550,110);c.fill();
    c.strokeStyle='#7d999b55';c.lineWidth=3;c.stroke();
    for(const y of [280,490,620]){c.fillStyle='#153741';c.fillRect(x+8,y,284,15);c.fillStyle='#74919077';c.fillRect(x+10,y,280,3);}
    for(let y=285;y<490;y+=38){circle(c,x+76,y,9,'#101f2c');circle(c,x+76,y,5,'#68a69f');}
    pipe(c,[[x+150,180],[x+150,106],[1280,106]],30);
  }
  pipe(c,[[0,96],[2560,96]],66);
  for(let x=100;x<2500;x+=280) {
    c.fillStyle='#082532';c.fillRect(x,56,22,80);c.fillStyle='#658e8c';c.fillRect(x+4,56,12,80);
    for(const y of [66,126])circle(c,x+10,y,4,'#c2c6ae');
  }
  for(const p of WATERWORKS_PIPES) {
    pipe(c,[[p.x,100],[p.x,p.y-162]],38);
    valve(c,p.x,p.y-215);
    // Pressure dial belongs to the upstream main, above the breakable nozzle.
    circle(c,p.x+37,p.y-190,18,'#081e2b');circle(c,p.x+37,p.y-190,14,'#dddbc0');
    c.strokeStyle='#b4563c';c.lineWidth=3;c.beginPath();c.moveTo(p.x+37,p.y-190);c.lineTo(p.x+43,p.y-199);c.stroke();
  }
  for(const x of [600,1280,1960]) {
    c.fillStyle='#0b2430';c.fillRect(x-108,145,216,24);c.fillStyle='#e3ead1';c.fillRect(x-90,163,180,8);
    const glow=c.createRadialGradient(x,177,0,x,177,250);glow.addColorStop(0,'#bfedd91b');glow.addColorStop(1,'#d1f6dc00');
    c.fillStyle=glow;c.fillRect(x-250,171,500,310);
  }
  // Pool depth markings are functional scenery, not extra interface text.
  for(const x of [690,1864])for(let y=1070;y<1340;y+=40){c.fillStyle='#a7d3d176';c.fillRect(x,y,16,3);}
}
export function drawWaterworksPipes(c,state) {
  for(const [i,p] of WATERWORKS_PIPES.entries()) {
    const pieces=state.platforms.filter(q=>q.waterworksPipe===i&&q.hp!==0&&q.x<p.x+40&&q.x+q.w>p.x-40&&q.y<p.y&&q.y+q.h>p.y-146);
    if(!pieces.length)continue;
    c.save();c.beginPath();for(const q of pieces)c.rect(Math.max(q.x,p.x-40),Math.max(q.y,p.y-146),
      Math.min(q.x+q.w,p.x+40)-Math.max(q.x,p.x-40),Math.min(q.y+q.h,p.y)-Math.max(q.y,p.y-146));c.clip();
    const g=c.createLinearGradient(p.x-40,0,p.x+40,0);g.addColorStop(0,'#16464d');g.addColorStop(.3,'#65aa9c');g.addColorStop(.7,'#347e7d');g.addColorStop(1,'#153d49');
    c.fillStyle=g;c.fillRect(p.x-40,p.y-146,80,146);
    for(const y of [p.y-132,p.y-27]){
      c.fillStyle='#172f39';c.fillRect(p.x-40,y,80,17);c.fillStyle='#84afa4';c.fillRect(p.x-40,y,80,4);
      for(const x of [p.x-29,p.x+29])circle(c,x,y+10,4,'#cfccac');
    }
    c.fillStyle='#071c28';c.fillRect(p.x-26,p.y-8,52,8);c.restore();
    if(waterworksOutlet(state.platforms,i)){circle(c,p.x+30,p.y-67,5,'#87e0c5');}
  }
}
export function drawWaterworksGenerators(c,state,reduced) {
  const phase=generatorPhase(state.elapsed),pulse=reduced?1:.65+Math.sin(state.time*14)*.35;
  for(const b of state.cover.filter(b=>b.kind==='generator'&&b.hp>0)) {
    c.save();c.translate(b.x+b.w/2,b.y+b.h/2);c.rotate(b.angle||0);
    // Existing prop artwork supplies the physical engine casing and handle.
    const color=phase==='live'?'#99ffff':phase==='warning'?'#ffd76b':'#395b5a';
    c.globalAlpha=phase==='warning'?pulse:1;circle(c,-b.w*.25,-b.h*.26,6,color);
    c.globalAlpha=1;c.fillStyle='#101e2b';c.fillRect(-b.w*.13,-b.h*.38,b.w*.45,b.h*.27);
    c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(-8,-15);c.lineTo(0,-20);c.lineTo(8,-15);c.lineTo(16,-20);c.stroke();
    c.restore();
  }
}
