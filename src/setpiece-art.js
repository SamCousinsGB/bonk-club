import { drawTrainCarriage } from './train-wreck-art.js';
import { ladlePose, LADLE_LIP } from "./foundry.js";
import { trainBodies, carriageShape, TRAIN_CARRIAGE_LENGTH } from "./trains.js";

const line=(c,x,y,xx,yy,color,width=3)=>{c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const dot=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
export function drawSetpieceHall(c,arena){
  const train=arena.theme==="railway";
  const g=c.createLinearGradient(0,0,0,1440);g.addColorStop(0,train?"#142b47":"#18262e");g.addColorStop(1,train?"#547080":"#58382b");c.fillStyle=g;c.fillRect(0,0,2560,1440);
  for(let x=0;x<2560;x+=320){
    c.fillStyle=train?"#acc6d014":"#ffaa4a12";c.fillRect(x+45,90,220,340);
    line(c,x,0,x,1440,"#0c192850",18);
    line(c,x,100,x+320,420,"#13212a66",8);
  }
  if(train){
    // Distant overhead supply and tunnel mouths are scenery, never collision.
    for(let x=120;x<2560;x+=580){line(c,x,680,x,1050,"#23333f",10);line(c,x,690,x+300,690,"#394b55",8);}
    line(c,0,707,2560,707,"#6b8792",2);
    for(const x of [-110,2460]){c.fillStyle="#0b1624";c.fillRect(x,855,210,207);c.strokeStyle="#7d8f92";c.lineWidth=18;c.strokeRect(x,855,210,207);}
  }else{
    for(const x of [790,1770]){
      line(c,x,80,x,230,"#56646a",18);c.fillStyle="#121c23";c.fillRect(x-130,230,260,140);
      line(c,x-145,220,x+145,220,"#a36d40",15);
      for(let y=260;y<360;y+=30)line(c,x-110,y,x+110,y,"#34434a",6);
      // Exhaust ducts behind the machinery leave the climbing routes readable.
      line(c,x+120,240,x+120,80,"#526064",35);line(c,x+120,80,x+280,80,"#526064",35);
    }
    for(let x=0;x<2560;x+=220){dot(c,x+80,470,6,"#ffc66a");line(c,x+80,430,x+80,464,"#22292c",3);}
  }
}
export function drawTrain(c,h,time,reduced){
  c.save();
  // Track ties are clipped against the surviving deck by the caller.
  for(const x of [125,2435]){
    line(c,x,h.y-18,x,h.y-310,"#2b343a",10);c.fillStyle="#111a23";c.fillRect(x-21,h.y-322,42,91);
    const lit=h.derailed||h.active||h.warning>0;
    dot(c,x,h.y-300,12,lit?"#ff5b43":"#513934");
    dot(c,x,h.y-254,12,!lit?"#79cba5":"#294e45");
    if(h.warning>0&&(reduced||Math.sin(time*9)>0))dot(c,x,h.y-278,10,"#ffcc65");
  }
  if(!h.active||h.done){c.restore();return;}
  const cars=trainBodies(h),l=-h.w/2,r=h.w/2;
  if(!reduced&&!h.derailed){
    // Wide, bounded horizontal smears imply shutter exposure without blurring
    // the whole canvas or adding transparent collision outside the train.
    const streak=c.createLinearGradient(l-430,0,r,0);
    streak.addColorStop(0,"#c5e8f000");streak.addColorStop(.2,"#a7d1dd44");streak.addColorStop(1,"#e7f5ef88");
    c.save();c.translate(h.bodyX,h.bodyY ?? h.y-h.h/2);c.scale(h.dir,1);c.translate(0,h.h/2);
    c.fillStyle=streak;c.fillRect(l-430,-h.h-8,h.w+430,h.h+14);
    for(let i=0;i<18;i++){
      const x=l+((i*277+time*2400)%(h.w+380))-380,y=-h.h-12+(i*31)%(h.h+38);
      line(c,x,y,x+160+(i%4)*85,y,i%3?"#b6dce94d":"#edf9f591",2+i%3);
    }
    c.restore();
  }
  // Couplers are physical constraints. Drawing the actual links makes their
  // articulation and eventual separation legible during a derail.
  if(h.derailed)for(let i=0;i<cars.length-1;i++)if(cars[i].coupled){
    const a=cars[i],b=cars[i+1],side=h.dir;
    const ax=a.x+Math.cos(a.angle)*carriageShape(a).w/2*side,ay=a.y+Math.sin(a.angle)*carriageShape(a).w/2*side;
    const bx=b.x-Math.cos(b.angle)*carriageShape(b).w/2*side,by=b.y-Math.sin(b.angle)*carriageShape(b).w/2*side;
    line(c,ax,ay,bx,by,"#303b42",12);line(c,ax,ay,bx,by,"#9eafb2",4);
  }
  for(const car of cars)drawTrainCarriage(c,car,h);
  if(!reduced&&!h.derailed){
    c.save();c.translate(h.bodyX,h.bodyY ?? h.y-h.h/2);c.scale(h.dir,1);c.translate(0,h.h/2);
    for(let y=-h.h+18;y<-15;y+=15){
      const smear=c.createLinearGradient(l-140,0,r-170,0);
      smear.addColorStop(0,"#dbefff00");smear.addColorStop(.25,"#dbefff45");smear.addColorStop(1,"#dbefff99");
      line(c,l-140,y,r-170,y,smear,y%2?3:5);
    }
    for(let x=l+60;x<r-260;x+=80)line(c,x-100,-h.h+48,x+50,-h.h+48,"#24485d66",18);
    for(let i=0;i<7;i++)line(c,l-35-i*28,-25-i*17,l+80-i*15,-25-i*17,"#bbddeb55",3);
    c.restore();
  }
  c.restore();
}
export function drawTrack(c,state){
  for(const p of state.platforms)if(p.y===1060&&p.hp!==0){
    c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
    for(let x=Math.floor(p.x/32)*32;x<p.x+p.w;x+=32){c.fillStyle="#493f3a";c.fillRect(x,p.y+7,17,30);}
    line(c,p.x,p.y+3,p.x+p.w,p.y+3,"#c2cdd0",5);line(c,p.x,p.y+25,p.x+p.w,p.y+25,"#8c9caa",4);c.restore();
  }
}
export function drawLadle(c,h,time,reduced){
  if(h.done)return;
  c.save();
  line(c,h.x-70,575,h.x-70,678,"#6d7c80",12);
  line(c,h.x+70,575,h.x+70,678,"#6d7c80",12);
  dot(c,h.x-70,660,14,"#adb6ab");dot(c,h.x+70,660,14,"#adb6ab");
  const pose=ladlePose(h);
  // Trunnion gearing and piston follow the same rotation as the vessel.
  line(c,h.x-70*h.dir,590,h.x-55*h.dir,652,"#293a42",15);
  line(c,h.x-70*h.dir,590,h.x-55*h.dir,652,"#b5b7a4",5);
  c.save();c.translate(h.x,660);c.rotate(pose.angle);c.scale(h.dir,1);
  const shell=()=>{c.beginPath();c.moveTo(-66,-46);c.lineTo(58,-46);c.lineTo(LADLE_LIP.x,LADLE_LIP.y);c.lineTo(62,-18);c.lineTo(52,49);c.quadraticCurveTo(0,68,-52,49);c.closePath();};
  const metal=c.createLinearGradient(-66,0,66,0);metal.addColorStop(0,"#3b464a");metal.addColorStop(.45,"#8c7963");metal.addColorStop(1,"#41494b");
  shell();c.fillStyle=metal;c.fill();c.strokeStyle="#b1b5a3";c.lineWidth=7;c.stroke();
  // Molten contents keep a world-horizontal surface inside the rotating bowl.
  if(h.ladleLeft>0){
    c.save();shell();c.clip();c.scale(h.dir,1);c.rotate(-pose.angle);
    const surface=h.active?pose.y-660:Math.max(-32,44-76*h.ladleLeft/3000);
    const heat=c.createLinearGradient(0,surface,0,surface+95);heat.addColorStop(0,"#fff1b0");heat.addColorStop(.18,"#ffb34d");heat.addColorStop(1,"#ba482b");
    c.fillStyle=heat;c.fillRect(-140,surface,280,170);line(c,-140,surface,140,surface,"#fff6c9",3);c.restore();
  }
  for(let y=10;y<50;y+=25)line(c,-49,y,49,y,"#303c41",8);
  for(const x of [-46,46])for(const y of [12,37])dot(c,x,y,3,"#c1bca5");
  line(c,58,-46,LADLE_LIP.x,LADLE_LIP.y,"#eee0b4",5);
  c.restore();
  dot(c,h.x,660,16,"#263b42");dot(c,h.x,660,9,"#b4bba7");
  dot(c,h.x+95,602,10,h.active?"#ff7850":h.warning>0&&(reduced||Math.sin(time*9)>0)?"#ffe197":"#415055");
  c.restore();
}
