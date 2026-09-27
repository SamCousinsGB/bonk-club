import {colossusRig,colossusEyeOpening,COLOSSUS_EYES,COLOSSUS_FIGURE} from './colossus-rig.js';

let parts,weathered,figure;
export function warmColossusFigure(){
  if(!parts&&typeof Image!=='undefined'){
    parts=new Image();parts.src=new URL('./assets/colossus-bronze.webp',import.meta.url).href;
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
      d[i]=40+light*.4+(d[i]-light)*1.1;
      d[i+1]=43+light*.4+(d[i+1]-light)*1.1;
      d[i+2]=48+light*.4+(d[i+2]-light)*1.1;
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
  // Antique cast-bronze parts. Atlas joint landmarks map onto the same rigid
  // skeleton as the moving head and both laser origins.
  for(const leg of rig.legs){
    const left=leg.side<0;
    limb(c,leg.hip,leg.knee,left?[184,955,164,244]:[674,955,164,244],
      left?[276,978]:[746,978],left?[253,1161]:[770,1161],.5);
    limb(c,leg.knee,leg.foot,left?[144,1132,160,380]:[719,1132,164,380],
      left?[253,1161]:[770,1161],left?[212,1480]:[814,1480],.7);
  }
  for(const arm of rig.arms){
    const left=arm.side<0;
    limb(c,arm.shoulder,arm.elbow,left?[176,471,146,254]:[702,471,146,254],
      left?[248,508]:[776,508],left?[218,692]:[806,692],.52);
    limb(c,arm.elbow,arm.hand,left?[176,663,149,289]:[700,663,149,289],
      left?[218,692]:[806,692],left?[261,918]:[763,918],.56);
  }
  c.save();transform(c,rig.body);
  c.drawImage(weathered,546,4,364,470,-63,-164,126,220);
  c.restore();
  c.save();transform(c,rig.head);
  c.drawImage(weathered,108,8,327,448,-41.6,-103.6,84,110);
  c.restore();
  c.globalCompositeOperation='source-atop';
  if(airlight){
    c.globalAlpha=.42;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(airlight,x,y,w,height);c.globalAlpha=1;
  }
  c.globalCompositeOperation='source-over';
  if(energy>0){
    // Light the real bronze silhouette and its articulated joints as power
    // travels upward. Keep the light clipped to surviving opaque bronze.
    c.save();c.globalCompositeOperation='source-atop';
    c.strokeStyle=`rgba(133,228,249,${energy*.8})`;c.lineWidth=1.1+energy;
    c.shadowColor='#8febff';c.shadowBlur=6+energy*7;
    for(const arm of rig.arms){
      c.beginPath();c.moveTo(arm.hand.x,arm.hand.y);c.lineTo(arm.elbow.x,arm.elbow.y);
      c.lineTo(arm.shoulder.x,arm.shoulder.y);c.lineTo(rig.head.x,rig.head.y);c.stroke();
    }
    transform(c,rig.body);c.beginPath();c.moveTo(-23,24);c.lineTo(-14,-40);c.lineTo(-27,-76);
    c.lineTo(-6,-106);c.lineTo(3,-155);c.moveTo(22,20);c.lineTo(10,-42);c.lineTo(28,-92);c.lineTo(3,-155);c.stroke();
    c.restore();
  }
  c.save();transform(c,rig.head);
  // Slow mechanical shutters reveal cold blue light even between attacks.
  const opening=colossusEyeOpening(h.age),aperture=opening*(3.8+energy*1.6);
  if(opening>0)for(const e of COLOSSUS_EYES){
    c.shadowColor=`rgba(137,205,239,${opening*(.3+energy*.4)})`;
    c.shadowBlur=3+energy*3;
    c.fillStyle=`rgba(${energy>.3?'213,251,255':'147,209,239'},${opening*(.65+energy*.35)})`;
    c.fillRect(e.x-3.8,e.y-aperture/2,7.6,aperture);
  }
  c.restore();c.restore();
  target.save();target.filter='blur(0.45px)';
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
