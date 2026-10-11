// Foreground material art stays inside the physical face. The renderer clips
// cut pieces against their original face so seams and highlights do not restart
// on every eight-unit collision slice.
export function drawGrating(c,p) {
  c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
  c.fillStyle='#213641';c.fillRect(p.x,p.y,p.w,p.h);
  c.fillStyle='#93abae';c.fillRect(p.x,p.y,p.w,3);
  c.fillStyle='#081d29';c.fillRect(p.x,p.y+p.h-3,p.w,3);
  for(let x=Math.floor(p.x/14)*14;x<p.x+p.w;x+=14){
    c.fillStyle='#59727b';c.fillRect(x,p.y+4,4,p.h-7);
    c.fillStyle='#adbcba';c.fillRect(x,p.y+4,1,p.h-7);
  }
  c.restore();
}

export function drawStructuralSurface(c,p) {
  const stone=p.material==='stone'||p.material==='concrete';
  if(!stone&&p.material!=='metal')return false;
  c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
  const g=c.createLinearGradient(0,p.y,0,p.y+Math.max(1,p.h));
  g.addColorStop(0,stone?'#86928e':'#738995');
  g.addColorStop(.22,stone?'#637472':'#465e6c');
  g.addColorStop(1,stone?'#364c54':'#253c4b');
  c.fillStyle=g;c.fillRect(p.x,p.y,p.w,p.h);
  c.fillStyle=stone?'#b6c2b3':'#bacbcb';c.fillRect(p.x,p.y,p.w,3);
  c.fillStyle='#10273388';c.fillRect(p.x,p.y+p.h-4,p.w,4);
  if(stone){
    // Sparse aggregate and expansion joints give the concrete weight without
    // the old tall rectangular shadows suggesting another collision surface.
    for(let x=Math.floor(p.x/29)*29;x<p.x+p.w;x+=29){
      const y=p.y+8+(Math.abs(x*13)%Math.max(1,p.h-12));
      c.fillStyle='#c0c2ac25';c.fillRect(x,y,5,2);
      c.fillStyle='#102b3744';c.fillRect(x+11,y+3,2,2);
    }
    for(let x=Math.floor(p.x/180)*180;x<p.x+p.w;x+=180){
      c.fillStyle='#1f374466';c.fillRect(x,p.y+4,2,p.h-4);
      c.fillStyle='#b1b8a52b';c.fillRect(x+2,p.y+4,1,p.h-4);
    }
  }else{
    c.fillStyle='#a9b8b626';c.fillRect(p.x,p.y+6,p.w,1);
    for(let x=Math.floor(p.x/64)*64+14;x<p.x+p.w;x+=64){
      const y=p.y+Math.min(12,p.h*.55);
      c.fillStyle='#102733';c.fillRect(x-1,y-1,5,5);
      c.fillStyle='#9fb5b7';c.fillRect(x,y,3,2);
    }
  }
  c.restore();return true;
}

export function drawMetalPanel(c,p) {
  c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
  drawStructuralSurface(c,{...p,material:'metal'});
  c.strokeStyle='#b3bfb377';c.lineWidth=2;c.strokeRect(p.x+3,p.y+3,p.w-6,p.h-6);
  for(let x=Math.floor(p.x/40)*40;x<p.x+p.w;x+=40){
    c.fillStyle='#182f3d';c.fillRect(x,p.y+8,2,p.h-16);
    c.fillStyle='#b6c2b22b';c.fillRect(x+2,p.y+8,1,p.h-16);
  }
  if(p.hp<p.maxHp*.7){
    c.strokeStyle='#101f2b';c.lineWidth=3;c.beginPath();
    c.moveTo(p.x+p.w*.4,p.y);c.lineTo(p.x+p.w*.52,p.y+p.h*.6);
    c.lineTo(p.x+p.w*.47,p.y+p.h);c.stroke();
  }
  c.restore();
}
