import { carWashPhase, carWashFixtures } from './compact-setpieces.js';
const line=(c,ps,color,width=3)=>{c.beginPath();ps.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();};
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
const oval=(c,x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();};
function panel(c,x,y,w,h,color,r=12){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=color;c.fill();}
function bolts(c,x,y,w){for(const bx of [x+12,x+w-12]){circle(c,bx,y,4,'#132e39');line(c,[[bx-2,y-1],[bx+2,y+1]],'#c6dcda',1);}}

function carWashHall(c){
  const wall=c.createLinearGradient(0,0,0,1160);
  wall.addColorStop(0,'#102a38');wall.addColorStop(.42,'#28545f');wall.addColorStop(1,'#628c90');rect(c,0,0,2560,1440,wall);
  // A continuous glazed clerestory and roof frame unify the building.
  for(let x=115;x<2490;x+=465){
    panel(c,x,58,370,252,'#0c222e',8);
    const glass=c.createLinearGradient(x,60,x+360,305);glass.addColorStop(0,'#548c97');glass.addColorStop(1,'#254b5c');rect(c,x+12,70,346,225,glass);
    for(let n=1;n<4;n++)line(c,[[x+n*90,70],[x+n*90,300]],'#173845',9);
    line(c,[[x+12,182],[x+358,182]],'#173845',8);line(c,[[x+24,84],[x+143,285]],'#b9e6df1b',17);
  }
  rect(c,0,545,2560,605,'#83a8a7');
  for(let y=548;y<1140;y+=74){
    line(c,[[0,y],[2560,y]],'#476e763b',2);
    for(let x=(Math.floor(y/74)%2)*64;x<2560;x+=128)line(c,[[x,y],[x,y+74]],'#476e7633',2);
  }
  rect(c,0,552,2560,18,'#d7ddd0');rect(c,0,574,2560,9,'#d88374');rect(c,0,1110,2560,42,'#35666e');
  for(const x of [30,500,1000,1510,2020,2500]){
    rect(c,x,0,24,1150,'#1c424e');rect(c,x+3,0,5,1150,'#527e84');for(const y of [332,526,1090])bolts(c,x-4,y,32);
  }
  for(const y of [26,330]){rect(c,0,y,2560,26,'#122c39');line(c,[[0,y+27],[2560,y+27]],'#729593',4);}
  for(const x of [120,650,1175,1700,2230]){
    panel(c,x-8,350,228,22,'#16313d',5);panel(c,x,355,212,8,'#daf8eb',3);
    const light=c.createLinearGradient(0,366,0,535);light.addColorStop(0,'#bcead31c');light.addColorStop(1,'#bcead300');rect(c,x-35,368,280,165,light);
  }
  // Services follow the perimeter, away from the playable route silhouettes.
  line(c,[[68,520],[68,385],[2476,385],[2476,1040]],'#102d38',21);line(c,[[68,520],[68,385],[2476,385],[2476,1040]],'#669e9f',11);
  for(const x of [100,520,1010,1510,2020,2465])circle(c,x,385,9,'#b2c9bf');
  for(const x of [83,2378]){
    panel(c,x,965,96,136,'#284b58',8);panel(c,x+9,975,78,111,'#5c8188',4);
    for(let y=992;y<1050;y+=12)rect(c,x+21,y,54,4,'#284b58');circle(c,x+70,1072,5,'#e0b16b');
  }
  // The pit is scenery; only surviving floor tiles own collision.
  rect(c,0,1210,2560,230,'#102630');
  for(let x=35;x<2560;x+=160){line(c,[[x,1230],[x+75,1370],[x+150,1230]],'#294a56',8);circle(c,x+75,1370,7,'#516a70');}
  line(c,[[0,1402],[2560,1402]],'#244c59',22);
}
export function drawCompactSetpieceHall(c,arena){if(arena.compactSetpiece==='car-wash')carWashHall(c);}

