import { LINE_Y, LINE_SPEED, STATIONS } from "./assembly-arena.js";
import { robotPose, CAR_BODY, CAR_CABIN, PRESS_HALF_HEIGHT, steamStrength, welding, smooth, carHeight, PART, CAR_COLORS, wheelSupply, wheelHeld, paintStrength } from "./assembly-geometry.js";

const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
const path = (c, points, color, width = 4) => {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
  c.strokeStyle = color; c.lineWidth = width; c.lineJoin = "round"; c.stroke();
};
const disc = (c, x, y, r, color) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); };
function label(c, text, x, y, size = 22, color = "#a9c0c8") {
  c.font = `600 ${size}px "Barlow Condensed", sans-serif`; c.textAlign = "center"; c.fillStyle = color; c.fillText(text, x, y);
}
function stripes(c, x, y, w, h) {
  rect(c, x, y, w, h, "#e1ad48"); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let n = x - 30; n < x + w; n += 32) path(c, [{ x: n, y: y + h }, { x: n + 20, y }], "#29333a", 15);
  c.restore();
}

export function drawAssemblyHall(c) {
  rect(c, 0, 0, 2560, 1440, "#172630");
  const wash = c.createLinearGradient(0, 0, 0, 1300);
  wash.addColorStop(0, "#263e4b"); wash.addColorStop(1, "#111e28"); c.fillStyle = wash; c.fillRect(0, 0, 2560, 1440);
  for (let x = 40; x < 2560; x += 320) {
    rect(c, x, 110, 250, 160, "#354f5a"); rect(c, x + 6, 116, 238, 148, "#49616a");
    for (let i = 1; i < 4; i++) rect(c, x + i * 62, 115, 5, 150, "#293e48");
    rect(c, x, 184, 250, 5, "#293e48");
    rect(c, x + 273, 0, 18, 1290, "#30434c");
    path(c, [{ x: x + 275, y: 295 }, { x: x + 45, y: 420 }, { x: x + 275, y: 570 }], "#2b414b", 7);
  }
  for (const y of [305, 350]) { rect(c, 0, y, 2560, 13, "#10202b"); rect(c, 0, y, 2560, 3, "#56616a"); }
  for (let x = 150; x < 2560; x += 550) {
    path(c, [{ x, y: 0 }, { x, y: 340 }], "#101e28", 5);
    rect(c, x - 95, 337, 190, 20, "#526975"); rect(c, x - 80, 357, 160, 7, "#d5ded0");
    c.fillStyle = "#d8e4cb05"; c.beginPath(); c.moveTo(x - 75, 364); c.lineTo(x - 220, 1180); c.lineTo(x + 220, 1180); c.lineTo(x + 75, 364); c.fill();
  }
  // Rear safety fencing and supply racks are scenery, behind playable surfaces.
  for (let x = 0; x < 2560; x += 40) path(c, [{ x, y: 880 }, { x, y: 1160 }], "#33434c", 2);
  for (let y = 880; y < 1160; y += 40) rect(c, 0, y, 2560, 1, "#33434c");
  for (const x of [300, 920, 1510, 2130]) {
    rect(c, x - 40, 1285, 80, 155, "#223640");
    for (let y = 1300; y < 1440; y += 30) rect(c, x - 34, y, 68, 8, "#4a5356");
  }

}

