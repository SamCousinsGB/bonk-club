import { COLOSSUS, colossusPhase, colossusEye, colossusBeam, colossusBeams, beamX, beamEdges } from './colossus.js';
import {drawColossusFigure,warmColossusFigure} from './colossus-figure.js';
import {COLOSSUS_FIGURE} from './colossus-rig.js';

let backdrop, foothills, airlight, mist, energyTexture, beamBloom, vapour, heatSource;
const clamp=n=>Math.max(0,Math.min(1,n));
const line=(c,x,y,ex,ey,color,width)=>{c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
export function warmColossusArt() {
  warmColossusFigure();
  if(!energyTexture&&typeof document!=='undefined')beamTexture();
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
    const {x,y,w,h}=COLOSSUS_FIGURE;
    p.drawImage(backdrop,x*sx,y*sy,w*sx,h*sy,0,0,12,8);
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
  g.addColorStop(0,hot?`rgba(255,224,181,${alpha})`:`rgba(186,62,37,${alpha})`);
  g.addColorStop(.18,`rgba(223,78,40,${alpha*.42})`);
  g.addColorStop(1,'rgba(102,20,15,0)');
  c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function beamTexture() {
  if(energyTexture)return energyTexture;
  energyTexture=document.createElement('canvas');energyTexture.width=720;energyTexture.height=1024;
  const c=energyTexture.getContext('2d'),pixels=c.createImageData(720,1024),d=pixels.data;
  const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const noise=(x,y)=>{
    const a=Math.floor(x),b=Math.floor(y),fx=x-a,fy=y-b,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;
  };
  beamBloom=document.createElement('canvas');beamBloom.width=720;beamBloom.height=1024;
  const b=beamBloom.getContext('2d'),bloom=b.createImageData(720,1024),bd=bloom.data;
  // Radiance across a cylindrical shaft seen in perspective: a continuous hot
  // core, copper penumbra and broad red scattering. Density only modulates light;
  // no opaque pigment, surface grain, parallel wires or hard triangular border.
  for(let y=0;y<1024;y++)for(let x=0;x<720;x++){
    const depth=(y+.5)/1024,u=(x-359.5)/(120*depth),i=(y*720+x)*4;
    if(Math.abs(u)>3)continue;
    const density=.87+noise(u*2+19,y/91)*.13;
    const drift=(noise(7,y/135)-.5)*.075;
    const core=Math.exp(-(((u+drift)/.36)**2)),mantle=Math.exp(-u*u*1.65);
    const scattering=Math.exp(-u*u*.44);
    d[i]=255;d[i+1]=72+mantle*67+core*106;d[i+2]=35+mantle*41+core*150;
    d[i+3]=Math.min(255,(core*215+mantle*117)*density);
    bd[i]=244;bd[i+1]=62+mantle*33;bd[i+2]=30+mantle*16;
    bd[i+3]=scattering*64*density;
  }
  c.putImageData(pixels,0,0);b.putImageData(bloom,0,0);
  // One soft cloud sprite serves the dilute shaft haze and vaporised stone.
  // The radial taper removes every rectangular edge before compositing.
  vapour=document.createElement('canvas');vapour.width=192;vapour.height=192;
  const v=vapour.getContext('2d'),cloud=v.createImageData(192,192);
  for(let y=0;y<192;y++)for(let x=0;x<192;x++){
    const u=(x-95.5)/96,w=(y-95.5)/96,r=u*u+w*w,i=(y*192+x)*4;
    const billow=noise(x/43,y/43)*.6+noise(x/17,y/17)*.3+noise(x/7,y/7)*.1;
    cloud.data[i]=226;cloud.data[i+1]=140;cloud.data[i+2]=99;
    cloud.data[i+3]=Math.max(0,1-r)**2*(.25+billow*.75)*210;
  }
  v.putImageData(cloud,0,0);
  return energyTexture;
}
function eye(c,h,index,energy) {
  if(energy<=0)return;
  const p=colossusEye(h,index);
  glow(c,p.x,p.y,4+energy*13,energy*.38);
  if(energy>.3){
    c.save();c.globalCompositeOperation='screen';
    const g=c.createLinearGradient(p.x-32,p.y,p.x+32,p.y);
    g.addColorStop(0,'#ad3c2400');g.addColorStop(.42,`rgba(187,60,34,${energy*.23})`);
    g.addColorStop(.5,`rgba(243,152,97,${energy*.65})`);g.addColorStop(.58,`rgba(187,60,34,${energy*.23})`);g.addColorStop(1,'#ad3c2400');
    c.fillStyle=g;c.fillRect(p.x-9,p.y-.5,18,1+energy);c.restore();
  }
}
export function drawColossusSky(c,state,reduced=false) {
  warmColossusArt();
  const h=state.hazards.find(h=>h.type==='colossus');if(!h)return;
  const phase=colossusPhase(h.age,h.chargeAt),fighting=state.phase==='fight';
  c.fillStyle='#273b4b';c.fillRect(0,0,2560,1440);
  if(backdrop?.complete&&backdrop.naturalWidth)c.drawImage(backdrop,0,0,2560,1440);
  const energy=fighting?(phase.firing?1:phase.charge**1.65):0;
  drawColossusFigure(c,h,energy,sceneAirlight());
  drawFoothills(c);
  // The warning comes from the eyes and actual sweep. The body emits no light.
  c.fillStyle=`rgba(6,17,30,${.1+energy*.09})`;c.fillRect(0,0,2560,1440);
  eye(c,h,0,energy);eye(c,h,1,energy);
  const cloud=cloudTexture(),time=reduced?0:h.age;
  c.save();
  // Broad valley fog crosses both creature and landscape, obscuring the lower
  // anatomy without outlining it or creating a creature-centred halo.
  for(let n=0;n<3;n++){
    c.globalAlpha=[.2,.32,.38][n];
    c.drawImage(cloud,480+n*180+Math.sin(time*.009+n)*100,570+n*61,1350,120+n*22);
  }
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
function heatShimmer(c,beams,time){
  if(!heatSource)heatSource=document.createElement('canvas');
  const {width,height}=c.canvas;
  if(heatSource.width!==width||heatSource.height!==height){heatSource.width=width;heatSource.height=height;}
  const s=heatSource.getContext('2d');s.clearRect(0,0,width,height);s.drawImage(c.canvas,0,0);
  // Refract only the air beside each shaft, using one scene capture. The inner
  // and outer cones form a narrow fringe; bounded offsets cannot drag the HUD.
  for(const beam of beams){
    const length=Math.hypot(beam.ex-beam.x,beam.ey-beam.y),nx=(beam.ey-beam.y)/length,ny=-(beam.ex-beam.x)/length;
    const first=Math.max(0,Math.floor(c.getTransform().transformPoint(beam).y));
    c.save();c.beginPath();
    for(const r of [beam.radius*1.8,beam.radius*.7]){
      c.moveTo(beam.x,beam.y);c.lineTo(beam.ex+nx*r,beam.ey+ny*r);c.lineTo(beam.ex-nx*r,beam.ey-ny*r);c.closePath();
    }
    c.clip('evenodd');c.setTransform(1,0,0,1,0,0);c.globalAlpha=.65;
    const step=Math.max(1,(height-first)/32);
    for(let y=first;y<height;y+=step){
      const h=Math.min(step,height-y),depth=(y-first)/Math.max(1,height-first);
      const dx=Math.sin(time*8+y*.035+beam.eye)*(.4+depth)*width/1600;
      c.drawImage(heatSource,0,y,width,h,dx,y,width,h);
    }
    c.restore();
  }
}
function surfaceLight(c,state,beam,time,reduced){
  const hits=[],platforms=state.platforms.slice(0,260),bottoms=new Map();
  for(const p of platforms){
    const key=Math.round((p.y+p.h)*10),row=bottoms.get(key)||[];row.push(p);bottoms.set(key,row);
  }
  for(const p of platforms){
    if(p.y<beam.y||p.y>1440)continue;
    const edges=beamEdges(beam,p.y),lo=Math.min(...edges),hi=Math.max(...edges),x=beamX(beam,p.y);
    const spread=(hi-lo)*.5+65,left=Math.max(p.x,x-spread),right=Math.min(p.x+p.w,x+spread);
    if(right>left){
      // Remove faces covered by the slice above. Collision strips inside one
      // cut slab must not turn into a stack of illuminated horizontal shelves.
      let spans=[[left,right]];
      for(const above of bottoms.get(Math.round(p.y*10))||[]){
        spans=spans.flatMap(([a,b])=>above.x>=b||above.x+above.w<=a?[[a,b]]:
          [[a,Math.min(b,above.x)],[Math.max(a,above.x+above.w),b]].filter(([a,b])=>b-a>.1));
      }
      const g=c.createLinearGradient(x-spread,p.y,x+spread,p.y);
      g.addColorStop(0,'#ff704000');g.addColorStop(.5,'#ffd6a699');g.addColorStop(1,'#ff704000');
      c.fillStyle=g;for(const [a,b] of spans)c.fillRect(a,p.y,b-a,Math.min(3,p.h));
    }
    for(const edge of [p.x,p.x+p.w]){
      if(Math.min(Math.abs(edge-lo),Math.abs(edge-hi))>14||edge<0||edge>2560)continue;
      // Many eight-unit collision slices describe one cut face. Merge their
      // visible contacts so that neither bloom nor particles pile up per slice.
      if(hits.some(hit=>Math.hypot(hit.x-edge,hit.y-p.y)<80))continue;
      hits.push({x:edge,y:p.y});
    }
  }
  for(const hit of hits.sort((a,b)=>b.y-a.y).slice(0,8)){
    c.save();c.translate(hit.x,hit.y);c.scale(1,.42);glow(c,0,0,100,.65,true);c.restore();
    glow(c,hit.x,hit.y,32,.8,true);
    const seed=hit.x*.031+hit.y*.017+beam.eye;
    for(let n=0;n<4;n++){
      const age=reduced?(n+.5)/4:(time*.42+n*.27+seed)%1,r=26+age*54;
      c.save();c.globalAlpha*=.19*(1-age);
      c.drawImage(vapour,hit.x+Math.sin(seed+n)*age*38-r,hit.y-12-age*72-r,r*2,r*2);c.restore();
    }
    if(!reduced)for(let n=0;n<12;n++){
      const age=(time*1.3+n*.381+seed)%1,a=n*2.399+seed;
      const vx=Math.cos(a)*(42+n*4),vy=-55-Math.abs(Math.sin(a))*(90+n*3);
      const x=hit.x+vx*age,y=hit.y+vy*age+95*age*age;
      line(c,x,y,x-vx*.025,y-(vy+190*age)*.025,`rgba(255,${170+Math.floor((1-age)*58)},118,${(1-age)**2*.8})`,1.3);
    }
  }
}
export function drawColossusBeam(c,state,reduced=false) {
  const h=state.phase==='fight'&&state.hazards.find(h=>h.type==='colossus');if(!h)return;
  const phase=colossusPhase(h.age,h.chargeAt);if(!phase.firing && phase.charge<=0)return;
  const beams=colossusBeams(h);
  if(phase.firing&&!reduced)heatShimmer(c,beams,h.age);
  for(const beam of beams)drawColossusRay(c,state,h,phase,beam,reduced);
}
function drawColossusRay(c,state,h,phase,beam,reduced) {
  const a=colossusBeam(h,0,beam.eye),b=colossusBeam(h,1,beam.eye);
  c.save();
  if(!phase.firing){
    // The faint fan is the exact forthcoming sweep, widening toward the level.
    // Its two steady margins remain legible with sound off and reduced motion.
    const q=clamp((phase.charge-.18)/.5);
    const left=a.ex<b.ex?a:b,right=a.ex<b.ex?b:a;
    c.fillStyle=`rgba(164,56,35,${q*.075})`;
    const lx=Math.min(...beamEdges(left,1510)),rx=Math.max(...beamEdges(right,1510));
    c.beginPath();c.moveTo(left.x,left.y);c.lineTo(lx,1510);
    c.lineTo(rx,1510);c.lineTo(right.x,right.y);c.closePath();c.fill();
    for(const edge of [a,b])line(c,edge.x,edge.y,edge.ex,edge.ey,`rgba(227,132,87,${q*.38})`,1.5);
    // Illumination is clipped to actual surviving stone, including prior cuts.
    for(const p of state.platforms){
      const edges=[...beamEdges(a,p.y),...beamEdges(b,p.y)];
      const lo=Math.min(...edges),hi=Math.max(...edges);
      const x=Math.max(p.x,lo),right=Math.min(p.x+p.w,hi);
      if(right>x){c.fillStyle=`rgba(222,119,75,${q*.5})`;c.fillRect(x,p.y,right-x,3);}
    }
    c.restore();return;
  }
  // Perspective, exposure and scattering supply depth. A fully opaque shadow
  // from every collision slice would stripe and repeatedly darken the scene.
  const envelope=Math.min(1,(phase.fire*COLOSSUS.fire+.03)/.12,(1-phase.fire)*COLOSSUS.fire/.18);
  c.globalAlpha=envelope;c.globalCompositeOperation='screen';
  c.save();c.translate(beam.x,beam.y);c.rotate(Math.atan2(beam.ey-beam.y,beam.ex-beam.x)-Math.PI/2);
  const length=Math.hypot(beam.ex-beam.x,beam.ey-beam.y);
  beamTexture();
  c.drawImage(beamBloom,-280,0,560,length);
  c.drawImage(beamTexture(),-180,0,360,length);
  const time=reduced?0:h.age;
  // Thin turbulent pockets of air catch the light without becoming a solid
  // surface. Motion comes from travelling density, not flickering brightness.
  for(let n=0;n<9;n++){
    const depth=.08+((n*.6180339+time*.055)%1)*.92;
    const x=Math.sin(n*3.71+time*.17)*beam.radius*depth*.85;
    const w=(70+n%3*24)*depth,hazeLength=110+depth*190;
    c.save();c.globalAlpha=envelope*.14*Math.sin(depth*Math.PI);
    c.drawImage(vapour,x-w/2,length*depth-hazeLength/2,w,hazeLength);c.restore();
  }
  c.restore();
  glow(c,beam.x,beam.y,52,.7,true);
  c.save();c.translate(beam.x,beam.y);c.scale(1,.08);glow(c,0,0,100,.38,true);c.restore();
  surfaceLight(c,state,beam,time,reduced);
  c.restore();
}
