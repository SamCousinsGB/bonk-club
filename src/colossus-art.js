import { COLOSSUS, COLOSSUS_EYES, colossusPhase, colossusPose, colossusEye, colossusBeam, beamX, beamEdges } from './colossus.js';

const TAU=Math.PI*2;
let backdrop, mist, energyTexture;
const clamp=n=>Math.max(0,Math.min(1,n));
const line=(c,x,y,ex,ey,color,width)=>{c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill();};
export function warmColossusArt() {
  if(!backdrop && typeof Image!=='undefined'){
    backdrop=new Image();backdrop.src=new URL('./assets/colossus.webp',import.meta.url).href;
    backdrop.decoding='async';
  }
}
function cloudTexture() {
  if(mist)return mist;
  mist=document.createElement('canvas');mist.width=512;mist.height=128;
  const c=mist.getContext('2d'),data=c.createImageData(512,128);
  const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  const noise=(x,y)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;
  };
  for(let y=0;y<128;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4,n=noise(x/57,y/29)*.6+noise(x/19,y/12)*.3+noise(x/7,y/5)*.1;
    const edge=Math.sin(x/512*Math.PI)*Math.sin(y/128*Math.PI);
    data.data[i]=155;data.data[i+1]=176;data.data[i+2]=190;
    data.data[i+3]=clamp((n-.25)*1.4)*edge*190;
  }
  c.putImageData(data,0,0);return mist;
}
function glow(c,x,y,r,alpha,hot=false) {
  if(alpha<=0)return;
  const g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,hot?`rgba(245,254,255,${alpha})`:`rgba(115,203,226,${alpha})`);
  g.addColorStop(.18,`rgba(143,221,245,${alpha*.5})`);
  g.addColorStop(1,'rgba(91,184,224,0)');
  c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function beamTexture() {
  if(energyTexture)return energyTexture;
  const strip=document.createElement('canvas');strip.width=720;strip.height=1;
  const s=strip.getContext('2d'),bloom=s.createLinearGradient(0,0,720,0);
  for(const [at,color] of [[0,'#63bfea00'],[.12,'#63bfea08'],[.28,'#8cdef636'],[.33,'#b9f5ff85'],[.38,'#e5fcffe6'],[.45,'#ffffff'],[.55,'#ffffff'],[.62,'#e5fcffe6'],[.67,'#b9f5ff85'],[.72,'#8cdef636'],[.88,'#63bfea08'],[1,'#63bfea00']])bloom.addColorStop(at,color);
  s.fillStyle=bloom;s.fillRect(0,0,720,1);
  energyTexture=document.createElement('canvas');energyTexture.width=720;energyTexture.height=1024;
  const c=energyTexture.getContext('2d');
  for(let y=0;y<1024;y++){
    const width=720*(y+.5)/1024;c.drawImage(strip,(720-width)/2,y,width,1);
  }
  return energyTexture;
}
function eye(c,h,index,energy,reduced) {
  const p=colossusEye(h,index),base=COLOSSUS_EYES[index],pose=colossusPose(h.age);
  c.save();
  // Restrict the optical mechanism to the aperture in the matte painting.
  c.beginPath();c.ellipse(base.x+pose.x,base.y+pose.y,1.8,1.6,0,0,TAU);c.clip();
  c.translate(p.x,p.y);c.scale(.022,.022*.88);
  const rim=c.createRadialGradient(-12,-15,2,0,0,67);
  rim.addColorStop(0,'#172734');rim.addColorStop(.4,'#0c1823');rim.addColorStop(.85,'#13212c');rim.addColorStop(1,'#293c48');
  circle(c,0,0,64,rim);
  const rotation=(reduced?0:h.age*.016)+energy*.72;
  for(let ring=0;ring<3;ring++){
    const r=56-ring*12;c.strokeStyle=energy>0?`rgba(161,221,232,${.08+energy*.58})`:'#72879324';c.lineWidth=ring?1:2;
    c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
    for(let n=0;n<12;n++){
      const a=n*TAU/12+rotation*(ring%2?-1:1);
      line(c,Math.cos(a)*(r-4),Math.sin(a)*(r-4),Math.cos(a)*(r+1),Math.sin(a)*(r+1),energy?'#85999b65':'#85999b20',1.5);
    }
  }
  // Slow iris blades open mechanically; the idle optic is cold and nearly dead.
  for(let n=0;n<8;n++){
    c.save();c.rotate(n*TAU/8+rotation);
    c.beginPath();c.moveTo(18+energy*10,-7);c.lineTo(42,-21);c.lineTo(52,4);c.lineTo(27,10);c.closePath();
    const blade=c.createLinearGradient(18,-7,52,4);
    blade.addColorStop(0,energy?`rgba(114,162,178,${.09+energy*.32})`:'#23354180');
    blade.addColorStop(1,'#09152170');c.fillStyle=blade;c.fill();c.restore();
  }
  circle(c,0,0,18+energy*11,'#07121b');
  circle(c,-2,1,6+energy*17,energy?`rgba(205,248,255,${.1+energy*.9})`:'#60798388');
  if(energy>0){glow(c,0,0,85,energy*.7,true);circle(c,0,0,5+energy*9,`rgba(244,254,255,${energy})`);}
  c.restore();
  glow(c,p.x,p.y,8+energy*65,energy*.35);
  if(energy>.3){
    c.save();c.globalCompositeOperation='screen';
    const g=c.createLinearGradient(p.x-95,p.y,p.x+95,p.y);
    g.addColorStop(0,'#77e2ff00');g.addColorStop(.48,`rgba(179,235,252,${energy*.28})`);
    g.addColorStop(.5,`rgba(228,251,255,${energy*.6})`);g.addColorStop(.52,`rgba(179,235,252,${energy*.28})`);g.addColorStop(1,'#77e2ff00');
    c.fillStyle=g;c.fillRect(p.x-95,p.y-.5,190,1+energy);c.restore();
  }
}
export function drawColossusSky(c,state,reduced=false) {
  warmColossusArt();
  const h=state.hazards.find(h=>h.type==='colossus');if(!h)return;
  const p=colossusPose(h.age),phase=colossusPhase(h.age),fighting=state.phase==='fight';
  c.fillStyle='#1a2734';c.fillRect(0,0,2560,1440);
  if(backdrop?.complete && backdrop.naturalWidth)c.drawImage(backdrop,-6+p.x,-5+p.y,2572,1450);
  const energy=fighting?(phase.firing?1:phase.charge**1.65):0;
  // A slow exposure change draws the eye to the awakened machine without strobing.
  c.fillStyle=`rgba(6,17,30,${.09+energy*.17})`;c.fillRect(0,0,2560,1440);
  eye(c,h,0,h.eye===0?energy:0,reduced);eye(c,h,1,h.eye===1?energy:0,reduced);
  const cloud=cloudTexture(),time=reduced?0:h.age;
  c.save();
  for(let n=0;n<4;n++){
    c.globalAlpha=[.12,.15,.19,.12][n];
    const x=-520+n*660+Math.sin(time*.011+n)*110;
    c.drawImage(cloud,x,530+n*117,1480,155+n*25);
  }
  c.restore();
  // Low foreground haze separates the playable ruins from the far horizon.
  const veil=c.createLinearGradient(0,750,0,1440);
  veil.addColorStop(0,'#0b162000');veil.addColorStop(.45,'#0b162032');veil.addColorStop(1,'#0b1620bb');
  c.fillStyle=veil;c.fillRect(0,750,2560,690);
}
export function drawColossusStone(c,p) {
  const g=c.createLinearGradient(0,p.y,0,p.y+p.h);
  g.addColorStop(0,'#858c8e');g.addColorStop(.1,'#525e65');g.addColorStop(1,'#253541');
  c.fillStyle=g;c.fillRect(p.x,p.y,p.w,p.h);
  c.fillStyle='#c9d1cd';c.fillRect(p.x,p.y,p.w,2.5);
  c.fillStyle='#b8a790';c.fillRect(p.x,p.y+5,p.w,1.5);
  c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
  for(let x=Math.floor(p.x/83)*83;x<p.x+p.w;x+=83){
    line(c,x,p.y+9,x-7,p.y+p.h,'#142530a0',2);
    line(c,x+2,p.y+9,x-5,p.y+p.h,'#aab3ad30',1);
    if(p.h>28){line(c,x+18,p.y+15,x+56,p.y+15,'#9ba7a345',1);c.fillStyle='#132631';c.fillRect(x+29,p.y+20,4,9);}
  }
  c.restore();
}
export function colossusShake(state) {
  const h=state?.phase==='fight'&&state.hazards?.find(h=>h.type==='colossus');
  if(!h)return 0;
  const p=colossusPhase(h.age);
  return p.firing?8+9*Math.exp(-p.fire*18):p.charge**4*3;
}
export function drawColossusBeam(c,state,reduced=false) {
  const h=state.phase==='fight'&&state.hazards.find(h=>h.type==='colossus');if(!h)return;
  const phase=colossusPhase(h.age);if(!phase.firing && phase.charge<=0)return;
  const beam=colossusBeam(h),a=colossusBeam(h,0),b=colossusBeam(h,1);
  c.save();
  if(!phase.firing){
    // The faint fan is the exact forthcoming sweep, widening toward the level.
    // Its two steady margins remain legible with sound off and reduced motion.
    const q=clamp((phase.charge-.18)/.5);
    const left=a.ex<b.ex?a:b,right=a.ex<b.ex?b:a;
    c.fillStyle=`rgba(158,214,231,${q*.055})`;
    const lx=Math.min(...beamEdges(left,1510)),rx=Math.max(...beamEdges(right,1510));
    c.beginPath();c.moveTo(left.x,left.y);c.lineTo(lx,1510);
    c.lineTo(rx,1510);c.lineTo(right.x,right.y);c.closePath();c.fill();
    for(const edge of [a,b])line(c,edge.x,edge.y,edge.ex,edge.ey,`rgba(172,232,244,${q*.22})`,1.5);
    // Illumination is clipped to actual surviving stone, including prior cuts.
    for(const p of state.platforms){
      const edges=[...beamEdges(a,p.y),...beamEdges(b,p.y)];
      const lo=Math.min(...edges),hi=Math.max(...edges);
      const x=Math.max(p.x,lo),right=Math.min(p.x+p.w,hi);
      if(right>x){c.fillStyle=`rgba(160,222,231,${q*.42})`;c.fillRect(x,p.y,right-x,3);}
    }
    c.restore();return;
  }
  // Project surviving structures away from the light; shadows change with the
  // live cuts and never leave a phantom slab spanning an erased opening.
  c.fillStyle=reduced?'#050c1718':'#03091630';
  for(const p of state.platforms.slice(0,260)){
    const project=x=>({x:beam.x+(x-beam.x)*2.8,y:beam.y+(p.y-beam.y)*2.8});
    const l=project(p.x),r=project(p.x+p.w);
    c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+p.w,p.y);c.lineTo(r.x,r.y);c.lineTo(l.x,l.y);c.closePath();c.fill();
  }
  c.globalCompositeOperation='screen';
  const envelope=Math.min(1,(phase.fire*COLOSSUS.fire+.03)/.12,(1-phase.fire)*COLOSSUS.fire/.18);
  c.globalAlpha=envelope;
  // Soft outer energy, a hard dangerous edge and a white-hot central core.
  c.save();c.translate(beam.x,beam.y);c.rotate(Math.atan2(beam.ey-beam.y,beam.ex-beam.x)-Math.PI/2);
  const length=Math.hypot(beam.ex-beam.x,beam.ey-beam.y);
  c.drawImage(beamTexture(),-180,0,360,length);
  c.restore();
  if(!reduced)for(let n=0;n<5;n++){
    const offset=Math.sin(h.age*1.2+n*1.7)*38;
    line(c,beam.x+offset*.005,beam.y,beam.ex+offset,beam.ey,'#eeffff40',1+n%2);
  }
  glow(c,beam.x,beam.y,85,.6,true);
  // Bloom is local; it never whites out the HUD or hides all the escape routes.
  c.fillStyle=`rgba(165,219,241,${reduced ? .025 : .055})`;c.fillRect(0,0,2560,1440);
  for(const p of state.platforms.slice(0,260)){
    const x=beamX(beam,p.y);
    for(const edge of [p.x,p.x+p.w])if(Math.abs(edge-x)<110){
      glow(c,edge,p.y,95,.25,true);
      line(c,edge,p.y,edge,p.y+p.h,'#ecfcff',2);
    }
  }
  c.restore();
}