function polygon(c, points, color, stroke = null, width = 2) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = color; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function shell(c, x, dy, painted, color) {
  c.save(); c.translate(x, dy);
  polygon(c, CAR_CABIN, painted ? color : "#879da5", "#dae0d9", 3);
  polygon(c, [[-66,1114],[-37,1063],[-7,1063],[-7,1114]], painted ? "#24414e" : "#182b35");
  polygon(c, [[2,1063],[26,1063],[72,1114],[2,1114]], painted ? "#315564" : "#182b35");
  if (painted) {
    polygon(c, [[7,1066],[23,1066],[58,1105],[45,1105]], "#b2e2df60");
    path(c, [{x:-58,y:1104},{x:-36,y:1066}], "#aadbd36b", 4);
  } else {
    path(c, [{x:-61,y:1116},{x:-6,y:1061},{x:59,y:1116}], "#b1b9b3", 3);
  }
  c.restore();
}
function wheel(c, x, y) {
  disc(c, x, y, 23, "#0a131b"); disc(c, x, y, 19, "#202e38");
  disc(c, x, y, 14, "#b6c1c3"); disc(c, x, y, 10, "#455b68");
  for (let i=0;i<5;i++) { const a=i*Math.PI*2/5;
    path(c,[{x:x+Math.cos(a)*4,y:y+Math.sin(a)*4},{x:x+Math.cos(a)*12,y:y+Math.sin(a)*12}],"#dde2dc",3);
  }
  disc(c,x,y,4,"#869b9f");
}
function carArt(c, car, painted = false) {
  const x=car.x, color=CAR_COLORS[car.id%4];
  const steel=c.createLinearGradient(0,1120,0,1176);
  steel.addColorStop(0,painted?color:"#c0ccca"); steel.addColorStop(.4,painted?color:"#8fa3ac"); steel.addColorStop(1,"#344e5c");
  rect(c,x-125,1158,250,18,"#627b88"); rect(c,x-125,1170,250,6,"#263e4b");
  for(let u=-112;u<120;u+=28){rect(c,x+u,1160,13,6,"#aebdbb");disc(c,x+u+6,1163,2,"#364e5a");}
  if(car.stage&PART.BODY){
    c.save();c.translate(x,0);polygon(c,CAR_BODY,steel,"#263d49",2);c.restore();
    path(c,[{x:x-108,y:1122},{x:x+79,y:1122},{x:x+113,y:1132}],"#e8edda",3);
    path(c,[{x:x-108,y:1138},{x:x+110,y:1138}],painted?"#ffffff35":"#5e7988",2);
    for(const axle of [-81,81]) {disc(c,x+axle,1166,26,"#243945");disc(c,x+axle,1166,21,"#10232f");}
    rect(c,x-118,1154,236,4,"#344c5a");
    path(c,[{x:x-7,y:1122},{x:x-7,y:1152},{x:x+45,y:1152},{x:x+55,y:1145},{x:x+55,y:1122}],"#435c69",2);
    rect(c,x+3,1128,13,3,"#d5dfd9");
    if(painted){rect(c,x-121,1140,7,10,"#f47258");rect(c,x+116,1140,7,10,"#f6ecd0");rect(c,x+118,1153,7,5,"#b9cccb");}
    else for(const u of [-50,25])path(c,[{x:x+u,y:1143},{x:x+u+19,y:1143}],"#b4c4c6",3);
  }
  if(car.stage&PART.CABIN)shell(c,x,0,painted,color);
  if(car.stage&PART.CABIN && !(car.stage&PART.BODY)){
    path(c,[{x:x-76,y:1120},{x:x-76,y:1158},{x:x+86,y:1158},{x:x+86,y:1120}],painted?color:'#859da6',7);
  }
  for(const [offset,part] of [[-81,PART.REAR],[81,PART.FRONT]])if(car.stage&part)wheel(c,x+offset,1167);
}
export function drawCarProp(c,b){
  if(b.hp<=0)return;
  const stage=b.carStage??0,height=carHeight(stage);
  c.save();c.translate(b.x,b.y);c.scale(b.w/250,b.h/height);c.translate(125,height-1190);
  const car={x:0,id:b.carPaint??0,stage};
  carArt(c,car);
  const coat=b.carCoat??(stage&PART.PAINT?1:0);
  if(coat>0){
    c.save();c.beginPath();c.rect(-126,1048,252*coat,145);c.clip();carArt(c,car,true);c.restore();
  }
  if(!(stage&(PART.REAR|PART.FRONT))){rect(c,-110,1174,220,9,'#344b59');rect(c,-107,1183,214,7,'#142d3a');}
  if(b.hp<b.maxHp){
    c.globalAlpha=Math.min(.85,(1-b.hp/b.maxHp)*1.5);
    for(const x of [-70,18,80])path(c,[{x,y:stage>0?1130:1160},{x:x-9,y:1148},{x:x+12,y:1163}],"#152a36",3);
  }
  c.restore();
}
function stackLight(c,h,clock,reduced){
  const x=h.x+(h.assemblyStation===1?115:102), y=h.assemblyStation===1?682:h.assemblyStation===4?713:775;
  const fault=!['none','empty'].includes(h.assemblyFault), amber=h.warning>0||h.assemblyFault==='empty';
  const colors=['#f45f48','#ffc15b','#79d4ac'];
  const selected=fault||h.active?0:amber?1:2;
  rect(c,x-3,y+55,6,25,"#81999e");rect(c,x-12,y-3,24,60,"#182b36");
  for(let i=0;i<3;i++){
    const lit=i===selected&&(!fault||reduced||Math.sin(clock*9)>-.25);
    rect(c,x-9,y+i*18,18,14,lit?colors[i]:['#593c39','#635640','#314b47'][i]);
    if(lit){c.save();c.globalAlpha=.18;disc(c,x,y+i*18+7,26,colors[i]);c.restore();}
  }
  if(fault)label(c,({broken:'OFFLINE'})[h.assemblyFault],h.x,h.assemblyStation===1?815:916,17,fault?'#f18c72':'#d4ad69');
}
function steam(c,h,phase,clock){
  const strength=steamStrength(h,phase);if(strength<=0)return;
  for(let side=0;side<2;side++){
    const dir=side?1:-1, origin=h.x+dir*139;
    for(let i=0;i<15;i++){
      const t=(clock*1.5+i/15)%1, spread=12+t*24;
      const x=origin+dir*(9+t*86),y=1110-t*50+Math.sin(i*2.7)*spread;
      const r=17+t*29, puff=c.createRadialGradient(x,y,0,x,y,r);
      puff.addColorStop(0,'#e0eceb8c');puff.addColorStop(.5,'#bbcfd05c');puff.addColorStop(1,'#91afb700');
      c.save();c.globalAlpha=strength*(1-t)*.55;c.fillStyle=puff;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
    }
    c.save();c.globalAlpha=strength*.55;
    path(c,[{x:origin,y:1109},{x:origin+dir*42,y:1104}],"#d9efed",5);c.restore();
  }
}

