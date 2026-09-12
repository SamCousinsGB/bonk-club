import { drawFurnaceFixture } from "./furnace-art.js";
import { isScanner } from "./scanner.js";
const line=(c,points,color,width=3)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
function wheel(c,x,y,r,time,spikes=false){
  c.save();c.translate(x,y);c.rotate(time*3);c.beginPath();
  for(let i=0;i<32;i++){const a=i*Math.PI/16,s=i%2?r*.72:r;c.lineTo(Math.cos(a)*s,Math.sin(a)*s);}
  c.closePath();c.fillStyle=spikes?"#b5c0c1":"#e2e7d8";c.fill();c.strokeStyle="#1c2832";c.lineWidth=3;c.stroke();
  circle(c,0,0,r*.64,spikes?"#394853":"#78949d");circle(c,0,0,7,"#efab55");c.restore();
}
function scannerPost(c,h,x) {
  const top=h.y-h.h;
  c.fillStyle="#d3ded5";c.fillRect(x,top+10,18,h.h-20);
  c.fillStyle="#719696";c.fillRect(x+3,top+25,12,h.h-65);
}
function scannerCoil(c,h,x) {
  const top=h.y-h.h;
  line(c,[[x,top+35],[x,h.y-24]],"#293e59",10);
  for(let y=top+40;y<h.y-20;y+=12)line(c,[[x-7,y],[x+7,y]],"#97bbd3",3);
}
function scannerFront(c,h) {
  const right=h.x+h.w/2;
  scannerPost(c,h,right-18);
  c.fillStyle="#497577";c.fillRect(right+3,h.y-46,18,30);
  c.fillStyle=h.active?(h.type==="magnet"?"#8acbff":"#b4ffe2"):"#376268";
  c.fillRect(right+6,h.y-42,12,9);
  if(h.type==="magnet")scannerCoil(c,h,right-25);
}
// Default draws the complete fixture for destruction artwork. Gameplay splits
// scanners around the fighters: left/rear post first, right/front post last.
export function drawHazards(c,hazards,time,theme,layer="all",reduced=false){
  for(const h of hazards||[]){
    if(h.done)continue;
    if(h.type==="furnace"||h.type==="slag"){drawFurnaceFixture(c,h,time,layer,reduced);continue;}
    if(layer==="back"&&!isScanner(h))continue;
    if(layer==="front"&&isScanner(h)){
      c.save();scannerFront(c,h);c.restore();continue;
    }
    const left=h.x-h.w/2,top=h.y-h.h;
    c.save();
    const alert=h.warning>0&&Math.sin(time*18)>0;
    if(h.warning>0&&!h.done){
      c.fillStyle=alert?"#ffca5730":"#ffca5718";c.fillRect(left,top,h.w,h.h);
      line(c,[[left,h.y-2],[left+h.w,h.y-2]],"#ffd372",3);
    }
    if(h.type === "loader") {
      // A visible outlet and amber beacon precede every physical box.
      c.fillStyle="#121e28";c.fillRect(left,top,h.w,h.h);
      c.strokeStyle="#69838b";c.lineWidth=12;c.strokeRect(left,top,h.w,h.h);
      c.fillStyle="#293c48";
      const open=h.active?0:h.warning>0?h.h*(h.warning/1):h.h;
      c.fillRect(left+6,top+6,h.w-12,Math.max(0,open-12));
      for(let y=top+15;y<top+open-8;y+=18)line(c,[[left+9,y],[left+h.w-9,y]],"#60757d",3);
      for(let x=left;x<left+h.w;x+=24)line(c,[[x,top-14],[x+12,top-26]],"#d4aa52",8);
      circle(c,h.x,top-40,10,h.warning>0?(alert?"#ffe089":"#9e6935"):"#456369");
      c.restore();continue;
    }
    if(h.type==="xray"||h.type==="magnet"){
      const magnetic=h.type==="magnet",color=magnetic?"#8acbff":"#b4ffe2";
      // The scanner opening is passable. Solid-looking shells sit at its sides;
      // the floor footprint and illuminated field mark the actual affected area.
      c.fillStyle="#15313a";c.fillRect(left-9,h.y-12,h.w+18,12);
      scannerPost(c,h,left);
      c.fillStyle="#b5cbc8";c.fillRect(left-4,top,h.w+8,22);
      c.fillStyle="#15313a";c.fillRect(h.x-28,top+4,56,14);
      circle(c,h.x+19,top+11,4,h.active?color:alert?"#ffc75c":"#4d7677");
      if(magnetic){
        scannerCoil(c,h,left+25);
        if(h.active)for(let i=0;i<5;i++){
          const inset=((time*60+i*27)%(h.w/2-28));
          c.strokeStyle="#8acbff88";c.lineWidth=2;c.beginPath();
          c.roundRect(left+inset+20,top+29,h.w-inset*2-40,h.h-50,18);c.stroke();
        }
      }else{
        c.fillStyle="#799c95";c.fillRect(h.x-17,top+22,34,18);
        circle(c,h.x,top+43,9,h.active?"#daffdf":"#243e43");
        if(h.active){
          const glow=c.createLinearGradient(0,top+40,0,h.y);
          glow.addColorStop(0,"#a9ffe04a");glow.addColorStop(1,"#a9ffe011");
          c.fillStyle=glow;c.fillRect(left,top+42,h.w,h.h-42);
          const y=top+48+((time*105)%(h.h-55));
          line(c,[[left+8,y],[left+h.w-8,y]],"#d4fff3bb",3);
        }
        // Trefoil warning symbol; no decorative prose on the playfield.
        circle(c,h.x-18,top+11,6,"#f1c85c");circle(c,h.x-18,top+11,2,"#34464b");
      }
      if(layer==="all")scannerFront(c,h);
    }else if(["steam","frost","spores"].includes(h.type)){
      const cold=h.type==="frost",organic=h.type==="spores";
      const color=cold?"#b6f3ff":organic?"#c6e582":"#efdfb5";
      if(organic){
        for(const x of [h.x-29,h.x,h.x+28]){
          line(c,[[x,h.y-3],[x,h.y-27]],"#78935a",7);
          c.beginPath();c.ellipse(x,h.y-29,20,11,0,Math.PI,Math.PI*2);c.fillStyle="#9c6d86";c.fill();
          circle(c,x-6,h.y-35,3,"#eddac0");circle(c,x+7,h.y-33,2,"#eddac0");
        }
      }else{
        c.fillStyle=cold?"#597d91":"#6c6461";c.fillRect(left,h.y-13,h.w,13);
        for(let x=left+8;x<left+h.w-4;x+=16)line(c,[[x,h.y-10],[x,h.y-1]],color,4);
        if(theme==="factory"){
          line(c,[[left,h.y-5],[left-12,h.y-5],[left-12,h.y-40]],"#809da3",9);
          circle(c,left-12,h.y-43,10,"#ad7c55");
        }
      }
      if(h.active||h.warning>0){
        c.save();c.beginPath();c.rect(left,top,h.w,h.h);c.clip();
        for(let i=0;i<18;i++){
          const age=(time*(organic?.7:1.3)+i/18)%1;
          const x=h.x+Math.sin(i*17+age*3)*h.w*.4,y=h.y-18-age*(h.h-18);
          c.globalAlpha=(h.active?1:.22)*(1-age)*.48;
          if(cold){line(c,[[x-5,y],[x+5,y]],color,2);line(c,[[x,y-5],[x,y+5]],color,2);}
          else circle(c,x,y,organic?3:12+age*20,color);
        }
        c.restore();
      }
    }else if(h.type==="conveyor"){
      c.fillStyle="#142632";c.fillRect(left,h.y-10,h.w,18);
      line(c,[[left,h.y-10],[left+h.w,h.y-10]],"#c9a867",3);
      for(let x=left+9;x<left+h.w-5;x+=25)circle(c,x,h.y,6,"#708a91");
      c.save();c.beginPath();c.rect(left,h.y-16,h.w,12);c.clip();
      for(let n=-1;n<h.w/30+1;n++){const x=left+n*30+(h.active?((time*160*h.dir)%30):0);line(c,[[x-h.dir*5,h.y-14],[x+h.dir*3,h.y-10],[x-h.dir*5,h.y-6]],"#f7ce65",2);}
      c.restore();circle(c,left+5,h.y-8,4,h.active?"#95ee99":"#5c7276");
    }else if(h.type==="pendulum"){
      c.fillStyle="#263e48";c.fillRect(h.x-20,top-7,40,15);circle(c,h.x,top,7,"#aab1a0");
      line(c,[[h.x,top],[h.bodyX,h.bodyY]],"#172731",9);
      line(c,[[h.x,top],[h.bodyX,h.bodyY]],"#a9b6b4",3);
      wheel(c,h.bodyX,h.bodyY,36,time,true);
    }else if(h.type==="saw"){
      line(c,[[left,h.y-28],[left+h.w,h.y-28]],"#172731",11);
      line(c,[[left,h.y-28],[left+h.w,h.y-28]],"#8b9fa8",3);
      for(const x of [left,left+h.w]){c.fillStyle="#b48751";c.fillRect(x-6,h.y-40,12,40);}
      wheel(c,h.bodyX,h.bodyY,29,time);
    }else if(h.type==="crusher"){
      for(const x of [h.x-22,h.x+22]){
        line(c,[[x,top],[x,h.bodyY-10]],"#1b2933",13);
        line(c,[[x,top],[x,h.bodyY-10]],"#95adb3",6);
      }
      c.fillStyle="#304b57";c.fillRect(left-8,top-12,h.w+16,26);
      c.fillStyle="#0f202a";c.fillRect(left-3,h.bodyY-24,h.w+6,48);
      c.fillStyle="#c49b61";c.fillRect(left,h.bodyY-19,h.w,36);
      for(let x=left+8;x<left+h.w;x+=18)line(c,[[x,h.bodyY+2],[x+9,h.bodyY+14]],"#273741",7);
      circle(c,h.x,top,6,alert||h.active?"#ff7154":"#93b9b4");
    }else if(h.type==="geyser"){
      c.fillStyle="#152832";c.fillRect(left,h.y-13,h.w,16);
      for(let x=left+7;x<left+h.w-5;x+=13)line(c,[[x,h.y-10],[x,h.y-2]],h.active?"#ffde85":alert?"#ff8555":"#819593",5);
      if(h.warning>0){c.fillStyle="#ff9c5030";c.fillRect(left,top,h.w,h.h);}
      if(h.active)for(let i=0;i<9;i++){
        const x=left+8+i*(h.w-16)/8,tip=top+Math.sin(time*16+i*7)*16;
        c.beginPath();c.moveTo(x-14,h.y-10);c.quadraticCurveTo(x-24,tip+h.h*.45,x+Math.sin(i+time*7)*12,tip);c.quadraticCurveTo(x+23,tip+h.h*.7,x+15,h.y-10);
        c.fillStyle=i%2?"#ffac42cc":"#ff592aa0";c.fill();
        line(c,[[x,h.y-13],[x+Math.sin(i+time*12)*6,tip+h.h*.45]],"#fff0a4bb",7);
      }
    }else if(h.type==="tesla"){
      for(const x of [left,left+h.w]){
        line(c,[[x,h.y],[x,top+20]],"#283e4b",10);
        for(let y=top+25;y<h.y-8;y+=18)line(c,[[x-9,y],[x+9,y]],"#92a9b5",3);
        circle(c,x,top+15,13,h.active||alert?"#b9faff":"#50747c");
      }
      if(h.active){
        c.fillStyle="#98ecff16";c.fillRect(left,top,h.w,h.h);
        for(let n=0;n<3;n++){
          const y=top+20+n*(h.h-25)/3,points=[];
          for(let i=0;i<9;i++)points.push([left+i*h.w/8,y+Math.sin(time*30+i*5+n)*12]);
          line(c,points,"#72c5ff66",11);line(c,points,"#d8fcff",3);
        }
      }
    }
    c.restore();
  }
}
