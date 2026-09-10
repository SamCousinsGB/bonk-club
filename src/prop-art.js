import { PROP_MATERIALS } from "./props.js";

export function drawChunks(c, chunks) {
  for (const b of chunks || []) {
    if (b.hp <= 0) continue;
    c.save();
    c.translate(b.x + b.w / 2, b.y + b.h / 2);
    c.rotate(b.angle);
    c.fillStyle = b.material === "fabric" && b.kind === "bed" ? "#78a8a9" : PROP_MATERIALS[b.material].color;
    c.strokeStyle = "#22323d"; c.lineWidth = 1.2;
    c.beginPath();
    const shape = b.shape || [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
    shape.forEach(([x,y],i) => i ? c.lineTo(x*b.w,y*b.h) : c.moveTo(x*b.w,y*b.h));
    c.closePath(); c.fill(); c.stroke(); c.clip();
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
