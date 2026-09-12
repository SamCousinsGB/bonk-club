import { LINE_Y, LINE_CYCLE, LINE_DWELL, LINE_SPEED, STATIONS } from "./assembly-arena.js";
import { robotPose, CAR_BODY, CAR_CABIN, PRESS_HALF_HEIGHT, steamStrength, welding, smooth } from "./assembly-geometry.js";

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
  for (const [i, name] of ["STAMPING", "BODY WELD", "WHEELS / FINISH"].entries()) {
    rect(c, STATIONS[i] - 120, 650, 240, 46, "#0e1c26"); label(c, name, STATIONS[i], 681, 25);
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
function carArt(c, car) {
  const x=car.x, painted=car.stage===3, color=["#dfa44d","#58aaa7","#cf655b","#7e98cb"][car.id%4];
  const steel=c.createLinearGradient(0,1120,0,1176);
  steel.addColorStop(0,painted?color:"#c0ccca"); steel.addColorStop(.4,painted?color:"#8fa3ac"); steel.addColorStop(1,"#344e5c");
  rect(c,x-125,1158,250,18,"#627b88"); rect(c,x-125,1170,250,6,"#263e4b");
  for(let u=-112;u<120;u+=28){rect(c,x+u,1160,13,6,"#aebdbb");disc(c,x+u+6,1163,2,"#364e5a");}
  if(car.stage>=1){
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
  if(car.stage>=2)shell(c,x,0,painted,color);
  if(painted)for(const offset of [-81,81])wheel(c,x+offset,1167);
}
function stackLight(c,h,clock,reduced){
  const x=h.x+(h.assemblyStation===1?115:102), y=h.assemblyStation===1?705:770;
  const fault=!['none','empty'].includes(h.assemblyFault), amber=h.warning>0||h.assemblyFault==='empty';
  const colors=['#f45f48','#ffc15b','#79d4ac'];
  const selected=fault||h.active?0:amber?1:2;
  rect(c,x-3,y+55,6,25,"#81999e");rect(c,x-12,y-3,24,60,"#182b36");
  for(let i=0;i<3;i++){
    const lit=i===selected&&(!fault||reduced||Math.sin(clock*9)>-.25);
    rect(c,x-9,y+i*18,18,14,lit?colors[i]:['#593c39','#635640','#314b47'][i]);
    if(lit){c.save();c.globalAlpha=.18;disc(c,x,y+i*18+7,26,colors[i]);c.restore();}
  }
  if(fault||h.assemblyFault==='empty')label(c,({broken:'OFFLINE',damaged:'DAMAGED CAR',stage:'REJECTED',jam:'JAM',empty:'WAITING'})[h.assemblyFault],h.x,h.assemblyStation===1?815:916,17,fault?'#f18c72':'#d4ad69');
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

export function drawAssembly(c, state, reduced = false) {
  if (!state.assembly) return;
  const { clock, completed, cars } = state.assembly, phase = clock % LINE_CYCLE;
  const travel = Math.floor(clock / LINE_CYCLE) * 600 + Math.max(0, phase - LINE_DWELL) * LINE_SPEED;
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
  for (const car of cars) {
    c.save(); c.beginPath();
    for (const p of state.platforms.filter(p => p.assemblyCar === car.id && p.hp !== 0 && !p.wreckId)) c.rect(p.x, p.y, p.w, p.h);
    c.clip(); carArt(c, car, clock); c.restore();
  }
  for (const h of state.hazards.filter(h => h.assemblyStation)) {
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
      const work=cars.find(car=>car.id===h.assemblyWork && Math.abs(car.x-h.x)<3 && !car.damaged);
      const operating=work&&h.assemblyFault==='none'&&phase>=1&&phase<2.3;
      if(operating&&h.assemblyStation===2&&work.stage===1){
        shell(c,work.x,-55*(1-smooth((phase-1)/.3)),false,"#91a4aa");
      }
      if(h.assemblyStation===2){
        path(c,[{x:tip.x,y:tip.y-17},{x:tip.x,y:tip.y}],"#19303e",13);
        path(c,[{x:tip.x,y:tip.y-8},{x:tip.x,y:tip.y+3}],"#c8b393",5);
      }else{
        if(operating&&work.stage===2){
          if(phase>=1.7)wheel(c,work.x+81,1167);
          if(phase<1.7||phase>=1.95)wheel(c,tip.x,tip.y+4);
        }
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
  rect(c, 2260, 790, 230, 80, "#10212a");
  label(c, `BUILT ${completed}`, 2375, 824, 25, "#95d4b7");
  const fault = cars.some(car=>car.damaged||car.blocked)||state.hazards.some(h=>h.assemblyStation&&['broken','stage','jam','damaged'].includes(h.assemblyFault));
  label(c, fault ? "LINE FAULT" : phase < 3 ? "ASSEMBLING" : "CONVEYOR RUNNING", 2375, 853, 18, fault ? "#f48d73" : "#a9c0c8");
}
