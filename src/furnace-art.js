import { electricArc } from "./electricity-art.js";
import { furnaceHeat } from "./furnace.js";
import { FURNACE_CYCLE, FURNACE_ON } from "./furnace-arena.js";
import { cableLayout } from "./cable-layout.js";
import { cableRuns, drawCableStroke } from "./cable-art.js";

const line = (c, pts, color, width = 3) => {
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p));
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
};
const poly = (c, pts, color) => {
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p));
  c.closePath(); c.fillStyle = color; c.fill();
};
const circle = (c, x, y, radius, color) => {
  c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fillStyle = color; c.fill();
};
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
let smokeArt;
function smoke(c, x, y, radius) {
  if (!smokeArt) {
    smokeArt = document.createElement("canvas"); smokeArt.width = smokeArt.height = 160;
    const paint = smokeArt.getContext("2d");
    const g = paint.createRadialGradient(73, 72, 10, 80, 80, 79);
    g.addColorStop(0, "#a2a7b0d9"); g.addColorStop(.45, "#848e9aaa");
    g.addColorStop(.8, "#707c8b55"); g.addColorStop(1, "#626e8000");
    paint.fillStyle = g; paint.fillRect(0, 0, 160, 160);
  }
  c.drawImage(smokeArt, x - radius, y - radius, radius * 2, radius * 2);
}
function glow(c, x, y, radius, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color); g.addColorStop(1, "#00000000");
  c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// Cached rear wall. Roof beams and extraction ducting are clearly recessed;
// none of this artwork is entered into the collision or navigation systems.
export function drawFurnaceHall(c) {
  const g = c.createLinearGradient(0, 0, 0, 1440);
  g.addColorStop(0, "#111722"); g.addColorStop(.65, "#242832"); g.addColorStop(1, "#321f20");
  c.fillStyle = g; c.fillRect(0, 0, 2560, 1440);
  for (let x = 80; x < 2560; x += 320) {
    c.fillStyle = "#101722"; c.fillRect(x, 0, 24, 1440);
    c.fillStyle = "#36404a"; c.fillRect(x + 3, 0, 3, 1440);
    for (let y = 180; y < 1300; y += 300)
      line(c, [[x + 24, y], [x + 310, y + 285]], "#303640", 6);
  }
  for (const y of [110, 350]) {
    line(c, [[0, y], [2560, y]], "#080f18", 32);
    line(c, [[0, y - 12], [2560, y - 12]], "#38444f", 4);
  }
  // Clerestory windows and warm industrial lamps sit behind the cable runs.
  for (let x = 130; x < 2560; x += 320) {
    c.fillStyle = "#253645"; c.fillRect(x, 140, 190, 115);
    for (let i = 0; i < 4; i++) line(c, [[x + i * 48, 140], [x + i * 48, 255]], "#0d1520", 8);
    line(c, [[x + 75, 290], [x + 115, 290]], "#e9c590", 6);
    glow(c, x + 95, 300, 105, "#e5a85113");
  }
  // Broad overhead fume hood, suspended well behind the play space.
  poly(c, [[970, 80], [1590, 80], [1710, 320], [850, 320]], "#0c131d");
  line(c, [[970, 80], [850, 320], [1710, 320], [1590, 80]], "#45525b", 7);
  for (let x = 920; x < 1680; x += 45) line(c, [[x, 310], [x + 25, 260]], "#25313b", 4);
  line(c, [[1220, 0], [1220, 80]], "#34424c", 120);
  line(c, [[1190, 0], [1190, 80]], "#4b565c", 5);
  for (const x of [20, 2390]) {
    c.fillStyle = "#17212a"; c.fillRect(x, 390, 150, 370);
    line(c, [[x, 390], [x + 150, 390], [x + 150, 760]], "#5b635f", 7);
    for (let i = 0; i < 9; i++) line(c, [[x + 20, 420 + i * 28], [x + 125, 420 + i * 28]], "#39464e", 10);
    c.fillStyle = "#b67d44"; c.fillRect(x + 52, 695, 45, 34);
    poly(c, [[x + 78, 699], [x + 67, 714], [x + 77, 712], [x + 70, 726], [x + 88, 708], [x + 78, 710]], "#121921");
  }
  glow(c, 1280, 1390, 760, "#e7441622");
}