// Access decks have visible hangers and rear rails, while gaps remain jumpable.
// Their detail follows surviving platform pieces, never bridging a blasted gap.
function maintenance(c,state){
  for(const p of state.platforms.filter(p=>p.assemblyMount&&p.hp!==0&&!p.wreckId)){
    c.save();c.beginPath();c.rect(p.x,589,p.w,p.y+p.h-589);c.clip();
    for(let x=(p.baseX??p.x)+30;x<p.x+p.w;x+=150){
      path(c,[{x,y:589},{x,y:p.y}],"#293f4a",13);
      path(c,[{x:x-4,y:589},{x:x-4,y:p.y}],"#59727d",3);
      rect(c,x-12,p.y-26,24,26,"#304c5a");
      for(const y of [p.y-19,p.y-7])disc(c,x,y,3,"#899d9f");
    }
    c.restore();
  }
  for(const p of state.platforms.filter(p=>p.oneWay&&p.hp!==0&&!p.wreckId)){
    c.save();c.beginPath();c.rect(p.x,p.y-210,p.w,255);c.clip();
    if(p.y===565){
      for(let x=p.baseX??p.x;x<p.x+p.w;x+=180){
        path(c,[{x:x+20,y:355},{x:x+20,y:p.y+19}],"#1d333f",9);
        path(c,[{x:x+20,y:355},{x:x+20,y:p.y+19}],"#68828a",3);
        rect(c,x+11,p.y-5,18,23,"#92a3a1");
      }
    }else{
      path(c,[{x:p.x+15,y:p.y+22},{x:p.x+p.w/2,y:p.y+42},{x:p.x+p.w-15,y:p.y+22}],"#58727d",5);
    }
    for(let x=p.x+12;x<p.x+p.w;x+=70){
      path(c,[{x,y:p.y},{x,y:p.y-55}],"#526f7a",4);
      rect(c,x-3,p.y-58,6,6,"#b2beb5");
    }
    path(c,[{x:p.x,y:p.y-56},{x:p.x+p.w,y:p.y-56}],"#839b9e",4);
    path(c,[{x:p.x,y:p.y-29},{x:p.x+p.w,y:p.y-29}],"#405e6b",3);
    rect(c,p.x,p.y+p.h-4,p.w,4,"#c49c52");c.restore();
  }
}

