// Split the source artwork with oblique cracks. Every shard is convex so the
// rotating rigid-body collider can use exactly the same outline as the renderer.
const rect = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const area = ps => Math.abs(ps.reduce((sum, a, i) => {
  const b = ps[(i+1)%ps.length]; return sum + a[0]*b[1]-a[1]*b[0];
}, 0))/2;
function bounds(ps) {
  const x=Math.min(...ps.map(p=>p[0])), y=Math.min(...ps.map(p=>p[1]));
  return {x,y,w:Math.max(...ps.map(p=>p[0]))-x,h:Math.max(...ps.map(p=>p[1]))-y};
}
function clip(ps, nx, ny, offset, side) {
  const out=[];
  for(let i=0;i<ps.length;i++) {
    const a=ps[i],b=ps[(i+1)%ps.length],da=(a[0]*nx+a[1]*ny-offset)*side,db=(b[0]*nx+b[1]*ny-offset)*side;
    if(da>=0)out.push(a);
    if((da>0&&db<0)||(da<0&&db>0)) {
      const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return out;
}
function split(ps, depth, random) {
  if(!depth)return [ps];
  const b=bounds(ps), horizontal=b.w>b.h, slope=(random()<.5?-1:1)*(.35+random()*.45);
  const nx=horizontal?1:slope,ny=horizontal?slope:1;
  const distances=ps.map(p=>p[0]*nx+p[1]*ny),lo=Math.min(...distances),hi=Math.max(...distances);
  const offset=lo+(hi-lo)*(.4+random()*.2);
  return [1,-1].flatMap(side=>split(clip(ps,nx,ny,offset,side),depth-1,random));
}
function regions(b) {
  const {w,h}=b;
  // Separate cushions/mattress from frames and avoid filling the air under beds.
  if(b.kind==='bed')return [
    [rect(3,3,w-6,Math.max(20,h-22)), 'fabric', 2],
    [rect(0,h-7,w,4),'metal',1],
    [rect(0,0,4,h-7),'metal',0],[rect(w-4,3,4,h-10),'metal',0],
    [rect(8,h-7,10,7),'metal',0],[rect(w-18,h-7,10,7),'metal',0],
  ];
  if(b.kind==='table')return [
    [rect(0,0,w,9),'wood',2], [rect(12,9,w-24,h-19),'wood',2],
    [rect(5,9,7,h-9),'wood',0],[rect(w-12,9,7,h-9),'wood',0],
  ];
  if(b.kind==='sofa')return [[rect(0,0,w,h-10),'fabric',3],[rect(0,h-10,w,10),'wood',1]];
  if(b.kind==='stone')return [[[[0,h],[4,18],[24,0],[w-20,3],[w,25],[w-5,h]],'stone',3]];
  return [[rect(0,0,w,h),b.material,3]];
}
export function propFragments(b, random) {
  return regions(b).flatMap(([polygon,material,depth])=>split(polygon,depth,random).map(ps=>{
    const box=bounds(ps);
    // Use wire precision on the host as well. Remove tiny bevels which collapse
    // when quantized, keeping strict convexity and stable collision on guests.
    const shape=ps.map(([x,y])=>[+(Math.max(-.5,Math.min(.5,(x-box.x)/box.w-.5))).toFixed(2),
      +(Math.max(-.5,Math.min(.5,(y-box.y)/box.h-.5))).toFixed(2)]);
    let changed=true;
    while(changed&&shape.length>3) {
      changed=false;
      for(let i=0;i<shape.length;i++) {
        const a=shape[(i+shape.length-1)%shape.length],p=shape[i],c=shape[(i+1)%shape.length];
        if((p[0]-a[0])*(c[1]-p[1])-(p[1]-a[1])*(c[0]-p[0])<.001) {
          shape.splice(i,1);changed=true;break;
        }
      }
    }
    return {...box,material,shape,area:area(ps),sourceArt:[box.x,box.y,box.w,box.h,b.w,b.h].map(n=>+n.toFixed(2))};
  }));
}
