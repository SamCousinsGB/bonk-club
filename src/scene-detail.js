import { W, H } from "./scale.js";

const stroke=(c,points,color,width=3)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const disc=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
// Equipment is mounted on back walls and kept below the contrast of collision
// surfaces. Reuse the cached backdrop, including the original eight arenas.
function themedDetails(c,a) {
  const t=a.theme,medical=["hospital","atrium"].includes(t),industrial=["factory","port"].includes(t);
  const broad=a.platforms.filter(p=>p.w>300&&!p.elevator&&!p.move);
  for(const [i,p] of broad.entries()) {
    const x=p.x+p.w*.55,y=p.y;
    if(medical){
      stroke(c,[[p.x+20,y-92],[p.x+p.w-20,y-92]],"#83b3ad44",5);
      const mx=p.x+70;
      c.fillStyle="#193944";c.fillRect(mx,y-155,57,42);
      c.strokeStyle="#95b9b360";c.lineWidth=3;c.strokeRect(mx,y-155,57,42);
      stroke(c,[[mx+5,y-133],[mx+14,y-133],[mx+19,y-142],[mx+25,y-120],[mx+31,y-136],[mx+49,y-136]],"#89d2b37a",2);
      stroke(c,[[mx+28,y-113],[mx+28,y-101],[mx+58,y-101]],"#809d9f66",3);
      for(const xx of [mx+78,mx+94])disc(c,xx,y-92,4,"#dab76877");
      c.fillStyle="#b4cec225";c.fillRect(p.x+p.w-130,y-170,54,64);
      stroke(c,[[p.x+p.w-103,y-162],[p.x+p.w-103,y-117]],"#c9e3d53a",4);
      for(let n=0;n<3;n++)stroke(c,[[p.x+p.w-116,y-148+n*8],[p.x+p.w-91,y-148+n*8]],"#c9e3d53a",2);
      // Curtain tracks stay on the back wall, with an open centre doorway.
      stroke(c,[[p.x+16,y-215],[p.x+p.w-16,y-215]],"#a8c4c033",3);
      for(let n=0;n<5;n++){c.fillStyle=n%2?"#66989d28":"#83b7b624";c.fillRect(p.x+18+n*13,y-210,13,135);}
    }else if(industrial||a.city){
      const steel=industrial?"#7a93983c":"#85a9bd2e";
      stroke(c,[[p.x+16,y+40],[p.x+p.w-16,y+40]],steel,5);
      for(let xx=p.x+18;xx<p.x+p.w-70;xx+=100)
        stroke(c,[[xx,y+5],[xx+48,y+39],[xx+96,y+5]],steel,3);
      if(t==="factory"){
        c.fillStyle="#152a354f";c.fillRect(x-78,y-174,156,145);
        c.strokeStyle="#859e9f44";c.lineWidth=4;c.strokeRect(x-78,y-174,156,145);
        for(let n=0;n<6;n++)stroke(c,[[x-67+n*24,y-161],[x-67+n*24,y-48]],"#81969529",4);
        stroke(c,[[x-110,y-205],[x-110,y-75],[x-88,y-75]],"#aba88950",11);
        disc(c,x-110,y-114,16,"#566e7455");
        stroke(c,[[x-120,y-124],[x-100,y-104]],"#b0875c66",4);
        c.fillStyle="#d2ba7955";c.fillRect(x-35,y-216,70,5);
      }else if(t==="port"){
        stroke(c,[[p.x+35,y-18],[p.x+35,y-65],[p.x+p.w-35,y-65],[p.x+p.w-35,y-18]],"#a1b6ad33",5);
        for(const xx of [p.x+55,p.x+p.w-55]){disc(c,xx,y-29,18,"#0e263d88");disc(c,xx,y-29,10,"#7b939444");}
      }else{
        for(let xx=p.x+40;xx<p.x+p.w-100;xx+=160){
          c.fillStyle="#9bced216";c.fillRect(xx,y-215,100,155);
          stroke(c,[[xx+50,y-215],[xx+50,y-60]],"#94b9bc27",3);
          stroke(c,[[xx,y-145],[xx+100,y-145]],"#94b9bc27",3);
        }
      }
    }else if(["houses","mansion"].includes(t)){
      c.fillStyle="#c3a88219";c.fillRect(p.x+20,y-70,p.w-40,66);
      stroke(c,[[p.x+20,y-72],[p.x+p.w-20,y-72]],"#dcc09533",4);
      c.fillStyle="#382f4177";c.fillRect(x-40,y-178,80,65);
      c.strokeStyle="#c6a07860";c.lineWidth=5;c.strokeRect(x-40,y-178,80,65);
      c.fillStyle="#778c762d";c.fillRect(x-30,y-163,60,40);
      disc(c,p.x+p.w-65,y-142,19,"#c5b89355");
      stroke(c,[[p.x+p.w-65,y-157],[p.x+p.w-65,y-142],[p.x+p.w-53,y-137]],"#354a5366",3);
    }else if(["jungle","temple"].includes(t)){
      for(const dir of [-1,1]){
        const xx=p.x+(dir<0?20:p.w-20);
        stroke(c,[[xx,y+7],[xx+dir*14,y+54],[xx-dir*4,y+100]],"#75976a68",4);
        for(let n=0;n<5;n++){
          const yy=y+24+n*14;stroke(c,[[xx+dir*8,yy+8],[xx+dir*(n%2?24:-12),yy]],"#75976a68",5);
        }
      }
      if(t==="temple")for(let n=0;n<3;n++){
        c.strokeStyle="#b5b28727";c.lineWidth=3;c.strokeRect(x-40+n*32,y+38,22,25);
      }
    }else if(["desert","ruins","volcano"].includes(t)){
      for(let n=0;n<3;n++)stroke(c,[[p.x+20+n*13,y+38+n*10],[p.x+p.w*.6,y+46+n*10],[p.x+p.w-18,y+37+n*12]],t==="volcano"?"#ca765b25":"#d0a37532",3);
      if(t==="volcano")stroke(c,[[x,y+28],[x-14,y+48],[x+6,y+63],[x-7,y+82]],"#ed855243",3);
      else if(i%2===0){
        c.fillStyle="#b48d622b";c.fillRect(x-15,y-176,30,136);c.fillRect(x-23,y-186,46,12);
        for(let n=0;n<3;n++)stroke(c,[[x-9+n*9,y-164],[x-9+n*9,y-55]],"#edd1a626",2);
      }
    }else if(t==="arctic"){
      for(let xx=p.x+18;xx<p.x+p.w;xx+=67){
        c.beginPath();c.moveTo(xx,y+25);c.lineTo(xx+9,y+60+(i%3)*9);c.lineTo(xx+18,y+25);c.fillStyle="#8ab6cc44";c.fill();
      }
      if(i%3===0){
        stroke(c,[[x,y-30],[x,y-150],[x-23,y-175]],"#b5c6cc44",5);
        c.beginPath();c.arc(x-23,y-175,30,0,Math.PI);c.strokeStyle="#aec7d055";c.lineWidth=5;c.stroke();
      }
    }
  }
}

