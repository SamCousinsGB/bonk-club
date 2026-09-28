import {colossusRig,colossusEyeOpening,COLOSSUS_EYES,COLOSSUS_FIGURE} from './colossus-rig.js';

let parts,weathered,figure;
export function warmColossusFigure(){
  if(!parts&&typeof Image!=='undefined'){
    parts=new Image();parts.src=new URL('./assets/colossus-weathered.webp',import.meta.url).href;
    parts.decoding='async';
  }
}
const transform=(c,f)=>c.transform(f.a,f.b,f.c,f.d,f.x,f.y);
function limb(c,a,b,source,from,to,width=1){
  const dx=to[0]-from[0],dy=to[1]-from[1];
  const scale=Math.hypot(b.x-a.x,b.y-a.y)/Math.hypot(dx,dy);
  c.save();c.translate(a.x,a.y);c.rotate(-Math.atan2(b.x-a.x,b.y-a.y));
  c.scale(scale*width,scale);c.rotate(Math.atan2(dx,dy));
  c.drawImage(weathered,...source,source[0]-from[0],source[1]-from[1],source[2],source[3]);
  c.restore();
}
export function drawColossusFigure(c,h,energy=0,airlight=null){
  warmColossusFigure();if(!parts?.complete||!parts.naturalWidth)return;
  if(!weathered){
    weathered=document.createElement('canvas');weathered.width=parts.naturalWidth;weathered.height=parts.naturalHeight;
    const p=weathered.getContext('2d');p.drawImage(parts,0,0);
    // Keep the bronze and verdigris while compressing contrast for distance.
    // The landscape airlight below supplies the shared atmospheric colour.
    const pixels=p.getImageData(0,0,weathered.width,weathered.height),d=pixels.data;
    for(let i=0;i<d.length;i+=4){
      const light=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722;
      d[i]=32+light*.34+(d[i]-light)*.55;
      d[i+1]=37+light*.34+(d[i+1]-light)*.55;
      d[i+2]=44+light*.34+(d[i+2]-light)*.55;
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
  // Overlapping anatomical landmarks keep the shoulders, hips and tendons
  // continuous. Full-length thighs and a proportionate head avoid doll anatomy.
  for(const leg of rig.legs){
    const left=leg.side<0;
    limb(c,leg.hip,leg.knee,left?[214,974,134,234]:[675,974,135,234],
      left?[286,1000]:[739,1000],left?[270,1163]:[755,1163],.62);
    limb(c,leg.knee,leg.foot,left?[173,1131,146,390]:[706,1131,143,390],
      left?[270,1163]:[755,1163],left?[232,1483]:[793,1483],.8);
  }
  c.save();transform(c,rig.body);
  c.drawImage(weathered,553,24,340,469,-75,-167,150,208);
  c.restore();
  // Both arms are in front of the torso, including through discharge. Drawing
  // the chest over them made the relaxed hands look tucked behind the back.
  for(const arm of rig.arms){
    const left=arm.side<0;
    limb(c,arm.shoulder,arm.elbow,left?[210,496,143,244]:[672,500,143,240],
      left?[296,538]:[723,539],left?[246,706]:[776,706],.64);
    limb(c,arm.elbow,arm.hand,left?[206,675,109,297]:[706,675,110,297],
      left?[246,706]:[776,706],left?[261,936]:[760,936],.68);
  }
  c.save();transform(c,rig.head);
  c.drawImage(weathered,105,7,331,468,-44,-120,88,120);
  c.restore();
  c.globalCompositeOperation='source-atop';
  if(airlight){
    c.globalAlpha=.62;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(airlight,x,y,w,height);c.globalAlpha=1;
  }
  c.globalCompositeOperation='source-over';
  c.save();transform(c,rig.head);
  // Slow mechanical shutters reveal cold blue light even between attacks.
  const opening=colossusEyeOpening(h.age),aperture=opening*(1.8+energy*2.6);
  if(opening>0)for(const e of COLOSSUS_EYES){
    c.shadowColor=`rgba(137,205,239,${opening*(.3+energy*.4)})`;
    c.shadowBlur=1+energy*3;
    c.fillStyle=`rgba(${energy>.3?'213,251,255':'147,185,201'},${opening*(.26+energy*.74)})`;
    c.fillRect(e.x-3,e.y-aperture/2,6,aperture);
  }
  c.restore();c.restore();
  target.save();target.filter='blur(0.65px)';
  target.drawImage(figure,x,y,w,height);target.restore();
}

// Only the gripping knuckles pass in front of the ridge. The body and tucked
// legs remain occluded by its actual silhouette throughout the climb.
export function drawColossusGrip(c,h){
  if(!figure)return;
  const {x,y,w,h:height}=COLOSSUS_FIGURE;
  for(const arm of colossusRig(h).arms)if(arm.grip>.8){
    c.save();c.globalAlpha=(arm.grip-.8)*5;c.beginPath();
    c.ellipse(arm.hand.x,arm.hand.y,7,10,0,0,Math.PI*2);c.clip();
    c.drawImage(figure,x,y,w,height);c.restore();
  }
}
