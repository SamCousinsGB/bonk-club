export function drawCrown(c, x, y, angle=0) {
  c.save(); c.translate(x,y); c.rotate(angle);
  c.shadowColor='#ffd45c'; c.shadowBlur=12;
  c.beginPath(); c.moveTo(-15,-9); c.lineTo(-18,-27); c.lineTo(-8,-20);
  c.lineTo(0,-32); c.lineTo(8,-20); c.lineTo(18,-27); c.lineTo(15,-9); c.closePath();
  const gold=c.createLinearGradient(0,-32,0,-8);
  gold.addColorStop(0,'#fff3b0');gold.addColorStop(.5,'#ffcf52');gold.addColorStop(1,'#ce801f');
  c.fillStyle=gold; c.fill(); c.shadowBlur=0;
  c.strokeStyle='#684111';c.lineWidth=2;c.lineJoin='round';c.stroke();
  c.fillStyle='#fff3af';c.fillRect(-13,-13,26,3);
  c.fillStyle='#ee5467';c.beginPath();c.moveTo(0,-21);c.lineTo(3,-17);c.lineTo(0,-13);c.lineTo(-3,-17);c.closePath();c.fill();
  c.restore();
}

export function drawCrownGlow(c,p) {
  c.save();
  const glow=c.createRadialGradient(p.x,p.y-14,8,p.x,p.y-14,85);
  glow.addColorStop(0,'#ffe48155');glow.addColorStop(.55,'#ffd14e25');glow.addColorStop(1,'#ffd14e00');
  c.fillStyle=glow;c.fillRect(p.x-85,p.y-99,170,170);
  c.strokeStyle='#ffe69b66';c.lineWidth=16;c.lineCap='round';c.lineJoin='round';
  c.beginPath();
  for(const [a,b] of [[1,2],[1,3],[3,4],[1,5],[5,6],[2,7],[7,8],[2,9],[9,10]]) {
    c.moveTo(p.rig[a].x,p.rig[a].y);c.lineTo(p.rig[b].x,p.rig[b].y);
  }
  c.stroke();c.restore();
}

export function drawLooseCrown(c,state,time,reduced) {
  const crown=state.crown;
  if(!crown?.available || crown.holder!==null)return;
  const y=crown.y+(crown.loose||reduced?0:Math.sin(time*2.5)*4);
  c.save();
  const glow=c.createRadialGradient(crown.x,y,4,crown.x,y,55);
  glow.addColorStop(0,'#ffde7666');glow.addColorStop(1,'#ffde7600');
  c.fillStyle=glow;c.fillRect(crown.x-55,y-55,110,110);
  drawCrown(c,crown.x,y+20);
  c.font="700 16px 'DM Sans',sans-serif";c.textAlign='center';
  c.strokeStyle='#091523';c.lineWidth=4;c.strokeText('CROWN',crown.x,y-30);
  c.fillStyle='#ffe69b';c.fillText('CROWN',crown.x,y-30);c.restore();
}
