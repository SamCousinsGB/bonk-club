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
  if(h.done)return;
  c.save();
  // Track ties are clipped against the surviving deck by the caller.
  for(const x of [125,2435]){
    line(c,x,h.y-18,x,h.y-310,"#2b343a",10);c.fillStyle="#111a23";c.fillRect(x-21,h.y-322,42,91);
    const lit=h.active||h.warning>0;
    dot(c,x,h.y-300,12,lit?"#ff5b43":"#513934");
    dot(c,x,h.y-254,12,!lit?"#79cba5":"#294e45");
    if(h.warning>0&&(reduced||Math.sin(time*9)>0))dot(c,x,h.y-278,10,"#ffcc65");
  }
  if(!h.active){c.restore();return;}
  c.translate(h.bodyX,h.bodyY ?? h.y-h.h/2);c.rotate(h.angle||0);c.scale(h.dir,1);c.translate(0,h.h/2);
  const l=-h.w/2,r=h.w/2;
  if(!reduced&&!h.derailed){
    // Wide, bounded horizontal smears imply shutter exposure without blurring
    // the whole canvas or adding transparent collision outside the train.
    const streak=c.createLinearGradient(l-430,0,r,0);
    streak.addColorStop(0,"#c5e8f000");streak.addColorStop(.2,"#a7d1dd44");streak.addColorStop(1,"#e7f5ef88");
    c.fillStyle=streak;c.fillRect(l-430,-h.h-8,h.w+430,h.h+14);
    for(let i=0;i<18;i++){
      const x=l+((i*277+time*2400)%(h.w+380))-380,y=-h.h-12+(i*31)%(h.h+38);
      line(c,x,y,x+160+(i%4)*85,y,i%3?"#b6dce94d":"#edf9f591",2+i%3);
    }
  }
  const body=c.createLinearGradient(0,-h.h,0,0);body.addColorStop(0,"#f3f6ea");body.addColorStop(.5,"#b5d4d6");body.addColorStop(1,"#536e80");
  c.beginPath();c.moveTo(l,-h.h+25);c.quadraticCurveTo(l+10,-h.h,l+50,-h.h);c.lineTo(r-240,-h.h);c.quadraticCurveTo(r-110,-h.h+4,r,-32);c.lineTo(r,-10);c.lineTo(l,-10);c.closePath();c.fillStyle=body;c.fill();
  c.fillStyle="#df7350";c.fillRect(l,-47,h.w-30,12);
  for(let x=l+35;x<r-260;x+=80){c.fillStyle="#193d54";c.beginPath();c.roundRect(x,-h.h+30,60,39,9);c.fill();line(c,x+8,-h.h+34,x+50,-h.h+34,"#6398b0",3);}
  c.beginPath();c.moveTo(r-223,-h.h+20);c.lineTo(r-162,-h.h+28);c.lineTo(r-88,-69);c.lineTo(r-200,-79);c.closePath();c.fillStyle="#16364d";c.fill();
  for(let x=l+140;x<r-130;x+=300){line(c,x,-h.h+2,x,-13,"#506979",5);dot(c,x-45,-9,17,"#182c3a");dot(c,x+45,-9,17,"#182c3a");}
  dot(c,r-26,-30,8,"#fff7cf");
  if(!reduced&&!h.derailed){
    for(let y=-h.h+18;y<-15;y+=15){
      const smear=c.createLinearGradient(l-140,0,r-170,0);
      smear.addColorStop(0,"#dbefff00");smear.addColorStop(.25,"#dbefff45");smear.addColorStop(1,"#dbefff99");
      line(c,l-140,y,r-170,y,smear,y%2?3:5);
    }
    for(let x=l+60;x<r-260;x+=80)line(c,x-100,-h.h+48,x+50,-h.h+48,"#24485d66",18);
  }
  if(!reduced&&!h.derailed)for(let i=0;i<7;i++)line(c,l-35-i*28,-25-i*17,l+80-i*15,-25-i*17,"#bbddeb55",3);
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
  const phase=(h.age+(h.dir<0?5:0))%12;
  const tilt=h.active?.65:h.warning>0?.65*(1-h.warning/2):phase>=9?.65*Math.max(0,10-phase):0;
  c.save();c.translate(h.x,660);c.rotate(tilt);
  c.beginPath();c.moveTo(-66,-46);c.lineTo(66,-46);c.lineTo(52,49);c.quadraticCurveTo(0,68,-52,49);c.closePath();c.fillStyle="#716459";c.fill();c.strokeStyle="#adb3a3";c.lineWidth=7;c.stroke();
  c.fillStyle="#ffbd61";c.fillRect(-53,-42,106,15);
  for(let y=-10;y<40;y+=20)line(c,-51,y,51,y,"#343b40",7);
  c.restore();
  dot(c,h.x+95,602,10,h.active?"#ff7850":h.warning>0&&(reduced||Math.sin(time*9)>0)?"#ffe197":"#415055");
  if(h.active){
    // The visible white-hot core is exactly the authoritative stream footprint.
    const g=c.createLinearGradient(0,705,0,h.y);g.addColorStop(0,"#fff5b8");g.addColorStop(1,"#ff9342");
    c.fillStyle="#f05c2580";c.fillRect(h.x-28,705,56,h.y-705);
    c.fillStyle=g;c.fillRect(h.x-22,705,44,h.y-705);
    line(c,h.x-11,705,h.x-11,h.y,"#fff6c5",8);
    for(let i=0;i<22;i++){
      const age=((reduced?0:time)*1.5+i*.137)%1,side=i%2?-1:1;
      const x=h.x+side*age*95,y=1220-Math.sin(age*Math.PI)*70;
      dot(c,x,y,2+(1-age)*3,"#ffd981");
    }
  }
  c.restore();
}
