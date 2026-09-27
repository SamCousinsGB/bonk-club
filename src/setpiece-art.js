import { TRAIN_Y } from "./setpiece-arenas.js";
import { drawTrainCarriage } from './train-wreck-art.js';
import { ladlePose, LADLE_LIP } from "./foundry.js";
import { trainBodies, carriageShape } from "./trains.js";

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
    // Deep station glazing and distant city silhouettes keep the playable decks
    // distinct from the architecture. No bright rectangle follows the train.
    const glass=c.createLinearGradient(0,180,0,1200);glass.addColorStop(0,"#102333");glass.addColorStop(1,"#294451");
    c.fillStyle=glass;c.fillRect(110,160,2340,1070);
    for(let i=0;i<22;i++){
      const x=115+i*112,top=710+(i*79)%260;
      c.fillStyle=i%2?"#142a36":"#1b3340";c.fillRect(x,top,84,1230-top);
      c.fillStyle="#b9b49828";for(let y=top+22;y<1210;y+=37)for(let k=0;k<3;k++)if((i+k+y)%5<3)c.fillRect(x+12+k*23,y,7,10);
    }
    for(let x=110;x<2500;x+=390){line(c,x,160,x,1230,"#0d202b",14);line(c,x+6,160,x+6,1230,"#46606a",2);}
    for(const y of [160,610,1030])line(c,110,y,2450,y,"#112733",11);
    for(const x of [0,2410]){
      c.fillStyle="#1c303b";c.fillRect(x,110,150,1130);
      for(let y=160;y<1120;y+=160){c.fillStyle="#40535a";c.fillRect(x+35,y,65,85);c.fillStyle="#b5c1b233";c.fillRect(x+42,y+8,51,4);}
    }
    // A high steel roof, insulated service conduits and inset station lighting.
    for(let x=0;x<2560;x+=320){line(c,x,100,x+160,190,"#0e202a",14);line(c,x+160,190,x+320,100,"#0e202a",14);}
    line(c,0,190,2560,190,"#334b55",16);
    for(const y of [226,238,250])line(c,0,y,2560,y,"#1c333d",5);
    for(const x of [380,1010,1550,2180]){
      line(c,x,190,x,286,"#111f29",3);c.fillStyle="#172a34";c.fillRect(x-83,282,166,16);
      line(c,x-72,299,x+72,299,"#d5d6b9",5);
    }
    // Portal surrounds frame the bottom guideway, with no lower fighting floor.
    for(const x of [-140,2490]){c.fillStyle="#0a151d";c.fillRect(x,TRAIN_Y-200,210,220);c.strokeStyle="#344c57";c.lineWidth=18;c.strokeRect(x,TRAIN_Y-200,210,220);}
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
  // One pair of fixed signals belongs to the service, never to archived wrecks.
  if(!h.wreck)for(const x of [125,2435]){
    line(c,x,h.y-18,x,h.y-310,"#2b343a",10);c.fillStyle="#111a23";c.fillRect(x-21,h.y-322,42,91);
    const lit=h.active||h.warning>0;
    dot(c,x,h.y-300,12,lit?"#ff5b43":"#513934");
    dot(c,x,h.y-254,12,!lit?"#79cba5":"#294e45");
    if(h.warning>0&&(reduced||Math.sin(time*9)>0))dot(c,x,h.y-278,10,"#ffcc65");
  }
  if(!h.active||h.done){c.restore();return;}
  const cars=trainBodies(h);
  // Couplers are physical constraints. Drawing the actual links makes their
  // articulation and eventual separation legible during a derail.
  if(h.derailed)for(let i=0;i<cars.length-1;i++)if(cars[i].coupled){
    const a=cars[i],b=cars[i+1],side=h.dir;
    const ax=a.x+Math.cos(a.angle)*carriageShape(a).w/2*side,ay=a.y+Math.sin(a.angle)*carriageShape(a).w/2*side;
    const bx=b.x-Math.cos(b.angle)*carriageShape(b).w/2*side,by=b.y-Math.sin(b.angle)*carriageShape(b).w/2*side;
    line(c,ax,ay,bx,by,"#303b42",12);line(c,ax,ay,bx,by,"#9eafb2",4);
  }
  for(const car of cars)drawTrainCarriage(c,car,h);
  c.restore();
}
export function drawTrack(c,state){
  for(const p of state.platforms)if(p.hp!==0){
    c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
    if(p.y===TRAIN_Y){
      const concrete=c.createLinearGradient(0,p.y,0,p.y+p.h);concrete.addColorStop(0,"#a0aaa6");concrete.addColorStop(.18,"#74878b");concrete.addColorStop(1,"#344a56");
      c.fillStyle=concrete;c.fillRect(p.x,p.y,p.w,p.h);
      line(c,p.x,p.y+3,p.x+p.w,p.y+3,"#d0d4c6",5);
      line(c,p.x,p.y+17,p.x+p.w,p.y+17,"#283c46",6);
      line(c,p.x,p.y+22,p.x+p.w,p.y+22,"#a5afb0",3);
      for(let x=Math.floor(p.x/160)*160;x<p.x+p.w;x+=160){
        line(c,x,p.y+26,x,p.y+60,"#263c47",3);
        line(c,x+12,p.y+33,x+148,p.y+33,"#607680",2);
        for(const dx of [16,144])dot(c,x+dx,p.y+44,3,"#b0b7ac");
      }
    }else{
      c.fillStyle=p.oneWay?"#55686a":"#53656a";c.fillRect(p.x,p.y,p.w,p.h);
      line(c,p.x,p.y+2,p.x+p.w,p.y+2,"#b2bba9",3);
      if(p.oneWay){for(let x=Math.floor(p.x/18)*18;x<p.x+p.w;x+=18)line(c,x,p.y+5,x+7,p.y+12,"#182e3a",3);}
      else{
        line(c,p.x,p.y+12,p.x+p.w,p.y+12,"#202f38",6);
        for(let x=Math.floor(p.x/40)*40;x<p.x+p.w;x+=40){line(c,x,p.y+6,x+18,p.y+6,"#c3aa64",4);}
        for(let x=Math.floor(p.x/90)*90;x<p.x+p.w;x+=90)line(c,x,p.y+19,x+30,p.y+p.h,"#2a404b",5);
      }
    }
    c.restore();
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
