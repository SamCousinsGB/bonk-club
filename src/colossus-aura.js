import {colossusRig,colossusEyeOpening} from './colossus-rig.js';

const TAU=Math.PI*2;
function halo(c,x,y,r,color,alpha){
  const g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(.4,`rgba(${color},${alpha*.35})`);
  g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
export function drawColossusAura(c,h,energy,reduced=false){
  const rig=colossusRig(h),awake=colossusEyeOpening(h.age),power=awake*.22+energy*.78;
  c.save();
  // Handfalls lift finite plumes from each contact, even before the eyes open.
  for(const [i,arm] of rig.arms.entries()){
    const elapsed=h.age-(i===0?.9:1.4),fade=Math.max(0,1-elapsed/2);
    if(elapsed>=0&&fade>0)for(let n=0;n<5;n++){
      const drift=reduced?0:elapsed;
      halo(c,1280+arm.side*(87+n*5+drift*7),i===0?692-drift*(10+n*3):716-drift*(10+n*3),
        12+n*5+drift*13,'161,150,127',fade*.16);
    }
  }
  if(power<=0){c.restore();return;}
  c.globalCompositeOperation='screen';
  halo(c,rig.head.x,rig.head.y-23,80+energy*70,'77,173,221',power*.7);
  halo(c,rig.body.x,rig.body.y-40,100+energy*55,'69,141,180',power*.5);
  for(const arm of rig.arms){
    halo(c,arm.hand.x,arm.hand.y,22+energy*18,'106,211,241',power*.65);
    c.beginPath();c.moveTo(arm.hand.x,arm.hand.y);
    c.bezierCurveTo(arm.elbow.x+arm.side*35,arm.elbow.y-15,arm.shoulder.x+arm.side*18,
      arm.shoulder.y-40,rig.head.x+arm.side*18,rig.head.y-43);
    c.strokeStyle=`rgba(128,219,249,${power*.4})`;c.lineWidth=1+energy*2;c.stroke();
  }
  // Slowly flowing corona strands follow the shoulders and head. Their count
  // is fixed; reduced motion retains the steady aura and clear charge intensity.
  const time=reduced?0:h.age;
  for(let n=0;n<12;n++){
    const angle=n/12*TAU+time*.18,radius=36+energy*30+Math.sin(time*.8+n)*6;
    const x=rig.head.x+Math.cos(angle)*radius,y=rig.head.y-26+Math.sin(angle)*radius*.82;
    c.beginPath();c.moveTo(x,y);
    c.quadraticCurveTo(x+Math.cos(angle+.6)*35,y-22-energy*20,
      x+Math.cos(angle+.8)*(45+energy*30),y-42-energy*25);
    c.strokeStyle=`rgba(139,226,251,${power*(.16+.08*Math.sin(n+time))})`;
    c.lineWidth=.8+energy*1.2;c.stroke();
  }
  for(let n=0;n<24;n++){
    const cycle=(n/24+time*(.045+energy*.04))%1;
    const side=n%2?1:-1,x=rig.body.x+side*(25+(n%6)*10)+Math.sin(time*.7+n)*8;
    const y=rig.body.y+50-cycle*(175+energy*75),alpha=Math.sin(cycle*Math.PI)*power*.65;
    c.fillStyle=`rgba(183,239,255,${alpha})`;c.beginPath();c.arc(x,y,.8+energy*(n%3)*.6,0,TAU);c.fill();
  }
  c.restore();
}