function wheelRack(c,h,clock){
  const supply=wheelSupply(h),x=supply.x;
  // A rear magazine drops its remaining wheels down after each pickup.
  rect(c,x-62,915,124,240,"#172f3d");
  for(const u of [-61,61]){rect(c,x+u-5,909,10,266,"#506d79");rect(c,x+u-8,1160,16,14,"#96aaa9");}
  rect(c,x-63,914,126,8,"#8d9991");rect(c,x-56,1140,112,14,"#2c4c5c");
  for(let row=0;row<4;row++){
    const a=h.assemblyPhase,feeding=h.assemblyWork&&h.assemblyFault==='none';
    const t=feeding?Math.max(0,Math.min(1,(a-(a<2?1.12:2.14))/.3)):0;
    const y=1012-row*48+t*48;
    if(y<=1013)wheel(c,x,y);
  }
  path(c,[{x:x-34,y:1018},{x:x-34,y:1048},{x:x+34,y:1048},{x:x+34,y:1018}],"#829599",6);
  rect(c,x-43,1049,86,16,"#a67c40");
  rect(c,x-47,1084,94,33,"#284753");label(c,"WHEELS",x,1107,17,"#a2b6b8");
  for(const u of [-38,38])disc(c,x+u,1130,4,"#b0bdb5");
}

function paintBooth(c,h,clock,front){
  const x=h.x,phase=h.assemblyPhase,strength=paintStrength(h,phase);
  const color=CAR_COLORS[h.assemblyWork%4];
  if(!front){
    const inner=c.createLinearGradient(x-200,0,x+200,0);
    inner.addColorStop(0,"#253e49");inner.addColorStop(.5,"#48626a");inner.addColorStop(1,"#203844");
    rect(c,x-205,820,410,365,inner);
    for(let u=-180;u<=180;u+=60){rect(c,x+u,835,2,300,"#758a893d");}
    for(let y=850;y<1000;y+=16){rect(c,x-168,y,336,3,"#263f48");}
    // Filter plenum, extraction ducts, gauges and pressure-fed colour pots.
    rect(c,x-182,825,364,17,"#8baba9");
    for(const side of [-1,1]){
      const px=x+side*184;
      path(c,[{x:px,y:784},{x:px,y:725},{x:px+side*40,y:701}],"#172e3c",30);
      path(c,[{x:px,y:784},{x:px,y:725},{x:px+side*40,y:701}],"#5c7882",21);
      for(let y=726;y<780;y+=14)rect(c,px-13,y,26,4,"#90a19e");
      rect(c,px-9,874,18,275,"#182f3d");rect(c,px-3,880,5,255,"#95adb0");
    }
    for(let i=0;i<4;i++){
      const px=x-102+i*68;
      rect(c,px-21,938,42,66,"#142e3a");rect(c,px-18,942,36,50,CAR_COLORS[i]);
      rect(c,px-21,937,42,7,"#a3b5b3");rect(c,px-4,925,8,12,"#7b9299");
      path(c,[{x:px,y:925},{x:px,y:899},{x:x-166,y:899},{x:x-166,y:1060}],"#1b303c",5);
      disc(c,px,958,9,"#d0dad0");path(c,[{x:px,y:958},{x:px+3,y:952}],"#20333c",2);
    }
    for(const side of [-1,1]){
      const px=x+side*164;
      rect(c,px-10,1007,20,167,"#315664");
      for(let y=1020;y<1180;y+=45){
        rect(c,px+(side<0?0:-17),y,17,9,"#b8c8be");
      }
    }
    return;
  }
  if(strength>0){
    // Narrow opposing fan jets leave the car and fighter silhouettes readable.
    c.save();c.globalAlpha=strength;
    for(const side of [-1,1])for(let nozzle=0;nozzle<4;nozzle++){
      const px=x+side*157,py=1027+nozzle*44;
      const mist=c.createLinearGradient(px,py,px-side*135,py);
      mist.addColorStop(0,color+'80');mist.addColorStop(.35,color+'38');mist.addColorStop(1,color+'00');
      polygon(c,[[px,py-3],[px-side*148,py-42],[px-side*148,py+42],[px,py+3]],mist);
      for(let i=0;i<7;i++){
        const t=(clock*2.7+i/7+nozzle*.13)%1;
        disc(c,px-side*t*137,py+Math.sin(i*7+nozzle)*t*36,1+t*2,"#d1e5d353");
      }
    }
    c.restore();
  }
  // An open-ended booth: translucent rear glass, no imaginary front wall.
  for(const side of [-1,1]){
    rect(c,x+side*199-6,820,12,363,"#6f8a90");
    rect(c,x+side*199-2,822,3,361,"#baccc3");
    rect(c,x+side*173-5,854,10,65,strength>0?"#dfedd9":"#9fb5b0");
  }
  rect(c,x-199,821,398,10,"#173443");
  rect(c,x-198,1168,396,7,"#708889");
}

