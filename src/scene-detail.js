import { W, H } from "./scale.js";

// Equipment is mounted on back walls and kept below the contrast of collision
// surfaces. Reuse the cached backdrop, including the original eight arenas.
// Soft cached light leaves collision surfaces and fighters readable.
export function sceneDetail(c) {
  c.save();
  const light = c.createLinearGradient(0, 0, 0, H);
  light.addColorStop(0, "#93dfec15");
  light.addColorStop(.6, "#07141f00");
  light.addColorStop(1, "#05101c80");
  c.fillStyle = light;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) {
    const x = 210 + i * 550;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 90, 0);
    c.lineTo(x - 420, H); c.lineTo(x - 800, H); c.closePath();
    c.fillStyle = "#c5eeff06"; c.fill();
  }
  c.restore();
}

export function ambientDetail(r, arena, time) {
  if (r.reduced) return;
  const c = r.ctx;
  c.save(); c.globalAlpha = .32; c.fillStyle = "#c4d7c1";
  for (let i = 0; i < 18; i++) {
    const x = (i * 149 + Math.sin(i * 7 + time * .22) * 35 + W) % W;
    const y = (i * 239 + time * 6 + H * 100) % H;
    c.fillRect(x, y, 2, 2);
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
