import { drawHazards } from "./trap-art.js";
import { drawChunks } from "./prop-art.js";
import { drawBlackholeLens } from "./blackhole-lens.js";

export function drawBlackhole(r, f, time) {
  const c = r.ctx,
    age = f.age,
    t = r.reduced ? 0 : age,
    fade = Math.min(1, f.life * 1.5),
    grow = Math.min(1, age / 0.65);
  if (grow <= 0 || fade <= 0) return;
  c.save();
  c.globalAlpha = fade;
  // Fine inflow trails keep the full pull radius readable around the lens.
  for (let n = 0; n < 7; n++) {
    const start = n * 0.898 + t * .48,
      points = [];
    for (let i = 0; i < 22; i++) {
      const d = f.radius * (1 - i / 23) * grow,
        a = start + i * 0.095;
      points.push([f.x + Math.cos(a) * d, f.y + Math.sin(a) * d]);
    }
    c.globalAlpha = fade * (0.035 + (n % 3) * 0.015);
    r.line(points, n % 2 ? "#f2bb78" : "#b1c4d0", 1.2 + (n % 3) * .6);
  }
  for (let n = 0; n < 32; n++) {
    const progress = (n / 32 + t * 0.28) % 1,
      radius = f.radius * (1 - progress),
      a = n * 2.39996 + t * 2 + progress * 4;
    c.globalAlpha = fade * (0.1 + progress * 0.45);
    r.line(
      [
        [f.x + Math.cos(a) * radius, f.y + Math.sin(a) * radius],
        [f.x + Math.cos(a - 0.08) * radius, f.y + Math.sin(a - 0.08) * radius],
      ],
      n % 2 ? "#d6c7ad" : "#ffe5b4",
      1.2,
    );
  }
  c.globalAlpha = 1;
  const size = (38 + Math.min(1, age) * 38) * grow;
  if (!drawBlackholeLens(r, f, size, fade, t)) {
    // Canvas-only fallback for devices without WebGL or after context loss.
    c.globalAlpha = fade;
    const glow = c.createRadialGradient(f.x, f.y, size, f.x, f.y, size * 1.7);
    glow.addColorStop(0, "#fff1c6cc"); glow.addColorStop(.18, "#efa44777"); glow.addColorStop(1, "#efa44700");
    c.fillStyle = glow; c.fillRect(f.x - size*1.7, f.y - size*1.7, size*3.4, size*3.4);
    for (let n = 0; n < 9; n++) {
      c.strokeStyle = n < 3 ? "#fff0c9" : "#e7a45755";
      c.lineWidth = n < 3 ? 1.4 : 2;
      c.beginPath(); c.arc(f.x, f.y, size + 2 + n*2.8, 0, Math.PI*2); c.stroke();
    }
    r.line([[f.x - size*2.8, f.y], [f.x + size*2.8, f.y]], "#edb66f55", 8);
    r.line([[f.x - size*2.6, f.y], [f.x + size*2.6, f.y]], "#fff0cc", 2);
    r.circle(f.x, f.y, size, "#000000");
  }
  c.restore();
}
// Cache the same artwork used before a fragment was torn free. Only its
// geometry changes: bend points are never drawn as outlines or crossbars.
function wreckArtwork(r, w) {
  const key = JSON.stringify([
    w.kind, w.sourceKind, w.trapType, w.material, w.surface, w.panel,
    w.ice, w.elevator, w.w, w.h, w.sourceChunk, w.shape,
  ]);
  const cache = (r.wreckArt ||= new Map());
  if (cache.has(key)) return cache.get(key);
  const foliage = !w.panel && ["grass", "moss"].includes(w.material),
    top = w.elevator ? 40 : foliage ? 12 : w.kind === "trap" ? 16 : 0,
    bottom = foliage ? 28 : w.kind === "trap" ? 16 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w.w * 2);
  canvas.height = Math.ceil((w.h + top + bottom) * 2);
  const c = canvas.getContext("2d"), main = r.ctx;
  c.scale(canvas.width / w.w, canvas.height / (w.h + top + bottom));
  c.translate(0, top);
  r.ctx = c;
  try {
    const source = { ...w, x: 0, y: 0, angle: 0, hp: 120, maxHp: 120 };
    if (w.kind === "platform") {
      r.platform({ ...source, destructible: !!w.panel }, 0);
    } else if (w.kind === "prop") {
      if (w.sourceChunk) drawChunks(c,[{...source,kind:w.sourceKind}]);
      else r.table({ ...source, kind: w.sourceKind || "crate" });
    } else {
      drawHazards(c, [{
        ...source, type: w.trapType, x: w.w / 2, y: w.h / 2,
        bodyX: w.w / 2, bodyY: w.h / 2, active: false, warning: 0, dir: 1,
      }], 0);
    }
  } finally {
    r.ctx = main;
  }
  // A bounded material cache also works for guests and already warped hot joins.
  if (cache.size >= 120) cache.delete(cache.keys().next().value);
  const art = { canvas, top, bottom };
  cache.set(key, art);
  return art;
}

