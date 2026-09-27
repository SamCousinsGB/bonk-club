import { COLOSSUS, colossusPhase, colossusEye, colossusBeam, colossusBeams, beamX, beamEdges } from './colossus.js';
import {drawColossusFigure,warmColossusFigure} from './colossus-figure.js';

const TAU=Math.PI*2;
let backdrop, foothills, airlight, mist, energyTexture;
const clamp=n=>Math.max(0,Math.min(1,n));
const line=(c,x,y,ex,ey,color,width)=>{c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill();};
export function warmColossusArt() {
  warmColossusFigure();
  if(!backdrop && typeof Image!=='undefined'){
    backdrop=new Image();backdrop.src=new URL('./assets/colossus-landscape.webp',import.meta.url).href;
    backdrop.decoding='async';
  }
}
function drawFoothills(c){
  if(!backdrop?.naturalWidth)return;
  if(!foothills){
    // Trace the actual painted ridge in the 1672x941 source plate. Replaying
    // these opaque mountain pixels places the machine behind real terrain;
    // a horizontal alpha fade lets it show through peaks and look pasted on.
    const ridge=[[700,481],[735,469],[748,464],[759,460],[766,461],
      [773,456],[780,454],[784,455],[788,452],[791,454],[797,455],
      [803,459],[811,461],[819,462],[825,461],[833,463],[841,463],
      [849,466],[857,468],[865,470],[873,470],[880,471],[889,470],
      [898,472],[906,472],[914,470],[922,474],[933,473],[944,466],
      [953,470],[966,471]];
    foothills=document.createElement('canvas');foothills.width=400;foothills.height=190;
    const p=foothills.getContext('2d'),sx=backdrop.naturalWidth/2560,sy=backdrop.naturalHeight/1440;
    p.beginPath();ridge.forEach(([x,y],i)=>{
      const px=x/1672*2560-1080,py=y/941*1440-650;
      if(i)p.lineTo(px,py);else p.moveTo(px,py);
    });
    p.lineTo(400,190);p.lineTo(0,190);p.closePath();
    p.filter='blur(0.55px)';p.fill();p.filter='none';
    p.globalCompositeOperation='source-in';
    p.drawImage(backdrop,1080*sx,650*sy,400*sx,190*sy,0,0,400,190);
  }
  c.drawImage(foothills,1080,650);
}
function sceneAirlight(){
  if(!backdrop?.naturalWidth)return null;
  if(!airlight){
    // Only broad lighting colours survive this reduction: no scenery details
    // can appear inside the machine. The warm horizon and cool lower valley
    // now colour its haze in the same places as the surrounding landscape.
    airlight=document.createElement('canvas');airlight.width=12;airlight.height=8;
    const p=airlight.getContext('2d'),sx=backdrop.naturalWidth/2560,sy=backdrop.naturalHeight/1440;
    p.drawImage(backdrop,1100*sx,570*sy,360*sx,240*sy,0,0,12,8);
  }
  return airlight;
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
function eye(c,h,index,energy) {
  if(energy<=0)return;
  const p=colossusEye(h,index);
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
  const phase=colossusPhase(h.age,h.chargeAt),fighting=state.phase==='fight';
  c.fillStyle='#273b4b';c.fillRect(0,0,2560,1440);
  if(backdrop?.complete&&backdrop.naturalWidth)c.drawImage(backdrop,0,0,2560,1440);
  const energy=fighting?(phase.firing?1:phase.charge**1.65):0;
  // A slow exposure change draws the eye to the awakened machine without strobing.
  drawColossusFigure(c,h,energy,sceneAirlight());
  drawFoothills(c);
  c.fillStyle=`rgba(6,17,30,${.09+energy*.17})`;c.fillRect(0,0,2560,1440);
  eye(c,h,0,energy);eye(c,h,1,energy);
  const cloud=cloudTexture(),time=reduced?0:h.age;
  c.save();
  for(let n=0;n<4;n++){
    c.globalAlpha=[.13,.17,.2,.14][n];
    const x=-520+n*660+Math.sin(time*.011+n)*110;
    c.drawImage(cloud,x,720+n*96,1480,155+n*25);
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
  const p=colossusPhase(h.age,h.chargeAt);
  return p.firing?8+9*Math.exp(-p.fire*18):p.charge**4*3;
}
export function drawColossusBeam(c,state,reduced=false) {
  const h=state.phase==='fight'&&state.hazards.find(h=>h.type==='colossus');if(!h)return;
  const phase=colossusPhase(h.age,h.chargeAt);if(!phase.firing && phase.charge<=0)return;
  for(const beam of colossusBeams(h))drawColossusRay(c,state,h,phase,beam,reduced);
}
function drawColossusRay(c,state,h,phase,beam,reduced) {
  const a=colossusBeam(h,0,beam.eye),b=colossusBeam(h,1,beam.eye);
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
  c.fillStyle=reduced?'#050c170c':'#03091618';
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
  c.fillStyle=`rgba(165,219,241,${reduced ? .0125 : .0275})`;c.fillRect(0,0,2560,1440);
  for(const p of state.platforms.slice(0,260)){
    const x=beamX(beam,p.y);
    for(const edge of [p.x,p.x+p.w])if(Math.abs(edge-x)<110){
      glow(c,edge,p.y,95,.25,true);
      line(c,edge,p.y,edge,p.y+p.h,'#ecfcff',2);
    }
  }
  c.restore();
}
