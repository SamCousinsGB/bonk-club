import { PLANE, planePose, cachedPlaneBreaches, planeHullKey } from "./plane.js";

const TAU = Math.PI * 2;
const line = (c, points, color, width = 3) => {
  c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.strokeStyle=color; c.lineWidth=width; c.stroke();
};
function ellipse(c,x,y,rx,ry,color) {
  c.beginPath(); c.ellipse(x,y,rx,ry,0,0,TAU); c.fillStyle=color; c.fill();
}
function ring(c,rx,ry,color,width) {
  c.beginPath(); c.ellipse(PLANE.x,PLANE.y,rx,ry,0,0,TAU);
  c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function gradient(c,x,y,x2,y2,stops) {
  const g=c.createLinearGradient(x,y,x2,y2);
  for(const [at,color] of stops)g.addColorStop(at,color);
  return g;
}

export function drawPlaneSky(c,time,reduced) {
  c.fillStyle=gradient(c,0,0,0,1440,[[0,"#17384f"],[.48,"#7195aa"],[.78,"#c6c9c1"],[1,"#f3ddbd"]]);
  c.fillRect(0,0,2560,1440);
  const sun=c.createRadialGradient(2110,310,5,2110,310,650);
  sun.addColorStop(0,"#fff3c340");sun.addColorStop(.2,"#ffe4b016");sun.addColorStop(1,"#ffe4b000");
  c.fillStyle=sun;c.fillRect(1400,0,1160,1050);
  // Broad, layered clouds move independently of the banking airframe.
  for(let layer=0;layer<3;layer++)for(let i=0;i<5;i++) {
    const x=((i*743+layer*271-(reduced?0:time*(22+layer*17)))%3600+3600)%3600-450;
    const y=830+layer*175+(i%3)*61;
    const cloud=c.createLinearGradient(0,y-100,0,y+130);
    cloud.addColorStop(0,layer===2?"#fff4ddc0":"#e4edf270");cloud.addColorStop(1,"#b3c6cf00");
    c.beginPath();c.moveTo(x-400,y+130);
    c.bezierCurveTo(x-440,y-20,x-245,y-10,x-195,y-58);
    c.bezierCurveTo(x-140,y-140,x+5,y-113,x+52,y-55);
    c.bezierCurveTo(x+143,y-83,x+221,y-35,x+245,y+2);
    c.bezierCurveTo(x+385,y-30,x+440,y+75,x+480,y+130);
    c.closePath();c.fillStyle=cloud;c.fill();
  }
  for(let i=0;i<4;i++) {
    const x=((i*883-(reduced?0:time*40))%3400+3400)%3400-420;
    ellipse(c,x,270+i*100,310,5,"#e4f1f016");
  }
}

export function transformPlane(c,age,reduced,flight) {
  const p=planePose(age,reduced,flight);
  c.translate(PLANE.x+p.x,PLANE.y+p.y); c.rotate(p.angle); c.scale(p.scale,p.scale); c.translate(-PLANE.x,-PLANE.y);
}

// Static cabin artwork is cached separately from destructible geometry.
export function drawPlaneInterior(c) {
  const {x,y,innerX:rx,innerY:ry}=PLANE;
  const wall=c.createRadialGradient(x,y-220,20,x,y,rx);
  wall.addColorStop(0,"#344c5b");wall.addColorStop(.58,"#233946");wall.addColorStop(1,"#091923");
  ellipse(c,x,y,rx,ry,wall);
  c.save();c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.clip();
  // Recessed pressure bulkhead and insulation bays echo the fuselage contour.
  ellipse(c,x,y+30,rx*.82,ry*.9,"#152a3680");
  for(let i=0;i<20;i++) {
    const a=i*TAU/20,b=(i+1)*TAU/20;
    c.beginPath();c.moveTo(x+Math.cos(a)*rx*.95,y+Math.sin(a)*ry*.95);
    c.lineTo(x+Math.cos(b)*rx*.95,y+Math.sin(b)*ry*.95);
    c.lineTo(x+Math.cos(b)*rx*.81,y+Math.sin(b)*ry*.82);
    c.lineTo(x+Math.cos(a)*rx*.81,y+Math.sin(a)*ry*.82);c.closePath();
    c.fillStyle=i%2?"#57707a28":"#78828222";c.fill();
    c.strokeStyle="#aec1bc18";c.lineWidth=2;c.stroke();
  }
  for(const factor of [.98,.91,.81]) {
    ring(c,rx*factor,ry*factor,"#07172270",13);
    ring(c,rx*factor-2,ry*factor-2,"#91aaa332",3);
  }
  for(let bx=650;bx<=1910;bx+=210) {
    const rise=Math.sqrt(1-((bx-x)/rx)**2)*ry;
    const top=y-rise+35,bottom=y+rise-35;
    c.fillStyle="#0a202a80";c.fillRect(bx-12,top,24,bottom-top);
    c.fillStyle="#76949d24";c.fillRect(bx-8,top,4,bottom-top);
    for(let by=top+35;by<bottom-35;by+=75) {
      c.fillStyle="#a7b8b63b";c.fillRect(bx-3,by,6,4);
    }
    if(bx>750&&bx<1900)for(const by of [400,690,970]) {
      c.fillStyle="#152d3980";c.beginPath();c.roundRect(bx+26,by,140,100,7);c.fill();
      c.strokeStyle="#8da2a41c";c.lineWidth=2;c.stroke();
      line(c,[[bx+33,by+8],[bx+159,by+8]],"#a4b6b016",2);
      line(c,[[bx+145,by+46],[bx+156,by+46]],"#8caaa149",3);
    }
  }
  c.fillStyle="#10273370";c.beginPath();c.roundRect(1120,540,320,490,26);c.fill();
  c.strokeStyle="#77929625";c.lineWidth=3;c.stroke();
  line(c,[[1280,549],[1280,1020]],"#061b2760",5);
  for(const bx of [1170,1330])for(let by=610;by<700;by+=12)
    line(c,[[bx,by],[bx+65,by]],"#78909224",3);
  for(const bx of [1050,1510]) {
    line(c,[[bx,820],[bx,1080]],"#9b987629",3);
    for(let by=830;by<1080;by+=30)line(c,[[bx-35,by],[bx+35,by]],"#c2b18218",2);
  }
  // Warm overhead light against a quiet cool background keeps fighters legible.
  for(const bx of [930,1280,1630]) {
    const by=bx===1280?218:274;
    const glow=c.createRadialGradient(bx,by,4,bx,by+40,250);
    glow.addColorStop(0,"#ffe0a922");glow.addColorStop(1,"#ffe0a900");
    c.fillStyle=glow;c.fillRect(bx-250,by-160,500,420);
    c.fillStyle="#061822";c.beginPath();c.roundRect(bx-65,by-8,130,18,6);c.fill();
    line(c,[[bx-55,by],[bx+55,by]],"#a19a7e",8);
    line(c,[[bx-52,by-2],[bx+52,by-2]],"#fff1ca",4);
  }
  c.restore();
}

export function drawPlaneHull(c,platforms) {
  const {x,y,rx,ry,innerX,innerY}=PLANE;
  c.save();c.beginPath();
  for(const p of platforms)if(p.planeHull&&p.hp!==0)c.rect(p.x,p.y,p.w,p.h);
  c.clip();
  // Smooth the outer collision steps; surviving strips still remove every hole.
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.clip();
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.ellipse(x,y,innerX,innerY,0,0,TAU);c.clip("evenodd");
  c.fillStyle=gradient(c,x-rx,y-ry,x+rx,y+ry,[[0,"#f3eddb"],[.23,"#c5d2cf"],[.48,"#7d96a3"],[.7,"#d8dfd8"],[1,"#536f80"]]);
  c.fillRect(x-rx,y-ry,rx*2,ry*2);
  ring(c,innerX+8,innerY+8,"#132b38",13);
  ring(c,innerX+16,innerY+16,"#758c95",5);
  ring(c,rx-4,ry-4,"#eef2e480",4);
  ring(c,rx-10,ry-10,"#4b697345",2);
  for(let i=0;i<64;i++) {
    const a=i*TAU/64,ca=Math.cos(a),sa=Math.sin(a);
    line(c,[[x+ca*(innerX+18),y+sa*(innerY+18)],[x+ca*(rx-7),y+sa*(ry-7)]],"#3a566958",1.5);
    for(const inset of [15,28]) {
      const bx=x+Math.cos(a+.009)*(rx-inset),by=y+Math.sin(a+.009)*(ry-inset);
      ellipse(c,bx,by,2.1,2.1,"#354f6180");ellipse(c,bx-.5,by-.7,.9,.9,"#f1edda99");
    }
  }
  for(let by=y-ry+4;by<y+ry;by+=7)line(c,[[x-rx,by],[x+rx,by]],"#ebf4ee0a",1);
  c.restore();
}

export function drawPlanePlatform(c,p) {
  c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
  const wing=!!p.planeWing;
  const top=p.y,height=p.h;
  if(wing) {
    // Broad metallic spars, a rolled leading edge and individual inspection bays.
    // The geometry itself is tapered in three structural sections.
    c.fillStyle="#183a50";c.fillRect(p.x,p.y,p.w,p.h);
  }
  c.fillStyle=gradient(c,0,top,0,top+height,[[0,wing?"#d5ded9":"#95a8ab"],[.18,"#657e88"],[.35,"#344e60"],[1,"#122b3c"]]);
  c.fillRect(p.x,p.y,p.w,p.h);
  line(c,[[p.x,top+1.5],[p.x+p.w,top+1.5]],"#dce7df",3);
  if(wing) {
    line(c,[[p.x,top+height-4],[p.x+p.w,top+height-4]],"#17364b",6);
    line(c,[[p.x,top+height*.38],[p.x+p.w,top+height*.38]],"#b2c5c166",2);
    for(let bx=Math.ceil(p.x/100)*100;bx<p.x+p.w;bx+=100) {
      line(c,[[bx,top+5],[bx+22*p.planeWing,top+height-5]],"#e7eee24a",1);
      ellipse(c,bx+5,top+8,1.6,1.6,"#233f50");
      c.fillStyle="#9db3b52b";c.fillRect(bx+32,top+height*.5,38,Math.max(4,height*.25));
    }
  } else {
    for(let bx=Math.ceil(p.x/18)*18;bx<p.x+p.w;bx+=18) {
      c.fillStyle="#091e2b";c.fillRect(bx,p.y+6,8,Math.max(2,p.h-9));
      c.fillStyle="#799497";c.fillRect(bx+8,p.y+6,2,Math.max(2,p.h-9));
    }
    for(let bx=Math.ceil(p.x/100)*100;bx<p.x+p.w;bx+=100) {
      c.fillStyle="#dac693";c.fillRect(bx,p.y+1,22,2);
    }
  }
  c.restore();
}

export function drawPlaneEngine(c,h,reduced,time=h.age) {
  const r=h.w/2;
  c.save();c.translate(h.bodyX,h.bodyY);
  // Streamlined pylon, rolled intake lip, deep duct and swept fan blades.
  const mount=720-(h.y-30);
  c.beginPath();c.moveTo(-24,-r-12);c.lineTo(-18,mount);
  c.lineTo(19,mount);c.lineTo(37,-r-5);c.closePath();
  c.fillStyle=gradient(c,-30,0,40,0,[[0,"#355369"],[.4,"#b5c6c7"],[.65,"#7e969e"],[1,"#254459"]]);c.fill();
  ellipse(c,0,5,r+24,r+25,"#274456");
  const lip=gradient(c,-r,-r,r,r,[[0,"#fff1d4"],[.2,"#d6e2dc"],[.45,"#8babb6"],[.62,"#45657e"],[.8,"#b6c9cd"],[1,"#eff0db"]]);
  ellipse(c,0,0,r+19,r+19,lip);
  ellipse(c,0,0,r+8,r+8,"#466476");
  ellipse(c,0,0,r+2,r+2,"#081c2a");
  const duct=c.createRadialGradient(-r*.2,-r*.3,10,0,0,r);
  duct.addColorStop(0,"#223c4c");duct.addColorStop(.68,"#172f40");duct.addColorStop(1,"#03111d");
  ellipse(c,0,0,r,r,duct);
  c.save();c.beginPath();c.arc(0,0,r-2,0,TAU);c.clip();
  c.rotate(time*(reduced?.25:3.1)*h.dir);
  const blade=gradient(c,22,-25,r,24,[[0,"#263e4e"],[.35,"#577580"],[.62,"#9caeae"],[.74,"#5f7b89"],[1,"#223b50"]]);
  for(let i=0;i<26;i++) {
    c.rotate(TAU/26);
    c.beginPath();c.moveTo(r*.2,-4);
    c.bezierCurveTo(r*.5,-r*.3,r*.74,-r*.36,r*.98,-r*.15);
    c.lineTo(r*.99,-r*.015);
    c.bezierCurveTo(r*.69,-r*.17,r*.44,-r*.1,r*.21,4);c.closePath();
    c.fillStyle=blade;c.fill();c.strokeStyle="#b3c5c12c";c.lineWidth=1;c.stroke();
  }
  const spinner=c.createRadialGradient(-8,-10,1,0,0,r*.26);
  spinner.addColorStop(0,"#c8d4cd");spinner.addColorStop(.3,"#7995a1");spinner.addColorStop(1,"#142e40");
  ellipse(c,0,0,r*.26,r*.26,spinner);
  c.beginPath();c.moveTo(-3,0);c.bezierCurveTo(-11,-11,13,-19,17,-4);c.bezierCurveTo(21,9,4,19,-11,12);
  c.strokeStyle="#f5eccd";c.lineWidth=3;c.stroke();
  c.restore();
  c.beginPath();c.arc(0,0,r+14,Math.PI*1.07,Math.PI*1.83);
  c.strokeStyle="#fff4d28c";c.lineWidth=3;c.stroke();
  c.restore();
}

export function drawPlaneOutflows(c,state,time,reduced) {
  const breaches=cachedPlaneBreaches(state.platforms);
  for(const b of breaches) {
    c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.ny,b.nx));
    for(let i=0;i<18;i++) {
      const flow=reduced?.5:((time*1.8+i*.137)%1);
      const x=-380+flow*720,spread=(i-8.5)/8.5;
      const width=b.width*.32+Math.abs(x)*.18;
      line(c,[[x-55,spread*(width+12)],[x,spread*width]],x<0?"#d5f6ff55":"#ecfcffbb",i%3?2:4);
    }
    c.restore();
  }
}

// One cache per renderer: thousands of hull drawing calls become one texture
// draw. Damage rebuilds it from the exact surviving geometry, including hot joins.
export class PlaneHullLayer {
  draw(c,platforms,create=()=>document.createElement("canvas")) {
    const key=planeHullKey(platforms);
    if(!this.canvas)this.canvas=create();
    if(this.key!==key) {
      this.canvas.width=1680;this.canvas.height=1210;
      const layer=this.canvas.getContext("2d");layer.translate(-440,-105);
      drawPlaneHull(layer,platforms);this.key=key;
    }
    c.drawImage(this.canvas,440,105);
  }
}