export function drawFurnaceCables(c, cables, h, time) {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  for (const cable of cables) {
    const spec = cableLayout(cable.id);
    if (spec?.kind !== "furnace") continue;
    for (const run of cableRuns(cable)) {
      drawCableStroke(c, run, "#090e16", 20);
      drawCableStroke(c, run, ["#b73738", "#de4842", "#973040"][spec.index], 12);
      drawCableStroke(c, run, h?.active && !h.done && cable.attached.every(Boolean) && cable.links.every(Boolean)
        ? "#ff9671" : "#f56e5b", 3, -2);
    }
    for (const [i, end] of [spec.a, spec.b].entries()) {
      if (!cable.attached[i]) continue;
      line(c, [[end.x, end.y - 17], [end.x, end.y + 17]], "#263740", 25);
      for (let i = -1; i <= 1; i++) line(c, [[end.x - 17, end.y + i * 11], [end.x + 17, end.y + i * 11]], "#bd9980", 5);
      circle(c, end.x, end.y, 5, "#ece5c9");
    }
    if (cable.attached[1]) {
      const p = spec.b;
      line(c, [[p.x, p.y], [p.x, 805]], "#292e37", 22);
      line(c, [[p.x - 5, p.y + 10], [p.x - 5, 800]], "#6c7777", 4);
    }
  }
  c.restore();
}

function status(c, h, time) {
  const hot = furnaceHeat(h) > 0 && !h.active;
  const color = h.active ? "#9ef4ff" : h.warning > 0 ? "#ffc15a" : hot ? "#ff8750" : "#8ed8af";
  const seconds = Math.ceil(h.active ? h.duration : FURNACE_ON - (h.age % FURNACE_CYCLE));
  for (const side of [-1, 1]) {
    const x = h.x + side * (h.w / 2 + 64);
    line(c, [[x, h.y], [x, h.y - 118]], "#364750", 12);
    c.fillStyle = "#101822"; c.fillRect(x - 80, h.y - 158, 160, 66);
    c.strokeStyle = "#59646a"; c.lineWidth = 2; c.strokeRect(x - 80, h.y - 158, 160, 66);
    c.font = "bold 18px sans-serif"; c.textAlign = "center"; c.fillStyle = color;
    c.fillText(h.active ? "ARC ACTIVE" : h.warning > 0 ? "STAND CLEAR" : hot ? "GRATE HOT" : "CROSSING OPEN", x, h.y - 135);
    c.font = "bold 23px monospace"; c.fillText(`${seconds}s`, x, h.y - 108);
    circle(c, x, h.y - 177, 9, h.warning > 0 && Math.sin(time * 12) < 0 ? "#6e4828" : color);
  }
  line(c, [[h.x - h.w / 2, h.y - 3], [h.x + h.w / 2, h.y - 3]], color, 4);
}