// Follow surviving collision pieces, including cuts received by hot-joining guests.
export function drawCarWashStructure(c,state){
  for(const p of state.platforms){
    if(p.hp===0||p.wreckId)continue;
    if(p.oneWay){
      c.save();c.beginPath();c.rect(p.x,32,p.w,p.y+p.h+45-32);c.clip();
      if(p.y<500)for(let x=(p.baseX??p.x)+22;x<p.x+p.w;x+=170){line(c,[[x,32],[x,p.y+10]],'#17333e',10);line(c,[[x-2,32],[x-2,p.y+10]],'#91aca9',3);}
      for(let x=p.x+15;x<p.x+p.w;x+=72)line(c,[[x,p.y-52],[x,p.y]],'#38626b',4);
      line(c,[[p.x,p.y-52],[p.x+p.w,p.y-52]],'#a1c2ba',4);line(c,[[p.x,p.y-26],[p.x+p.w,p.y-26]],'#567f83',2);
      rect(c,p.x,p.y,p.w,p.h,'#25434f');rect(c,p.x,p.y,p.w,4,'#e1e5cf');
      for(let x=p.x+7;x<p.x+p.w;x+=16)rect(c,x,p.y+6,5,7,'#779b9e');
      rect(c,p.x,p.y+p.h-3,p.w,3,'#e2ab64');line(c,[[p.x+10,p.y+19],[p.x+p.w/2,p.y+43],[p.x+p.w-10,p.y+19]],'#355c65',7);c.restore();
    }else if(p.washFloor){
      c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();rect(c,p.x,p.y,p.w,p.h,'#274852');
      for(let x=Math.floor(p.x/34)*34;x<p.x+p.w;x+=34){rect(c,x,p.y+5,27,p.h-10,'#658d92');rect(c,x+2,p.y+7,3,p.h-14,'#9fc8c6');}
      rect(c,p.x,p.y,p.w,4,'#d2efdf');rect(c,p.x,p.y+p.h-6,p.w,6,'#172f3b');c.restore();
    }
  }
}
function brush(c,x,age,direction,reduced){
  const t=reduced?0:age*4.5*direction;
  // Vertical rotary cloth cylinder, bounded by its actual striking column.
  line(c,[[x,816],[x,1137]],'#294858',16);oval(c,x,851,82,20,'#223e4b');
  const cloth=c.createLinearGradient(x-78,0,x+78,0);cloth.addColorStop(0,'#793f63');cloth.addColorStop(.45,'#d86e88');cloth.addColorStop(1,'#944965');
  panel(c,x-78,853,156,286,cloth,18);
  for(let i=0;i<15;i++){
    const a=i*Math.PI*2/15+t;if(Math.cos(a)<-.25)continue;const sx=x+Math.sin(a)*69;
    line(c,[[sx,852],[sx+Math.sin(a+1)*9,936],[sx-Math.sin(a+.4)*10,1050],[sx+Math.sin(a+2)*11,1145]],i%3===0?'#ffae9e':i%3===1?'#d65370':'#ed7d8c',12);
    line(c,[[sx-2,866],[sx+Math.sin(a+1)*7-2,930]],'#ffd2ba66',3);
  }
  oval(c,x,848,83,16,'#f39794');oval(c,x,845,54,9,'#cb6278');panel(c,x-41,811,82,28,'#214650',8);bolts(c,x-41,825,82);
  for(let i=0;i<8;i++)oval(c,x-74+i*21,1150-(i%3)*5,13,5,'#cce6dd80');
}
function fan(c,x,y,age,active,reduced){
  circle(c,x,y,68,'#132f3d');circle(c,x,y,59,'#365d69');c.save();c.translate(x,y);c.rotate(reduced?0:age*(active?14:2));
  for(let i=0;i<6;i++){c.rotate(Math.PI/3);c.beginPath();c.moveTo(9,4);c.bezierCurveTo(31,-24,59,-11,51,18);c.lineTo(13,15);c.closePath();c.fillStyle=i%2?'#96b4b3':'#698f94';c.fill();}
  c.restore();circle(c,x,y,13,'#d4dccc');circle(c,x,y,5,'#2c5261');for(let n=-2;n<=2;n++)line(c,[[x-55,y+n*19],[x+55,y+n*19]],'#173d4966',3);
}
export function drawCarWash(c,h,time,layer,reduced=false,platforms=null){
  const phase=carWashPhase(h.age),age=reduced?0:h.age;
  const fixtures=platforms?carWashFixtures(platforms):{brushes:[770,1580],rinse:true,dryer:true};
  phase.rinse &&= fixtures.rinse;phase.rinseWarning &&= fixtures.rinse;
  phase.dryer &&= fixtures.dryer;phase.dryerWarning &&= fixtures.dryer;
  if(layer==='front'){
    if(phase.rinse)for(let i=0;i<23;i++){const x=1020+i*18,y=795+((age*680+i*63)%348);line(c,[[x,y],[x+3,y+14]],'#efffffa6',2);oval(c,x,1153,10+(i%3)*3,3,'#e4fff18a');}return;
  }
  for(const x of fixtures.brushes){
    for(const side of [-1,1]){const sx=x+side*147;panel(c,sx-14,820,28,333,'#386d73',6);rect(c,sx-7,833,5,296,'#8cb9b2');panel(c,sx-23,1124,46,30,'#254854',5);}
    panel(c,x-180,817,360,26,'#28626c',7);bolts(c,x-180,830,360);brush(c,x,age,x===770?1:-1,reduced);
  }
  if(fixtures.rinse){
  line(c,[[1070,672],[1070,710],[1428,710],[1428,754]],'#1f5360',24);line(c,[[1070,672],[1070,710],[1428,710],[1428,754]],'#99c4bd',12);
  panel(c,998,733,454,31,'#24747e',7);bolts(c,998,746,454);
  for(const x of [1034,1089,1144,1199,1254,1309,1364,1419]){
    panel(c,x-8,761,16,19,'#dce1ca',3);circle(c,x,781,6,phase.rinse?'#ddffff':phase.rinseWarning?'#ffc977':'#477880');
    if(phase.rinse){
      const glow=c.createLinearGradient(x,780,x,1158);glow.addColorStop(0,'#dafaff50');glow.addColorStop(1,'#a8e9ef0a');
      c.beginPath();c.moveTo(x-3,783);c.lineTo(x-24,1155);c.lineTo(x+24,1155);c.lineTo(x+3,783);c.fillStyle=glow;c.fill();
      for(let j=0;j<3;j++)line(c,[[x+(j-1)*3,786],[x+(j-1)*18+Math.sin(age*15+x)*4,1149]],'#d6f7f052',2);
    }
  }
  }
  // Left-facing vents match the opposing air-force footprint.
  if(fixtures.dryer){
  panel(c,2320,706,193,380,'#173b4c',18);panel(c,2330,715,172,357,'#debb87',12);panel(c,2342,727,148,310,'#447883',10);
  fan(c,2416,804,age,phase.dryer,reduced);fan(c,2416,958,age,phase.dryer,reduced);panel(c,2284,774,49,253,'#1a4758',10);
  for(let y=789;y<1020;y+=31)line(c,[[2289,y],[2318,y-5]],'#87b7b7',8);
  circle(c,2416,1053,9,phase.dryer?'#bcebc4':phase.dryerWarning?'#ffce77':'#626d62');
  if(phase.dryer)for(let i=0;i<17;i++){const u=(age*1.8+i*.13)%1,x=2295-u*474,y=742+i*23;line(c,[[x,y],[x-38-u*50,y+Math.sin(i+age*3)*7]],`rgba(228,255,242,${.48*(1-u)})`,2+i%2);}
  }
}
