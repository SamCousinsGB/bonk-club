import { PROP_MATERIALS } from "./props.js";

// One source image per prop kind/size, shared by every shard and black-hole
// ribbon. Fragments sample their actual location in that image, never a scaled
// miniature of the complete prop. No bitmap data is sent over the network.
function sourceArtwork(r, b) {
  const [, , , , w, h] = b.sourceArt, key = `${b.kind}:${w}:${h}`;
  const cache = (r.propArt ||= new Map());
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * 2); canvas.height = Math.ceil(h * 2);
  const c = canvas.getContext("2d"), main = r.ctx;
  c.scale(canvas.width/w, canvas.height/h);
  r.ctx = c;
  try { r.tableArt({kind:b.kind, x:0, y:0, w, h, hp:100, maxHp:100}); }
  finally { r.ctx = main; }
  if(cache.size >= 64) cache.delete(cache.keys().next().value);
  cache.set(key,canvas);
  return canvas;
}

function shardArtwork(r, b) {
  const key=JSON.stringify([b.kind,b.material,b.sourceArt,b.shape]),cache=(r.shardArt ||= new Map());
  if(cache.has(key))return cache.get(key);
  const source=sourceArtwork(r,b),[x,y,w,h,sw,sh]=b.sourceArt;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.ceil(w*2));canvas.height=Math.max(1,Math.ceil(h*2));
  const c=canvas.getContext('2d');c.scale(canvas.width/w,canvas.height/h);c.translate(w/2,h/2);
  c.beginPath();b.shape.forEach(([x,y],i)=>i?c.lineTo(x*w,y*h):c.moveTo(x*w,y*h));c.closePath();c.clip();
  c.drawImage(source,x*source.width/sw,y*source.height/sh,w*source.width/sw,h*source.height/sh,-w/2,-h/2,w,h);
  // Shade only opaque source pixels. A frame, wheel or rounded casing must not
  // acquire a polygon outline across the transparent space around its artwork.
  c.globalCompositeOperation='source-atop';c.lineJoin='bevel';
  c.strokeStyle='#202b32aa';c.lineWidth=2;c.stroke();
  c.strokeStyle=b.material==='wood'?'#dfbb83':b.material==='fabric'?'#dfd3c1':b.material==='stone'?'#c7c3ad':'#dce5df';
  c.lineWidth=b.material==='fabric'?1.1:.8;c.stroke();
  if(cache.size>=192)cache.delete(cache.keys().next().value);
  cache.set(key,canvas);return canvas;
}

export function drawChunks(r, chunks) {
  const c = r.ctx;
  for (const b of chunks || []) {
    if (b.hp <= 0) continue;
    c.save();
    c.translate(b.x + b.w / 2, b.y + b.h / 2);
    c.rotate(b.angle);
    if (b.sourceArt) {
      c.drawImage(shardArtwork(r,b),-b.w/2,-b.h/2,b.w,b.h);
      c.restore();continue;
    }
    c.fillStyle = b.material === "fabric" && b.kind === "bed" ? "#78a8a9" : PROP_MATERIALS[b.material].color;
    c.strokeStyle = "#22323d"; c.lineWidth = 1.2;
    c.beginPath();
    const shape = b.shape || [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
    shape.forEach(([x,y],i) => i ? c.lineTo(x*b.w,y*b.h) : c.moveTo(x*b.w,y*b.h));
    c.closePath();
    c.fill(); c.stroke(); c.clip();
    c.strokeStyle = b.material === "metal" ? "#e0ebed" : b.material === "glass" ? "#e7ffff" : "#e7ceb488";
    c.lineWidth = b.material === "metal" ? 2 : 1;
    c.beginPath();
    c.moveTo(-b.w*.4, -b.h*.28); c.lineTo(b.w*.4, -b.h*.28);
    if (b.material === "stone") {
      c.moveTo(-b.w*.15,-b.h*.45); c.lineTo(b.w*.12,b.h*.04); c.lineTo(-b.w*.3,b.h*.4);
    } else if (b.material === "wood") {
      c.moveTo(-b.w*.3,b.h*.12); c.lineTo(b.w*.32,b.h*.23);
    } else if (b.material === "fabric") {
      c.setLineDash([2,3]);
      c.moveTo(-b.w*.38,b.h*.3); c.lineTo(b.w*.38,b.h*.3);
    }
    c.stroke(); c.restore();
  }
}
