import {colossusRig,COLOSSUS_EYES,COLOSSUS_SCALE} from './colossus-rig.js';

let parts,weathered,figure;
export function warmColossusFigure(){
  if(!parts&&typeof Image!=='undefined'){
    parts=new Image();parts.src=new URL('./assets/colossus-parts.webp',import.meta.url).href;
    parts.decoding='async';
  }
}
const transform=(c,f)=>c.transform(f.a,f.b,f.c,f.d,f.x,f.y);
function limb(c,a,b,source,width,overlap){
  c.save();c.translate(a.x,a.y);c.rotate(-Math.atan2(b.x-a.x,b.y-a.y));
  c.drawImage(weathered,...source,-width*COLOSSUS_SCALE/2,-overlap*COLOSSUS_SCALE,
    width*COLOSSUS_SCALE,Math.hypot(b.x-a.x,b.y-a.y)+overlap*COLOSSUS_SCALE*2);
  c.restore();
}
export function drawColossusFigure(c,h,energy=0){
  warmColossusFigure();if(!parts?.complete||!parts.naturalWidth)return;
  if(!weathered){
    weathered=document.createElement('canvas');weathered.width=parts.naturalWidth;weathered.height=parts.naturalHeight;
    const p=weathered.getContext('2d');p.drawImage(parts,0,0);
    // Compress texture contrast into the blue-grey values of the far ridge.
    // Surface detail should disappear with distance instead of reading as a
    // sharp, brightly flecked cutout in front of a softer landscape.
    const pixels=p.getImageData(0,0,weathered.width,weathered.height),d=pixels.data;
    for(let i=0;i<d.length;i+=4){
      const light=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722;
      d[i]=58+light*.25;d[i+1]=70+light*.25;d[i+2]=88+light*.23;
    }
    p.putImageData(pixels,0,0);
    figure=document.createElement('canvas');figure.width=720;figure.height=480;
  }
  // Assemble opaque parts first. Applying atmosphere to the complete machine
  // avoids dark doubled seams or transparent joints where parts overlap.
  const target=c;c=figure.getContext('2d');
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,720,480);
  c.setTransform(2,0,0,2,-2200,-1140);
  const rig=colossusRig(h);
  c.save();
  // Original metal parts on a transparent atlas. Each rigid transform uses
  // the same skeleton as the head and both laser origins.
  for(const arm of rig.arms){
    const left=arm.side<0;
    limb(c,arm.shoulder,arm.elbow,left?[190,595,270,275]:[795,595,280,275],46,9);
    limb(c,arm.elbow,arm.hand,left?[190,837,255,389]:[815,837,270,389],43,8);
  }
  c.save();transform(c,rig.body);
  c.drawImage(weathered,588,51,654,515,-91,-130,182,143);
  c.restore();
  c.save();transform(c,rig.head);
  c.drawImage(weathered,132,69,369,414,-26.6,-29.1,53.3,60.6);
  c.restore();
  c.globalCompositeOperation='source-atop';
  const haze=c.createLinearGradient(0,635,0,741);
  haze.addColorStop(0,'#9096a122');haze.addColorStop(.5,'#969da84d');haze.addColorStop(1,'#9da4aebf');
  c.fillStyle=haze;c.fillRect(1100,570,360,240);
  c.globalCompositeOperation='source-over';
  c.save();transform(c,rig.head);
  // No black pupils. Narrow metallic shutters light up during the charge.
  if(energy>0)for(const e of COLOSSUS_EYES){
    c.fillStyle=`rgba(213,251,255,${Math.min(1,energy*1.7)})`;
    c.fillRect(e.x-3.4,e.y-.5-energy,6.8,1+energy*2);
  }
  c.restore();c.restore();
  target.save();target.filter='blur(0.65px)';
  target.drawImage(figure,1100,570,360,240);target.restore();
}
