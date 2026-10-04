// Bounded, seekable smoke derived from real burning fuel. No particle history
// or extra network state: late joins see the same source-fed fire columns.
export function refinerySmokeSources(state){
  if(!state.refinery)return [];
  const bins=new Map();
  const add=(x,y,mass)=>{
    const key=Math.floor(x/256)+':'+Math.floor(y/300),q=bins.get(key)||{x:0,y:0,mass:0};
    q.x+=x*mass;q.y+=y*mass;q.mass+=mass;bins.set(key,q);
  };
  for(const q of state.spills||[])if(q.fire>0&&q.h>1)add(q.x+q.w/2,q.y,Math.min(100,q.h));
  for(const g of state.gas||[])if(g.spray&&g.lit>0)add(g.x,g.y,g.r*.6);
  return [...bins.values()].sort((a,b)=>b.mass-a.mass).slice(0,10).map(q=>({x:q.x/q.mass,y:q.y/q.mass,strength:Math.min(1,q.mass/140)}));
}
let smoke;
function cloud(){
  const a=document.createElement('canvas');a.width=a.height=256;const c=a.getContext('2d');
  for(let i=0;i<9;i++){
    const x=128+Math.sin(i*2.4)*44,y=128+Math.cos(i*1.7)*42,r=54+i%3*8;
    const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#161918ed');g.addColorStop(.55,'#252927c9');g.addColorStop(1,'#262b2900');
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  return a;
}
export function drawRefinerySmoke(c,state,reduced){
  const sources=refinerySmokeSources(state);if(!sources.length)return;
  smoke||=cloud();const time=reduced?0:state.refinery.clock;
  c.save();
  for(const [i,s]of sources.entries()){
    // Hot bases are narrow; soot billows spread and overlap as they rise.
    for(let k=0;k<11;k++){
      const age=(time*.105+k/11+i*.137)%1,height=440+s.strength*430;
      const x=s.x+age*110+Math.sin(age*6+i)*age*50,y=s.y-35-age*height;
      const radius=38+age*(105+s.strength*55),fade=Math.min(1,age*8,(1-age)*5);
      c.globalAlpha=(.32+s.strength*.45)*fade;
      c.drawImage(smoke,x-radius,y-radius,radius*2,radius*2);
    }
  }
  c.restore();
}
