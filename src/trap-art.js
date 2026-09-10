const line=(c,points,color,width=3)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
function wheel(c,x,y,r,time,spikes=false){
  c.save();c.translate(x,y);c.rotate(time*3);c.beginPath();
  for(let i=0;i<32;i++){const a=i*Math.PI/16,s=i%2?r*.72:r;c.lineTo(Math.cos(a)*s,Math.sin(a)*s);}
  c.closePath();c.fillStyle=spikes?"#b5c0c1":"#e2e7d8";c.fill();c.strokeStyle="#1c2832";c.lineWidth=3;c.stroke();
  circle(c,0,0,r*.64,spikes?"#394853":"#78949d");circle(c,0,0,7,"#efab55");c.restore();
}
export function drawHazards(c,hazards,time){
  for(const h of hazards||[]){
    const left=h.x-h.w/2,top=h.y-h.h;
    c.save();if(h.done)c.globalAlpha=.3;
    const alert=h.warning>0&&Math.sin(time*18)>0;
    if(h.type==="conveyor"){
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