// Static lighting and distant structures are baked into the cached backdrop.
export function sceneDetail(c, arena) {
  c.save();
  themedDetails(c,arena);
  const warm = ["desert","ruins","houses","mansion","volcano"].includes(arena.theme);
  const light = c.createLinearGradient(0,0,0,H);
  light.addColorStop(0, warm ? "#ffc68416" : "#93dfec15");
  light.addColorStop(.6,"#07141f00"); light.addColorStop(1,"#05101c80");
  c.fillStyle=light; c.fillRect(0,0,W,H);
  for (let i=0;i<5;i++) {
    const x=210+i*550;
    c.beginPath(); c.moveTo(x,0); c.lineTo(x+90,0); c.lineTo(x-420,H); c.lineTo(x-800,H); c.closePath();
    c.fillStyle=warm?"#ffdc9b06":"#c5eeff06"; c.fill();
  }
  if (["houses","mansion","hospital","atrium"].includes(arena.theme)) {
    for (const p of arena.platforms.filter(p=>p.w>450)) for(const [bx,by,bw,bh] of arena.buildings || []) {
      const left=Math.max(p.x,bx),right=Math.min(p.x+p.w,bx+bw);
      if(right-left<180 || p.y<by+85 || p.y>by+bh+10) continue;
      const height=Math.min(170,p.y-by-15);
      c.save(); c.beginPath(); c.rect(bx,by,bw,bh); c.clip();
      for(let x=left+55;x<right-80;x+=175) {
        c.fillStyle="#12212c66"; c.fillRect(x,p.y-height,64,height);
        c.strokeStyle="#92afb222"; c.lineWidth=3; c.strokeRect(x,p.y-height,64,height);
        c.fillStyle=warm?"#ffc88430":"#9ee6e830"; c.fillRect(x+7,p.y-height+14,50,height*.4);
        c.fillStyle="#dbede848"; c.fillRect(x+50,p.y-54,5,5);
      }
      const x=(left+right)/2,ceiling=Math.max(by+10,p.y-245);
      c.fillStyle=warm?"#efbb7422":"#c5eeff1c";
      c.beginPath(); c.moveTo(x-45,ceiling); c.lineTo(x+45,ceiling); c.lineTo(x+145,p.y-25); c.lineTo(x-145,p.y-25); c.fill();
      c.fillStyle=warm?"#d9b87f88":"#cee9ee88"; c.fillRect(x-45,ceiling,90,5);
      c.restore();
    }
  }
  c.restore();
}

// A small fixed set of drifting motes adds depth without per-frame allocations.
export function ambientDetail(r, arena, time) {
  if (r.reduced) return;
  const c=r.ctx, ice=arena.theme==="arctic", fire=arena.theme==="volcano";
  c.save(); c.globalAlpha=.32;
  c.fillStyle=ice?"#d9f4ff":fire?"#ffba6a":"#c4d7c1";
  for(let i=0;i<18;i++) {
    const x=(i*149+Math.sin(i*7+time*.22)*35+W)%W;
    const y=(i*239+(ice?time*22:fire?-time*29:time*6)+H*100)%H;
    c.fillRect(x,y,ice?3:2,fire?6:ice?3:2);
  }
  c.restore();
}

export function pickupLabels(drops, players, local, artFor, weapons) {
  const occupied=players.filter(p=>p.alive).map(p=>({x:p.x-72,y:p.y-95,w:144,h:42}));
  const labels=[];
  const near=d=>local?Math.hypot(d.x-local.x,d.y-local.y):0;
  for(const d of [...drops].sort((a,b)=>near(a)-near(b))) {
    if(local && near(d)>640 && !["rare","exotic"].includes(weapons[d.type].rarity)) continue;
    const art=artFor(d.type),w=art.label.width;
    for(const dy of [-83,-118,24]) {
      const box={x:Math.max(4,Math.min(W-w-4,d.x-w/2)),y:Math.max(4,d.y+dy),w,h:30};
      if(occupied.some(p=>box.x<p.x+p.w+7&&box.x+box.w>p.x-7&&box.y<p.y+p.h+5&&box.y+box.h>p.y-5)) continue;
      occupied.push(box); labels.push({...box,d,art}); break;
    }
  }
  return labels;
}
