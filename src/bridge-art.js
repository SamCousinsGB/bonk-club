import { cableRuns } from './cable-art.js';

export function drawBridgeHall(c) {
  const sky=c.createLinearGradient(0,0,0,1440);
  sky.addColorStop(0,'#152c40');sky.addColorStop(.65,'#486271');sky.addColorStop(1,'#192f3a');
  c.fillStyle=sky;c.fillRect(0,0,2560,1440);
  c.fillStyle='#86a4a31f';
  for(let i=0;i<12;i++)c.fillRect(i*250-20,1010+(i%3)*35,150,430);
  c.fillStyle='#102833';c.fillRect(0,1400,2560,40);
  for(const x of [405,2015]) {
    c.fillStyle='#192b36';c.fillRect(x,215,140,1180);
    c.fillStyle='#607480';c.fillRect(x+10,220,14,1150);c.fillRect(x+116,220,14,1150);
    c.fillStyle='#314b59';c.fillRect(x+27,320,86,745);
    for(const y of [370,560,750,940,1130]){
      c.fillStyle='#152b36';c.fillRect(x+28,y,84,94);
      c.strokeStyle='#8ca2a4';c.lineWidth=4;c.strokeRect(x+28,y,84,94);
    }
  }
}

export function drawBridgeStructure(c,state) {
  const panels=state.platforms.filter(p=>Number.isInteger(p.bridgePanel)&&p.hp!==0).sort((a,b)=>a.bridgePanel-b.bridgePanel);
  for(let i=0;i<panels.length-1;i++){
    const a=panels[i],b=panels[i+1];
    if(b.bridgePanel!==a.bridgePanel+1||i===7)continue;
    c.beginPath();c.moveTo(a.x+a.w/2,a.y+25);c.lineTo(b.x+b.w/2,b.y+25);
    c.strokeStyle='#172b35';c.lineWidth=34;c.stroke();
    c.strokeStyle='#687d84';c.lineWidth=9;c.stroke();
  }
  for(const p of panels) {
    c.fillStyle='#1c2d37';c.fillRect(p.x,p.y+5,p.w,p.h+13);
    c.fillStyle='#647b83';c.fillRect(p.x,p.y,p.w,7);
    c.fillStyle='#b5aaa0';c.fillRect(p.x+5,p.y+2,Math.max(0,p.w-10),2);
    c.strokeStyle='#a6b5ad';c.lineWidth=2;
    c.beginPath();c.moveTo(p.x+8,p.y+22);c.lineTo(p.x+p.w-8,p.y+22);c.stroke();
  }
  for(const cable of state.cables||[])if(cable.id.startsWith('bridge')){
    c.lineCap='round';
    for(const run of cableRuns(cable)){
      c.beginPath();c.moveTo(run[0].x,run[0].y);
      for(const p of run.slice(1))c.lineTo(p.x,p.y);
      c.strokeStyle='#172833';c.lineWidth=15;c.stroke();
      c.strokeStyle='#a6b8b9';c.lineWidth=8;c.stroke();
      c.strokeStyle='#d1dbd7';c.lineWidth=2;c.stroke();
    }
    for(let i=1;i<cable.points.length-1;i+=2){
      if(!cable.links[i-1]||!cable.links[i])continue;
      const q=cable.points[i],panel=panels.find(p=>q.x>=p.x&&q.x<=p.x+p.w);
      if(!panel||panel.y<q.y+15)continue;
      c.strokeStyle='#748d94';c.lineWidth=3;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,panel.y);c.stroke();
    }
  }
  c.strokeStyle='#b7c1bd';c.lineWidth=4;
  for(const p of panels)if(p.y<1390){
    c.beginPath();c.moveTo(p.x,p.y-28);c.lineTo(p.x,p.y-4);c.stroke();
  }
}
