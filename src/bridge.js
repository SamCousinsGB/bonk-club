import { prepareProp, impulseProp } from './props.js';
import { BRIDGE_DECK_Y, BRIDGE_PANELS } from './bridge-arena.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PANEL_W=90;
export function bridgeSupport(world, half) {
  const cables=world.cables.filter(c=>c.id.startsWith('bridge'));
  if (!cables.length) return 0;
  const start=half?cables[0].links.length/2:0,end=start+cables[0].links.length/2;
  return cables.reduce((sum,c)=>{
    if(!c.attached[half])return sum;
    const links=c.links.slice(start,end);
    if(half)links.reverse();
    const broken=links.indexOf(false);
    return sum+(broken<0?1:broken/links.length);
  },0)/cables.length;
}

// Each deck tile is a sprung, massive link. The hanger load and neighbouring
// tiles limit its motion; a fully severed half folds toward its tower.
export function updateBridge(world,dt) {
  if (!world.arena.bridge || world.prediction || dt<=0) return;
  const panels=world.platforms.filter(p=>Number.isInteger(p.bridgePanel)).sort((a,b)=>a.bridgePanel-b.bridgePanel);
  world.bridgeNavY??=Object.fromEntries(panels.map(p=>[p.bridgePanel,p.y]));
  const support=[bridgeSupport(world,0),bridgeSupport(world,1)];
  for (const p of panels) {
    const half=p.bridgePanel<BRIDGE_PANELS/2?0:1;
    const local=half===0?p.bridgePanel:BRIDGE_PANELS-1-p.bridgePanel;
    const lost=1-support[half];
    const fold=clamp(lost/.9,0,1);
    // Integrating equal length links keeps the falling span connected in
    // profile instead of moving its panels along unrelated vertical paths.
    let reach=0,drop=0;
    for(let i=0;i<=local;i++){
      const angle=fold*(1.04+i*.075);
      const length=i===local?PANEL_W/2:PANEL_W;
      reach+=Math.cos(angle)*length;drop+=Math.sin(angle)*length;
    }
    const targetX=(half===0?560:2000)+(half===0?reach:-reach)-PANEL_W/2+(p.bridgeOffsetX||0);
    const targetY=BRIDGE_DECK_Y+drop+(p.bridgeOffsetY||0);
    p.bridgeVx=clamp((p.bridgeVx||0)+(targetX-p.x)*2.6*dt,-650,650);
    p.bridgeVy=clamp((p.bridgeVy||0)+((targetY-p.y)*3.2+lost*110)*dt,-700,750);
    p.bridgeVx*=Math.exp(-2.1*dt);p.bridgeVy*=Math.exp(-1.8*dt);
    const oldX=p.x,oldY=p.y;
    p.x+=p.bridgeVx*dt;p.y+=p.bridgeVy*dt;
    p.dx=p.x-oldX;p.dy=p.y-oldY;
  }
  if(panels.some(p=>Math.abs(p.y-(world.bridgeNavY?.[p.bridgePanel]??p.y))>35)){
    world.bridgeNavY=Object.fromEntries(panels.map(p=>[p.bridgePanel,p.y]));
    world.terrainVersion++;
  }
  // Traffic uses ordinary physical car bodies. Drive exists only under
  // surviving deck contact; slope adds gravity, severed spans shed cars.
  if (world.phase!=="fight") return;
  world.bridgeTraffic=(world.bridgeTraffic||0)+dt;
  if(world.bridgeTraffic>3.1) {
    world.bridgeTraffic=0;
    const cars=world.cover.filter(b=>b.bridgeVehicle&&b.hp>0);
    if(cars.length<5) {
      const dir=world.bridgeVehicleSerial%2?1:-1;
      const x=dir>0?35:2305;
      world.cover.push(prepareProp({id:`bridge-car-${++world.bridgeVehicleSerial}`,kind:"car",x,y:BRIDGE_DECK_Y-112,
        w:210,h:105,hp:170,maxHp:170,mass:190,carStage:31,carPaint:world.bridgeVehicleSerial%3+1,
        carCoat:1,bridgeVehicle:true,bridgeDir:dir,vx:dir*260}));
    }
  }
  for(const b of world.cover.filter(b=>b.bridgeVehicle&&b.hp>0)) {
    const cx=b.x+b.w/2,feet=b.y+b.h;
    const floor=world.platforms.find(p=>p.hp!==0&&cx>=p.x&&cx<=p.x+p.w&&Math.abs(feet-p.y)<27);
    if(floor) {
      const next=panels.find(p=>p.bridgePanel===floor.bridgePanel+(b.bridgeDir||1));
      const slope=next?(next.y-floor.y)/PANEL_W:0;
      impulseProp(b,clamp((b.bridgeDir*450+slope*820-b.vx)*b.mass*dt*2,-b.mass*32,b.mass*32),0);
    }
  }
  world.cover=world.cover.filter(b=>!b.bridgeVehicle||b.hp>0&&b.x>-400&&b.x<2750&&b.y<1800);
}
