import { World, ARENAS, STEP } from '../src/engine.js';
import { BotController } from '../src/bots.js';
import { carveExplosion } from '../src/terrain.js';
const w = new World({arena:ARENAS.findIndex(a=>a.cargoPlane),players:[0,1,2,3],shuffle:false,random:()=>.4});
const bots=new BotController();w.players.forEach(p=>p.bot=true);w.phase='fight';
const samples=[];
for(let i=0;i<2400;i++) {
  if(i===1200)carveExplosion(w,{x:2110,y:710,radius:140});
  const t=performance.now();const inputs=bots.inputs(w,STEP);const b=performance.now();
  w.step(STEP,inputs);samples.push({bot:b-t,sim:performance.now()-b});
}
for(const [label,rows] of [['intact',samples.slice(0,1200)],['damaged',samples.slice(1200)]]) {
  const stats=k=>{const v=rows.map(s=>s[k]).sort((a,b)=>a-b);return {mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],p99:v[Math.floor(v.length*.99)],max:v.at(-1)};};
  console.log(label,JSON.stringify({bots:stats('bot'),simulation:stats('sim')}));
}
