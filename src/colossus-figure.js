import {colossusRig,colossusEyeOpening,COLOSSUS_EYES,COLOSSUS_SCALE,COLOSSUS_FIGURE} from './colossus-rig.js';

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
export function drawColossusFigure(c,h,energy=0,airlight=null){
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
      d[i]=58+light*.3;d[i+1]=63+light*.29;d[i+2]=75+light*.27;
    }
    p.putImageData(pixels,0,0);
    figure=document.createElement('canvas');figure.width=COLOSSUS_FIGURE.w*2;figure.height=COLOSSUS_FIGURE.h*2;
  }
  // Assemble opaque parts first. Applying atmosphere to the complete machine
  // avoids dark doubled seams or transparent joints where parts overlap.
  const target=c;c=figure.getContext('2d');
  const {x,y,w,h:height}=COLOSSUS_FIGURE;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,figure.width,figure.height);
  c.setTransform(2,0,0,2,-x*2,-y*2);
  const rig=colossusRig(h);
  c.save();
  // Original metal parts on a transparent atlas. Each rigid transform uses
  // the same skeleton as the head and both laser origins.
  for(const leg of rig.legs){
    const left=leg.side<0;
    // Reuse the original battered armour and exposed pistons, without hands,
    // as long load-bearing thigh and shin assemblies behind the pelvis.
    limb(c,leg.hip,leg.knee,left?[203,620,240,250]:[810,620,240,250],74,12);
    limb(c,leg.knee,leg.foot,left?[192,842,221,220]:[850,842,220,220],68,13);
  }
  for(const arm of rig.arms){
    const left=arm.side<0;
    limb(c,arm.shoulder,arm.elbow,left?[190,595,270,275]:[795,595,280,275],58,9);
    limb(c,arm.elbow,arm.hand,left?[190,837,255,389]:[815,837,270,389],56,8);
  }
  c.save();transform(c,rig.body);
  c.drawImage(weathered,588,51,654,515,-114,-180,228,195);
  c.restore();
  c.save();transform(c,rig.head);
  c.drawImage(weathered,132,69,369,414,-26.6,-29.1,53.3,60.6);
  c.restore();
  c.globalCompositeOperation='source-atop';
  if(airlight){
    c.globalAlpha=.58;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(airlight,x,y,w,height);c.globalAlpha=1;
  }
  c.globalCompositeOperation='source-over';
  c.save();transform(c,rig.head);
  // Slow mechanical shutters reveal cold blue light even between attacks.
  const opening=colossusEyeOpening(h.age),aperture=opening*(3.8+energy*1.6);
  if(opening>0)for(const e of COLOSSUS_EYES){
    c.shadowColor=`rgba(137,205,239,${opening*(.3+energy*.4)})`;
    c.shadowBlur=3+energy*3;
    c.fillStyle=`rgba(${energy>.3?'213,251,255':'147,209,239'},${opening*(.65+energy*.35)})`;
    c.fillRect(e.x-4.5,e.y-aperture/2,9,aperture);
  }
  c.restore();c.restore();
  target.save();target.filter='blur(0.45px)';
  target.drawImage(figure,x,y,w,height);target.restore();
}