export function drawFurnaceFixture(c, h, time, layer, reduced = false) {
  if (reduced) time = 0;
  if (h.done) return;
  c.save(); c.lineJoin = "round"; c.lineCap = "round";
  if (h.type === "slag") {
    if (layer === "front") { c.restore(); return; }
    const left = h.x - h.w / 2, top = h.y - h.h;
    c.fillStyle = "#592d26"; c.fillRect(left - 12, top - 8, h.w + 24, h.h + 8);
    const g = c.createLinearGradient(0, top, 0, h.y);
    g.addColorStop(0, "#ffdb72"); g.addColorStop(.2, "#fb782a"); g.addColorStop(1, "#ab3026");
    c.fillStyle = g; c.fillRect(left, top, h.w, h.h);
    for (let i = 0; i < 27; i++) {
      const x = left + ((i * 41 + time * 20) % h.w), y = top + 8 + noise(i) * 35;
      line(c, [[x - 8, y], [x + 9, y - 3], [x + 22, y + 2]], i % 3 ? "#6e3128" : "#ffeab0", 3);
    }
    glow(c, h.x, top, 480, "#fa662323");
    c.restore(); return;
  }
  if (layer === "front") { status(c, h, time); c.restore(); return; }
  const x = h.x, y = h.y, heat = furnaceHeat(h);
  glow(c, x, y + 100, 460, h.active ? "#f8863f45" : "#ee572024");
  // Refractory vessel below the narrow grate. Its wall is background scenery.
  line(c, [[x - 270, y + 70], [x - 225, y + 300], [x + 225, y + 300], [x + 270, y + 70]], "#101821", 24);
  const steel = c.createLinearGradient(x - 240, y, x + 240, y);
  steel.addColorStop(0, "#34414c"); steel.addColorStop(.35, "#607071"); steel.addColorStop(.7, "#3c444d"); steel.addColorStop(1, "#1c2631");
  poly(c, [[x - 260, y + 35], [x + 260, y + 35], [x + 210, y + 280], [x - 210, y + 280]], steel);
  for (let i = 0; i < 7; i++) line(c, [[x - 220, y + 90 + i * 25], [x + 220, y + 90 + i * 25]], "#17212a88", 7);
  poly(c, [[x - 260, y + 35], [x - 205, y - 8], [x + 205, y - 8], [x + 260, y + 35], [x + 220, y + 78], [x - 220, y + 78]], "#a76742");
  poly(c, [[x - 230, y + 35], [x - 190, y + 6], [x + 190, y + 6], [x + 230, y + 35], [x + 195, y + 61], [x - 195, y + 61]], h.active ? "#fff2b0" : "#ff9841");
  line(c, [[x - 195, y + 19], [x - 65, y + 27], [x + 60, y + 16], [x + 180, y + 28]], "#fff3b9", 6);
  for (const side of [-1, 1]) {
    circle(c, x + side * 260, y + 142, 37, "#151e28");
    circle(c, x + side * 260, y + 142, 23, "#677774");
    circle(c, x + side * 260, y + 142, 9, "#252c35");
    line(c, [[x + side * 295, y + 142], [x + side * 330, y + 310]], "#303c44", 19);
  }
  // Tapping stream leads into the dangerous molten trough below.
  const flow = 1 + Math.sin(time * 4) * .15;
  line(c, [[x + 145, y + 245], [x + 160, y + 285], [x + 170, y + 357]], "#c65127", 24 * flow);
  line(c, [[x + 145, y + 245], [x + 160, y + 285], [x + 170, y + 357]], "#ffcb66", 9 * flow);
  // Three graphite electrodes, with bright tips only while drawing current.
  for (const dx of [-145, 0, 145]) {
    line(c, [[x + dx, y - 215], [x + dx, y - 50]], "#131b25", 30);
    line(c, [[x + dx - 6, y - 210], [x + dx - 6, y - 52]], "#59626a", 5);
    line(c, [[x + dx - 12, y - 53], [x + dx + 12, y - 53]], h.active ? "#e7ffff" : "#d57545", 7);
  }
  if (layer === undefined || layer === "all") { c.restore(); return; } // Casing-only destruction mesh.
  // Bounded smoke is emitted from the furnace mouth. After shutdown each
  // existing puff rises and fades; there is no opaque rectangular hazard art.
  for (let i = 0; i < 48; i++) {
    const lifetime = 4.2, age = (time + noise(i + 60) * lifetime) % lifetime;
    const born = h.age - age, phase = ((born % FURNACE_CYCLE) + FURNACE_CYCLE) % FURNACE_CYCLE;
    if (!h.active && (born < 0 || phase < FURNACE_ON)) continue;
    const u = age / lifetime, drift = Math.sin(i * 4.7 + age) * (35 + u * 120);
    const sx = x + (noise(i) - .5) * 360 + drift, sy = y - 45 - u * 1110;
    c.globalAlpha = Math.sin(Math.PI * u) * .43;
    smoke(c, sx, sy, 44 + u * 155);
  }
  c.globalAlpha = 1;
  if (h.active) {
    glow(c, x, y - 175, 450, "#68cfff30");
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2);
      const start = { x: x + (lane - 1) * 145, y: y - 52 };
      const bend = { x: x + side * (100 + noise(i + Math.floor(time * 10)) * 95), y: y - 320 - lane * 90 };
      const end = { x: x + side * (80 + noise(i + Math.floor(time * 7) + 30) * 100), y: -90 + lane * 70 };
      electricArc(c, start, bend, time, 70 + i, 2.4, true);
      electricArc(c, bend, end, time, 170 + i, 2, true);
      electricArc(c, start, { x: x + (lane - 1) * 85, y: y + 32 }, time, 220 + i, 3, true);
    }
  }
  if (h.active || heat > 0 || h.warning > 0) {
    for (let i = 0; i < 30; i++) {
      const u = (time * .7 + noise(i * 2)) % 1, side = noise(i + 4) - .5;
      const sx = x + side * (280 + u * 260), sy = y + 15 - Math.sin(u * Math.PI) * (80 + noise(i) * 250);
      line(c, [[sx, sy], [sx - side * 16, sy + 12]], i % 3 ? "#ffb759" : "#f9e9b2", 2.5 * (1 - u));
    }
  }
  if (heat > 0 && !h.active) glow(c, x, y, 240, `rgba(255,96,32,${heat * .2})`);
  c.restore();
}