export function drawAssembly(c, state, reduced = false) {
  if (!state.assembly) return;
  const { clock, completed, cars } = state.assembly;
  maintenance(c,state);
  for (const [i, name] of ["STAMPING", "BODY WELD", "WHEEL FITTING", "PAINT"].entries()) {
    rect(c, STATIONS[i] - 110, 630, 220, 42, "#0e1c26"); label(c, name, STATIONS[i], 660, 23);
  }
  for(const h of state.hazards.filter(h=>h.assemblyStation&&!h.done)){
    if(h.assemblyStation===3)wheelRack(c,h,clock);
    if(h.assemblyStation===4)paintBooth(c,h,clock,false);
  }
  const travel = clock * LINE_SPEED;
  for (const b of state.platforms.filter(p => p.assemblyBelt && p.hp !== 0 && !p.wreckId)) {
    c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
    rect(c, b.x, b.y, b.w, b.h, "#344956");
    for (let x = Math.floor((b.x - travel) / 25) * 25 + travel; x < b.x + b.w + 25; x += 25) {
      rect(c, x, LINE_Y, 3, 13, "#9aadac"); disc(c, x, LINE_Y + 26, 8, "#122733"); disc(c, x, LINE_Y + 26, 3, "#82969d");
    }
    rect(c, b.x, LINE_Y + 13, b.w, 4, "#c49c52"); c.restore();
  }
  for(const h of state.hazards.filter(h=>h.assemblyStation&&!h.done)){
    if(!h.active&&!h.warning&&h.assemblyFault==='none')continue;
    const warning=h.warning>0||h.assemblyFault==='empty';
    const glow=c.createRadialGradient(h.x,1190,5,h.x,1190,195);
    glow.addColorStop(0,warning?'#f6b64220':'#ed594222');glow.addColorStop(1,'#ed594200');
    c.fillStyle=glow;c.fillRect(h.x-195,995,390,230);
  }
  for(const b of state.cover.filter(b=>b.kind==='car'&&b.hp>0)){
    c.save();c.translate(b.x+b.w/2,b.y+b.h/2);c.rotate(b.angle||0);c.translate(-b.x-b.w/2,-b.y-b.h/2);
    drawCarProp(c,b);c.restore();
  }
  for (const h of state.hazards.filter(h => h.assemblyStation)) {
    const phase=h.assemblyPhase;
    // Indicators remain on surviving control feeds; broken machinery never regrows.
    if(state.platforms.some(p=>p.assemblyMount===h.assemblyStation&&p.hp!==0))stackLight(c,h,clock,reduced);
    if(h.done)continue;
    if (h.assemblyStation === 1) {
      for(const side of [-1,1]){
        const x=h.x+side*92;
        rect(c,x-25,788,50,104,"#203844");rect(c,x-19,793,38,90,"#496b78");
        rect(c,x-11,810,22,h.bodyY-PRESS_HALF_HEIGHT-810,"#8ca5ad");
        rect(c,x-6,810,6,h.bodyY-PRESS_HALF_HEIGHT-810,"#dae4dd");
        rect(c,x-29,874,58,12,"#182f3c");
      }
      c.save(); c.beginPath(); for (const p of state.platforms.filter(p => p.assemblyHead && p.hp !== 0)) c.rect(p.x,p.y,p.w,p.h);c.clip();
      const top=h.bodyY-PRESS_HALF_HEIGHT;
      rect(c,h.x-140,top,280,76,"#344d59");rect(c,h.x-135,top+5,270,41,"#6d8893");
      stripes(c,h.x-140,top,280,16);rect(c,h.x-133,top+57,266,15,"#c2d0ce");
      rect(c,h.x-132,top+72,264,4,"#142b38");
      for(const u of [-117,-45,45,117]){disc(c,h.x+u,top+36,7,"#283e49");disc(c,h.x+u,top+36,3,"#a6b8b9");}
      label(c,"80 t",h.x,top+44,21,"#d8e0d5");c.restore();
      steam(c,h,phase,clock);
    } else if(h.assemblyStation===4){
      paintBooth(c,h,clock,true);
    } else {
      const pose=robotPose(h,phase),tip=pose[2],base=pose[0];
      rect(c,base.x-37,866,74,19,"#182f3c");rect(c,base.x-27,866,54,12,"#6d8793");
      // Heavy cast links and a hose follow the same fixed-length joints as collision.
      path(c,pose,"#122632",40);path(c,pose,"#b87330",31);
      path(c,pose.map(p=>({x:p.x-3,y:p.y-4})),"#edb464",12);
      path(c,pose.map(p=>({x:p.x+9,y:p.y+5})),"#35434a",5);
      for(const p of pose.slice(0,2)){
        disc(c,p.x,p.y,25,"#203947");disc(c,p.x,p.y,18,"#97a7a8");disc(c,p.x,p.y,11,"#3c5766");disc(c,p.x,p.y,5,"#c8d1c6");
      }
      const record=cars.find(car=>car.id===h.assemblyWork);
      const body=record&&state.cover.find(b=>b.id==='car'+record.id&&b.hp>0);
      const work=body&&{...record,x:body.x+body.w/2};
      const operating=work&&h.assemblyFault==='none'&&phase>=1&&phase<2.95;
      if(operating&&h.assemblyStation===2&&!(work.stage&PART.CABIN)){
        shell(c,work.x,-55*(1-smooth((phase-1)/.3)),false,"#91a4aa");
      }
      if(h.assemblyStation===2){
        path(c,[{x:tip.x,y:tip.y-17},{x:tip.x,y:tip.y}],"#19303e",13);
        path(c,[{x:tip.x,y:tip.y-8},{x:tip.x,y:tip.y+3}],"#c8b393",5);
      }else{
        if(operating&&wheelHeld(phase)&&!(work.stage&(phase<2?PART.FRONT:PART.REAR)))wheel(c,tip.x,tip.y);
        path(c,[{x:tip.x-22,y:tip.y+12},{x:tip.x-27,y:tip.y-18},{x:tip.x+27,y:tip.y-18},{x:tip.x+22,y:tip.y+12}],"#172d39",10);
        path(c,[{x:tip.x-22,y:tip.y+12},{x:tip.x-27,y:tip.y-18},{x:tip.x+27,y:tip.y-18},{x:tip.x+22,y:tip.y+12}],"#daa254",5);
      }
      if(welding(h,phase)&&work){
        const glow=c.createRadialGradient(tip.x,tip.y,1,tip.x,tip.y,95);
        glow.addColorStop(0,"#d5f8ffad");glow.addColorStop(.12,"#95d7ff3b");glow.addColorStop(1,"#78beff00");
        c.fillStyle=glow;c.fillRect(tip.x-95,tip.y-95,190,190);disc(c,tip.x,tip.y,5,"#ffffff");
        for(let i=0;i<14;i++){
          const t=(clock*2+i/14)%1,a=i*2.4,len=12+t*70;
          path(c,[{x:tip.x+Math.cos(a)*len*.7,y:tip.y+Math.sin(a)*len*.7+t*t*30},
            {x:tip.x+Math.cos(a)*len,y:tip.y+Math.sin(a)*len+t*t*40}],i%3?'#f6cb79':'#d6faff',2*(1-t)+.5);
        }
      }
    }
  }
  rect(c, 2035, 851, 170, 59, "#10212a");
  label(c, `BUILT ${completed}`, 2120, 875, 22, "#95d4b7");
  const fault = state.hazards.some(h=>h.assemblyStation&&h.assemblyFault==='broken');
  label(c, fault ? "STATION OFFLINE" : "CONVEYOR RUNNING", 2120, 899, 15, fault ? "#f48d73" : "#a9c0c8");
}