function artworkOutline(w, art) {
  const count = w.outline.length / 2, lower = [], upper = [];
  for (let n = 0; n < count; n++) {
    const a = w.outline[w.outline.length - 1 - n], b = w.outline[n],
      dx = (b.x - a.x) / w.h, dy = (b.y - a.y) / w.h;
    upper.push({ x: a.x - dx * art.top, y: a.y - dy * art.top });
    lower.push({ x: b.x + dx * art.bottom, y: b.y + dy * art.bottom });
  }
  return [...lower, ...upper.reverse()];
}

function textureTriangle(c, art, a, b, d, u0, v0, u1, v1, u2, v2) {
  const du1 = u1 - u0, dv1 = v1 - v0,
    du2 = u2 - u0, dv2 = v2 - v0,
    determinant = du1 * dv2 - du2 * dv1;
  const xx = ((b.x - a.x) * dv2 - (d.x - a.x) * dv1) / determinant,
    xy = ((b.y - a.y) * dv2 - (d.y - a.y) * dv1) / determinant,
    yx = ((d.x - a.x) * du1 - (b.x - a.x) * du2) / determinant,
    yy = ((d.y - a.y) * du1 - (b.y - a.y) * du2) / determinant;
  // Consumed or folded links can have zero area.
  if (Math.abs(xx * yy - xy * yx) < 1e-8) return;
  c.save();
  c.beginPath();
  c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y);
  c.closePath();
  c.clip();
  c.transform(xx, xy, yx, yy, a.x - xx * u0 - yx * v0, a.y - xy * u0 - yy * v0);
  c.drawImage(art, 0, 0);
  c.restore();
}

export function drawWreckage(r, wreckage, time) {
  const c = r.ctx;
  for (const w of wreckage || []) {
    if (!w.hp) continue;
    const art = wreckArtwork(r, w);
    if (w.outline) {
      const outline = artworkOutline(w, art),
        left = Math.min(...outline.map(p => p.x)) - 1,
        top = Math.min(...outline.map(p => p.y)) - 1,
        width = Math.max(...outline.map(p => p.x)) - left + 1,
        height = Math.max(...outline.map(p => p.y)) - top + 1,
        transform = c.getTransform(),
        scale = Math.min(Math.hypot(transform.a, transform.b), 1024 / Math.max(width, height)),
        pixelsW = Math.max(1, Math.ceil(width * scale)),
        pixelsH = Math.max(1, Math.ceil(height * scale));
      const layer = (r.wreckLayer ||= document.createElement("canvas"));
      if (layer.width < pixelsW) layer.width = pixelsW;
      if (layer.height < pixelsH) layer.height = pixelsH;
      const lc = layer.getContext("2d");
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, pixelsW, pixelsH);
      lc.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
      // Adjacent triangle coverage must add up before compositing the piece.
      // Drawing directly over the arena leaves antialiasing seams like a mesh,
      // while overlapping triangles would darken transparent glass.
      lc.globalCompositeOperation = "lighter";
      const links = outline.length / 2 - 1, texture = art.canvas;
      for (let n = 0; n < links; n++) {
        // ribbonOutline starts on the lower edge for a horizontal fragment.
        const top0 = outline[outline.length - 1 - n],
          top1 = outline[outline.length - 2 - n],
          bottom0 = outline[n], bottom1 = outline[n + 1],
          u0 = n * texture.width / links, u1 = (n + 1) * texture.width / links;
        textureTriangle(lc, texture, top0, top1, bottom0, u0, 0, u1, 0, u0, texture.height);
        textureTriangle(lc, texture, top1, bottom1, bottom0, u1, 0, u1, texture.height, u0, texture.height);
      }
      c.drawImage(layer, 0, 0, pixelsW, pixelsH, left, top, pixelsW / scale, pixelsH / scale);
      continue;
    }
    c.save();
    c.translate(w.x, w.y);
    c.rotate(w.angle);
    c.drawImage(art.canvas, -w.w / 2, -w.h / 2 - art.top, w.w, w.h + art.top + art.bottom);
    c.restore();
  }
}
export function drawRifts(r, state) {
  const c = r.ctx;
  c.save();
  for (const f of state.rifts || []) {
    const age = state.time - f.born;
    c.globalAlpha = 0.08 + Math.max(0, 0.12 - age * 0.012);
    for (let n = 0; n < 4; n++) {
      const a = n * 1.6;
      const d = f.radius * (0.4 + n * 0.12);
      c.beginPath();
      c.strokeStyle = "#c59adf";
      c.lineWidth = 2;
      c.arc(f.x, f.y, d, a, a + 0.8);
      c.stroke();
    }
  }
  c.restore();
}
